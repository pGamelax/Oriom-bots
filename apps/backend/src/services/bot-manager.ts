import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { PrismaClient } from "@prisma/client";
import { createPixPayment, checkPixPayment } from "./payment.js";
import { sendFacebookPurchaseEvent } from "./facebook-capi.js";
import { sendUtmifyConversion, type UtmifyStatus } from "./utmify.js";
import { handleRemarketingCallback } from "./remarketing-scheduler.js";
import QRCode from "qrcode";

const prisma = new PrismaClient();

const activeBots = new Map<string, Bot>();

export function getActiveBot(botId: string): Bot | undefined {
  return activeBots.get(botId);
}

// ── In-memory chat history (no DB) ──────────────────────────────────────────

export type ChatMessage = {
  from: "user" | "bot";
  type: "text" | "photo" | "video" | "sticker" | "callback" | "other";
  text?: string;
  caption?: string;
  mediaUrl?: string;
  timestamp: number;
};

const MAX_MESSAGES_PER_CHAT = 200;
// key: `${botId}:${telegramId}`
const chatHistory = new Map<string, ChatMessage[]>();

function pushMessage(botId: string, telegramId: string, msg: ChatMessage) {
  const key = `${botId}:${telegramId}`;
  const msgs = chatHistory.get(key) ?? [];
  msgs.push(msg);
  if (msgs.length > MAX_MESSAGES_PER_CHAT) msgs.splice(0, msgs.length - MAX_MESSAGES_PER_CHAT);
  chatHistory.set(key, msgs);
}

export function getChatHistory(botId: string, telegramId: string): ChatMessage[] {
  return chatHistory.get(`${botId}:${telegramId}`) ?? [];
}

type TelegramUser = { id: number; first_name: string; last_name?: string; username?: string };

type PendingPayment = {
  pixCode: string;
  gatewayId: string;
  userId: string;
  flowId: string;
  planName: string | null;
  amountInCents: number;
  from: TelegramUser;
  paymentDbId: string;
};

const pendingPayments = new Map<string, PendingPayment>();

// ── Default PIX messages ────────────────────────────────────────────────────

const DEFAULT_QR_CAPTION = "Escaneie o QR Code para pagar";
const DEFAULT_HOW_TO_PAY =
  "✅ <b>Como realizar o pagamento:</b>\n\n" +
  "1. Abra o aplicativo do seu banco.\n" +
  '2. Selecione a opção "Pagar" ou "PIX".\n' +
  '3. Escolha "PIX Copia e Cola".\n' +
  "4. Cole a chave que está abaixo e finalize o pagamento com segurança.";
const DEFAULT_COPY_LABEL = "Copie o código abaixo:";
const DEFAULT_AFTER_LABEL = "Após efetuar o pagamento, clique no botão abaixo 🔄";

// ── Lead helpers ────────────────────────────────────────────────────────────

function telegramName(from: TelegramUser): string | null {
  const n = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return n || null;
}

function isBlockedError(err: any): boolean {
  const msg = String(err?.description ?? err?.message ?? "").toLowerCase();
  return msg.includes("blocked by the user") || msg.includes("bot was blocked");
}

async function upsertLead(params: {
  from: TelegramUser;
  botId: string;
  userId: string;
  flowId: string;
  status: string;
  planName?: string | null;
  planValue?: number | null;
  fbc?: string | null;
  fbp?: string | null;
  utmifyClickId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
}) {
  try {
    const telegramId = String(params.from.id);
    await prisma.lead.upsert({
      where: { telegramId_botId: { telegramId, botId: params.botId } },
      create: {
        telegramId,
        name:           telegramName(params.from),
        username:       params.from.username ?? null,
        botId:          params.botId,
        flowId:         params.flowId,
        userId:         params.userId,
        status:         params.status,
        planName:       params.planName ?? null,
        planValue:      params.planValue ?? null,
        fbc:            params.fbc ?? null,
        fbp:            params.fbp ?? null,
        utmifyClickId:  params.utmifyClickId ?? null,
        utmSource:      params.utmSource ?? null,
        utmMedium:      params.utmMedium ?? null,
        utmCampaign:    params.utmCampaign ?? null,
        utmContent:     params.utmContent ?? null,
        utmTerm:        params.utmTerm ?? null,
      },
      update: {
        name:     telegramName(params.from) ?? undefined,
        username: params.from.username ?? undefined,
        status:   params.status,
        ...(params.status === "new" && { startedAt: new Date() }),
        ...(params.planName  !== undefined && { planName:  params.planName }),
        ...(params.planValue !== undefined && { planValue: params.planValue }),
        // Only set tracking values if we have them (don't overwrite existing)
        ...(params.fbc           && { fbc: params.fbc }),
        ...(params.fbp           && { fbp: params.fbp }),
        ...(params.utmifyClickId && { utmifyClickId: params.utmifyClickId }),
        ...(params.utmSource     && { utmSource:     params.utmSource }),
        ...(params.utmMedium     && { utmMedium:     params.utmMedium }),
        ...(params.utmCampaign   && { utmCampaign:   params.utmCampaign }),
        ...(params.utmContent    && { utmContent:    params.utmContent }),
        ...(params.utmTerm       && { utmTerm:       params.utmTerm }),
      },
    });
  } catch (err: any) {
    console.error("[BotManager] Erro ao salvar lead:", err.message);
  }
}

async function setLeadStatus(
  from: TelegramUser,
  botId: string,
  status: string,
  extra?: { planName?: string; planValue?: number }
) {
  try {
    await prisma.lead.updateMany({
      where: { telegramId: String(from.id), botId },
      data: {
        status,
        ...(extra?.planName !== undefined && { planName: extra.planName }),
        ...(extra?.planValue !== undefined && { planValue: extra.planValue }),
      },
    });
  } catch (err: any) {
    console.error("[BotManager] Erro ao atualizar lead:", err.message);
  }
}

// ── Flow sending ────────────────────────────────────────────────────────────

async function resolveClickToken(token: string): Promise<{
  fbc: string | null; fbp: string | null; utmifyClickId: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  utmContent: string | null; utmTerm: string | null;
} | null> {
  try {
    const ct = await prisma.clickToken.findUnique({ where: { token } });
    if (!ct || ct.usedAt) return null;
    await prisma.clickToken.update({ where: { id: ct.id }, data: { usedAt: new Date() } });
    return {
      fbc: ct.fbc, fbp: ct.fbp, utmifyClickId: ct.utmifyClickId,
      utmSource: ct.utmSource, utmMedium: ct.utmMedium, utmCampaign: ct.utmCampaign,
      utmContent: ct.utmContent, utmTerm: ct.utmTerm,
    };
  } catch {
    return null;
  }
}

async function buildAndSendFlow(
  ctx: Context,
  botId: string
) {
  const flow = await prisma.flow.findUnique({
    where: { botId },
    include: { buttons: { orderBy: { order: "asc" } } },
  });

  if (!flow) return;

  // Resolve tracking token from /start parameter (e.g. /start abc123token)
  let fbc: string | null = null;
  let fbp: string | null = null;
  let utmifyClickId: string | null = null;
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  let utmContent: string | null = null;
  let utmTerm: string | null = null;
  const startParam = (ctx as any).match as string | undefined;
  if (startParam?.trim()) {
    const resolved = await resolveClickToken(startParam.trim());
    if (resolved) {
      fbc = resolved.fbc;
      fbp = resolved.fbp;
      utmifyClickId = resolved.utmifyClickId;
      utmSource     = resolved.utmSource;
      utmMedium     = resolved.utmMedium;
      utmCampaign   = resolved.utmCampaign;
      utmContent    = resolved.utmContent;
      utmTerm       = resolved.utmTerm;
    }
  }

  // Track lead
  if (ctx.from) {
    await upsertLead({
      from: ctx.from,
      botId,
      userId: flow.userId,
      flowId: flow.id,
      status: "new",
      fbc,
      fbp,
      utmifyClickId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    });
  }

  const keyboard = new InlineKeyboard();
  for (const btn of flow.buttons) {
    const label = `R$ ${btn.value.toFixed(2).replace(".", ",")} — ${btn.text}`;
    keyboard.text(label, `pay:${btn.value}:${btn.id}`).row();
  }
  const replyMarkup = flow.buttons.length > 0 ? keyboard : undefined;

  if (flow.useTextMessage && flow.textMessage?.trim()) {
    if (flow.mediaType === "video") {
      await ctx.replyWithVideo(flow.mediaUrl, { caption: flow.caption });
    } else {
      await ctx.replyWithPhoto(flow.mediaUrl, { caption: flow.caption });
    }
    await ctx.reply(flow.textMessage, { reply_markup: replyMarkup });
  } else {
    if (flow.mediaType === "video") {
      await ctx.replyWithVideo(flow.mediaUrl, { caption: flow.caption, reply_markup: replyMarkup });
    } else {
      await ctx.replyWithPhoto(flow.mediaUrl, { caption: flow.caption, reply_markup: replyMarkup });
    }
  }
}

async function sendPixMessages(
  ctx: Context,
  pix: PendingPayment,
  flow: {
    pixQrCaption: string | null;
    pixHowToPay: string | null;
    pixCopyLabel: string | null;
    pixAfterLabel: string | null;
  }
) {
  const qrCaption = flow.pixQrCaption?.trim() || DEFAULT_QR_CAPTION;
  const howToPay = flow.pixHowToPay?.trim() || DEFAULT_HOW_TO_PAY;
  const copyLabel = flow.pixCopyLabel?.trim() || DEFAULT_COPY_LABEL;
  const afterLabel = flow.pixAfterLabel?.trim() || DEFAULT_AFTER_LABEL;

  const pid = pix.pixCode.slice(0, 16);

  // 1. QR Code — always generated locally from the PIX code
  try {
    const qrBuf = await QRCode.toBuffer(pix.pixCode, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    await ctx.replyWithPhoto(new InputFile(qrBuf, "qrcode.png"), { caption: qrCaption });
  } catch (err: any) {
    console.error("[BotManager] Erro ao gerar QR Code:", err.message);
  }

  // 2. How-to-pay instructions
  await ctx.reply(howToPay, { parse_mode: "HTML" });

  // 3. PIX code copy
  await ctx.reply(`${copyLabel}\n\n<code>${pix.pixCode}</code>`, { parse_mode: "HTML" });

  // 4. Action buttons
  const actions = new InlineKeyboard()
    .text("✅ Verificar Status", `verify:${pid}`).row()
    .text("📋 Copiar Código", `copy:${pid}`).row()
    .text("🔗 Ver QR Code", `qr:${pid}`).row();

  await ctx.reply(afterLabel, { reply_markup: actions, parse_mode: "HTML" });
}

// ── UTMify event dispatcher ──────────────────────────────────────────────────

export async function fireUtmifyEvent(params: {
  userId: string;
  botId: string;
  flowId: string | null;
  paymentDbId: string;
  amountInCents: number;
  planName: string | null;
  telegramId: string;
  telegramName: string | null;
  status: UtmifyStatus;
  createdAt: Date;
  paidAt: Date;
  refundedAt?: Date | null;
}) {
  const trackers = await prisma.utmifyTracker.findMany({
    where: {
      userId: params.userId,
      active: true,
      OR: [
        { scope: "global" },
        ...(params.flowId
          ? [{ scope: "specific", flows: { some: { flowId: params.flowId } } }]
          : []),
      ],
    },
  });

  if (trackers.length === 0) return;

  const lead = await prisma.lead.findFirst({
    where: { telegramId: params.telegramId, botId: params.botId },
    select: {
      name: true, startedAt: true,
      utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
    },
  }).catch(() => null);

  console.log(`[BotManager] Firing UTMfy (${params.status}) for ${trackers.length} tracker(s) | payment=${params.paymentDbId}`);

  for (const tracker of trackers) {
    const result = await sendUtmifyConversion({
      token:         tracker.token,
      orderId:       params.paymentDbId,
      amountInCents: params.amountInCents,
      status:        params.status,
      customerName:  lead?.name ?? params.telegramName ?? null,
      telegramId:    params.telegramId,
      utmSource:     lead?.utmSource   ?? null,
      utmMedium:     lead?.utmMedium   ?? null,
      utmCampaign:   lead?.utmCampaign ?? null,
      utmContent:    lead?.utmContent  ?? null,
      utmTerm:       lead?.utmTerm     ?? null,
      planName:      params.planName,
      createdAt:     params.createdAt,
      paidAt:        params.paidAt,
      refundedAt:    params.refundedAt,
    });

    if (!result.success) {
      console.error(`[BotManager] UTMfy (${params.status}) failed for tracker ${tracker.name}: ${result.error}`);
    }
  }
}

// ── Facebook CAPI ────────────────────────────────────────────────────────────

export async function firePurchasePixels(params: {
  userId: string;
  botId: string;
  flowId: string | null;
  paymentDbId: string;
  amountInCents: number;
  planName: string | null;
  telegramId: string;
  telegramName: string | null;
}) {
  const pixels = await prisma.pixel.findMany({
    where: {
      userId: params.userId,
      active: true,
      OR: [
        { scope: "global" },
        ...(params.flowId
          ? [{ scope: "specific", flows: { some: { flowId: params.flowId } } }]
          : []),
      ],
    },
  });

  if (pixels.length === 0) {
    console.log(`[BotManager] No active pixels for userId=${params.userId}, skipping CAPI`);
    return;
  }

  // Fetch tracking data stored on the Lead (captured at /start via ClickToken)
  const lead = await prisma.lead.findFirst({
    where: { telegramId: params.telegramId, botId: params.botId },
    select: {
      fbc: true, fbp: true, utmifyClickId: true,
      utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
      name: true, startedAt: true,
    },
  }).catch(() => null);

  const nameParts = (params.telegramName ?? "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || null;
  const lastName  = nameParts.slice(1).join(" ") || null;

  console.log(
    `[BotManager] Firing CAPI for ${pixels.length} pixel(s) | payment=${params.paymentDbId} | fbc=${lead?.fbc ?? "none"} | fbp=${lead?.fbp ?? "none"} | utmifyClickId=${lead?.utmifyClickId ?? "none"}`
  );

  for (const pixel of pixels) {
    const result = await sendFacebookPurchaseEvent({
      pixelId:       pixel.pixelId,
      accessToken:   pixel.accessToken,
      testEventCode: pixel.testEventCode,
      eventId:       params.paymentDbId,
      amountInCents: params.amountInCents,
      currency:      "BRL",
      planName:      params.planName,
      telegramId:    params.telegramId,
      firstName,
      lastName,
      fbc: lead?.fbc ?? null,
      fbp: lead?.fbp ?? null,
    });

    if (!result.success) {
      console.error(`[BotManager] CAPI failed for pixel ${pixel.name} (${pixel.pixelId}): ${result.error}`);
    }
  }

  // ── UTMfy paid event ─────────────────────────────────────────────────────
  const now = new Date();
  await fireUtmifyEvent({
    userId:        params.userId,
    botId:         params.botId,
    flowId:        params.flowId,
    paymentDbId:   params.paymentDbId,
    amountInCents: params.amountInCents,
    planName:      params.planName,
    telegramId:    params.telegramId,
    telegramName:  params.telegramName,
    status:        "paid",
    createdAt:     lead?.startedAt ?? now,
    paidAt:        now,
  });
}

// ── Telegram notification on confirmed payment ────────────────────────────────

export async function sendPaymentConfirmation(
  botId: string,
  telegramId: string,
  planName: string | null,
  flowId: string | null,
  amountInCents: number
): Promise<void> {
  const bot = activeBots.get(botId);
  if (!bot) {
    console.warn(`[BotManager] Bot ${botId} not active — cannot send payment confirmation to ${telegramId}`);
    return;
  }

  // ── Fetch delivery URL ─────────────────────────────────────────────────────
  let deliveryUrl: string | null = null;
  if (flowId) {
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      select: {
        defaultDeliveryUrl: true,
        buttons: { select: { text: true, value: true, useDefaultDelivery: true, customDeliveryUrl: true } },
      },
    });

    if (flow) {
      // Find matching button by planName text or by value (amountInCents / 100)
      const planValue = amountInCents / 100;
      const button = flow.buttons.find(
        (b) => b.text === planName || Math.abs(b.value - planValue) < 0.01
      );

      if (button && !button.useDefaultDelivery && button.customDeliveryUrl) {
        deliveryUrl = button.customDeliveryUrl;
      } else {
        deliveryUrl = flow.defaultDeliveryUrl ?? null;
      }
    }
  }

  // ── Send confirmation message ──────────────────────────────────────────────
  const planLine = planName ? `\nPlano: <b>${planName}</b>` : "";
  const message  = `✅ <b>Pagamento confirmado!</b>${planLine}\n\nSeu acesso será liberado em breve. Obrigado!`;

  try {
    await bot.api.sendMessage(telegramId, message, { parse_mode: "HTML" });

    // ── Send delivery URL as a separate message ──────────────────────────────
    if (deliveryUrl) {
      await bot.api.sendMessage(telegramId, deliveryUrl);
      console.log(`[BotManager] Delivery URL sent to telegramId=${telegramId}`);
    } else {
      console.warn(`[BotManager] No delivery URL configured for flowId=${flowId}`);
    }

    console.log(`[BotManager] Confirmation sent to telegramId=${telegramId}`);
  } catch (err: any) {
    console.error(`[BotManager] Failed to send confirmation to ${telegramId}:`, err.message);
  }
}

// ── Bot lifecycle ───────────────────────────────────────────────────────────

export async function startBot(botId: string, token: string) {
  await stopBot(botId);

  const bot = new Bot(token);

  // ── Capture outgoing bot messages (transformer) ──────────────────────────
  const SEND_METHODS = new Set(["sendMessage", "sendPhoto", "sendVideo", "sendSticker", "sendDocument"]);
  bot.api.config.use(async (prev, method, payload, signal) => {
    const result = await prev(method, payload, signal);
    if (SEND_METHODS.has(method)) {
      const p = payload as any;
      const chatId = String(p.chat_id);
      let type: ChatMessage["type"] = "text";
      let mediaUrl: string | undefined;
      if (method === "sendPhoto") { type = "photo"; mediaUrl = typeof p.photo === "string" ? p.photo : undefined; }
      else if (method === "sendVideo") { type = "video"; mediaUrl = typeof p.video === "string" ? p.video : undefined; }
      else if (method === "sendSticker") { type = "sticker"; }
      pushMessage(botId, chatId, {
        from: "bot",
        type,
        text: p.text,
        caption: p.caption,
        mediaUrl,
        timestamp: Date.now(),
      });
    }
    return result;
  });

  // ── Capture incoming user messages (middleware) ───────────────────────────
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const telegramId = String(ctx.from.id);

      if (ctx.message) {
        const msg = ctx.message;
        let type: ChatMessage["type"] = "other";
        let text: string | undefined;
        let mediaUrl: string | undefined;
        if (msg.text) { type = "text"; text = msg.text; }
        else if (msg.photo) { type = "photo"; text = msg.caption; }
        else if (msg.video) { type = "video"; text = msg.caption; }
        else if (msg.sticker) { type = "sticker"; text = msg.sticker.emoji; }
        pushMessage(botId, telegramId, { from: "user", type, text, mediaUrl, timestamp: Date.now() });
      }

      if (ctx.callbackQuery?.data) {
        const data = ctx.callbackQuery.data;
        let label: string;
        if (data.startsWith("pay:")) {
          const value = parseFloat(data.split(":")[1]);
          label = isNaN(value) ? "Selecionou plano" : `Selecionou plano R$ ${value.toFixed(2).replace(".", ",")}`;
        } else if (data.startsWith("rmkt:")) {
          const value = parseFloat(data.split(":")[1]);
          label = isNaN(value) ? "Selecionou plano (remarketing)" : `Selecionou plano R$ ${value.toFixed(2).replace(".", ",")} (remarketing)`;
        } else if (data.startsWith("verify:")) {
          label = "Verificou status do pagamento";
        } else if (data.startsWith("copy:")) {
          label = "Copiou código PIX";
        } else if (data.startsWith("qr:")) {
          label = "Solicitou QR Code";
        } else {
          label = data;
        }
        pushMessage(botId, telegramId, { from: "user", type: "callback", text: label, timestamp: Date.now() });
      }
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    try {
      await buildAndSendFlow(ctx, botId);
    } catch (err: any) {
      if (isBlockedError(err) && ctx.from) {
        await setLeadStatus(ctx.from, botId, "blocked");
      }
      console.error(`[Bot ${botId}] /start error:`, err.message);
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // ── PAY ─────────────────────────────────────────────────────────────────
    if (data.startsWith("pay:")) {
      const parts = data.split(":");
      const value = parseFloat(parts[1]);
      const buttonId = parts[2];
      if (isNaN(value)) return;

      await ctx.answerCallbackQuery({ text: "⏳ Gerando PIX..." });

      const flow = await prisma.flow.findUnique({
        where: { botId },
        select: {
          id: true,
          userId: true,
          pixQrCaption: true,
          pixHowToPay: true,
          pixCopyLabel: true,
          pixAfterLabel: true,
        },
      });

      if (!flow) {
        await ctx.reply("❌ Fluxo não configurado para este bot.");
        return;
      }

      // Get plan name from button
      const button = buttonId
        ? await prisma.flowButton.findUnique({ where: { id: buttonId }, select: { text: true } })
        : await prisma.flowButton.findFirst({ where: { flow: { botId }, value }, select: { text: true } });
      const planName = button?.text ?? null;

      // Update lead to pending
      await setLeadStatus(ctx.from, botId, "pending", { planName: planName ?? undefined, planValue: value });

      try {
        const amountInCents = Math.round(value * 100);
        const pix = await createPixPayment(flow.userId, amountInCents, {
          flowId: flow.id,
          description: `Plano R$ ${value.toFixed(2).replace(".", ",")}`,
          externalReference: `tg-${ctx.from.id}-${Date.now()}`,
        });

        // Persist payment to database
        const paymentRecord = await prisma.payment.create({
          data: {
            externalId:   pix.id,
            userId:       flow.userId,
            gatewayId:    pix.gatewayId,
            botId,
            flowId:       flow.id,
            telegramId:   String(ctx.from.id),
            telegramName: telegramName(ctx.from),
            planName,
            amountInCents,
            status:  "pending",
            pixCode: pix.pixCode,
          },
        });

        const pid = pix.pixCode.slice(0, 16);
        pendingPayments.set(pid, {
          pixCode:       pix.pixCode,
          gatewayId:     pix.gatewayId,
          userId:        flow.userId,
          flowId:        flow.id,
          planName,
          amountInCents,
          from:          ctx.from,
          paymentDbId:   paymentRecord.id,
        });

        // Fire UTMify waiting_payment
        const now = new Date();
        fireUtmifyEvent({
          userId:        flow.userId,
          botId,
          flowId:        flow.id,
          paymentDbId:   paymentRecord.id,
          amountInCents,
          planName,
          telegramId:    String(ctx.from.id),
          telegramName:  telegramName(ctx.from),
          status:        "waiting_payment",
          createdAt:     now,
          paidAt:        now,
        }).catch((err) => console.error("[BotManager] UTMfy waiting_payment:", err.message));

        try {
          await sendPixMessages(ctx, pendingPayments.get(pid)!, flow);
        } catch (err: any) {
          if (isBlockedError(err)) await setLeadStatus(ctx.from, botId, "blocked");
        }
      } catch (err: any) {
        console.error(`[Bot ${botId}] Erro ao criar PIX:`, err.message);
        await ctx.reply("❌ Não foi possível gerar o PIX. Tente novamente em instantes.");
      }
      return;
    }

    // ── REMARKETING PAY ──────────────────────────────────────────────────────
    if (data.startsWith("rmkt:")) {
      const parts = data.split(":");
      const value    = parseFloat(parts[1]);
      const buttonId = parts[2];
      if (isNaN(value) || !buttonId) return;

      await ctx.answerCallbackQuery({ text: "⏳ Gerando PIX..." });

      try {
        const result = await handleRemarketingCallback({
          botId,
          from: ctx.from,
          value,
          buttonId,
          pendingPayments,
          setLeadStatus,
          telegramName,
          sendPixMessages: async (pix, flow) => sendPixMessages(ctx, pix, flow),
        });

        if (!result.ok) {
          await ctx.reply("❌ Plano não encontrado.");
          return;
        }

        await sendPixMessages(ctx, result.pixEntry!, result.flow!);
      } catch (err: any) {
        console.error(`[Bot ${botId}] Erro ao criar PIX (rmkt):`, err.message);
        await ctx.reply("❌ Não foi possível gerar o PIX. Tente novamente em instantes.");
      }
      return;
    }

    // ── VERIFY STATUS ────────────────────────────────────────────────────────
    if (data.startsWith("verify:")) {
      await ctx.answerCallbackQuery({ text: "🔍 Verificando..." });
      const pid = data.slice(7);
      const payment = pendingPayments.get(pid);

      if (!payment) {
        await ctx.reply("❌ Pagamento não encontrado. Gere um novo PIX.");
        return;
      }

      try {
        const status = await checkPixPayment(payment.userId, payment.gatewayId, pid);
        const messages: Record<string, string> = {
          paid: "✅ <b>Pagamento confirmado!</b> Seu acesso será liberado em breve.",
          pending: "⏳ <b>Aguardando pagamento.</b> O PIX ainda não foi confirmado.",
          expired: "⌛ <b>PIX expirado.</b> Por favor, gere um novo código.",
          cancelled: "❌ <b>Pagamento cancelado.</b>",
        };
        if (status === "expired" || status === "cancelled") {
          await prisma.payment.update({
            where: { id: payment.paymentDbId },
            data:  { status: "cancelled" },
          }).catch(() => null);

          fireUtmifyEvent({
            userId:        payment.userId,
            botId,
            flowId:        payment.flowId,
            paymentDbId:   payment.paymentDbId,
            amountInCents: payment.amountInCents,
            planName:      payment.planName,
            telegramId:    String(payment.from.id),
            telegramName:  telegramName(payment.from),
            status:        "cancelled",
            createdAt:     new Date(),
            paidAt:        new Date(),
          }).catch((err) => console.error("[BotManager] UTMfy cancelled:", err.message));
        }

        if (status === "paid") {
          await setLeadStatus(payment.from, botId, "paid");
          await prisma.payment.update({
            where: { id: payment.paymentDbId },
            data:  { status: "paid", paidAt: new Date() },
          }).catch(() => null);

          // Fire Facebook CAPI + UTMify paid
          firePurchasePixels({
            userId:        payment.userId,
            botId,
            flowId:        payment.flowId,
            paymentDbId:   payment.paymentDbId,
            amountInCents: payment.amountInCents,
            planName:      payment.planName,
            telegramId:    String(payment.from.id),
            telegramName:  telegramName(payment.from),
          }).catch((err) => console.error("[BotManager] firePurchasePixels:", err.message));
        }
        await ctx.reply(messages[status] ?? "❓ Status desconhecido.", { parse_mode: "HTML" });
      } catch {
        await ctx.reply("❌ Não foi possível verificar o pagamento. Tente novamente.");
      }
      return;
    }

    // ── COPY CODE ────────────────────────────────────────────────────────────
    if (data.startsWith("copy:")) {
      await ctx.answerCallbackQuery({ text: "📋 Código copiado!" });
      const pid = data.slice(5);
      const payment = pendingPayments.get(pid);

      if (!payment) {
        await ctx.reply("❌ Código não encontrado. Gere um novo PIX.");
        return;
      }

      await ctx.reply(
        `📋 <b>Código PIX:</b>\n\n<code>${payment.pixCode}</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    // ── SHOW QR CODE ─────────────────────────────────────────────────────────
    if (data.startsWith("qr:")) {
      await ctx.answerCallbackQuery();
      const pid = data.slice(3);
      const payment = pendingPayments.get(pid);

      if (!payment) {
        await ctx.reply("❌ Pagamento não encontrado. Gere um novo PIX.");
        return;
      }

      try {
        const qrBuf = await QRCode.toBuffer(payment.pixCode, {
          type: "png",
          width: 512,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        await ctx.replyWithPhoto(new InputFile(qrBuf, "qrcode.png"), {
          caption: "📷 QR Code para pagamento",
        });
      } catch {
        await ctx.reply("❌ Não foi possível gerar o QR Code.");
      }
      return;
    }
  });

  bot.catch((err) => {
    console.error(`[Bot ${botId}] Erro:`, err.message);
  });

  bot.start().catch((err) => {
    console.error(`[Bot ${botId}] Falhou ao iniciar:`, err.message);
    activeBots.delete(botId);
  });

  activeBots.set(botId, bot);
  console.log(`[BotManager] Bot ${botId} iniciado.`);
}

export async function stopBot(botId: string) {
  const existing = activeBots.get(botId);
  if (existing) {
    await existing.stop();
    activeBots.delete(botId);
    console.log(`[BotManager] Bot ${botId} parado.`);
  }
}

export async function startAllBots() {
  const bots = await prisma.bot.findMany({ where: { active: true } });
  console.log(`[BotManager] Iniciando ${bots.length} bot(s)...`);
  for (const bot of bots) {
    await startBot(bot.id, bot.token);
  }
}

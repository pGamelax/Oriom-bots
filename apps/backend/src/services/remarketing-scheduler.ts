import { InlineKeyboard } from "grammy";
import { PrismaClient } from "@prisma/client";
import { getActiveBot } from "./bot-manager.js";
import { createPixPayment } from "./payment.js";

const prisma = new PrismaClient();

// ── Send remarketing message to one lead ──────────────────────────────────────

async function sendToLead(
  remarketing: Awaited<ReturnType<typeof loadRemarketing>>,
  lead: { telegramId: string; name: string | null }
): Promise<{ sent: boolean; blocked: boolean }> {
  const bot = getActiveBot(remarketing!.flow.botId);
  if (!bot) return { sent: false, blocked: false };

  const telegramId = lead.telegramId;

  // Build inline keyboard
  const keyboard = new InlineKeyboard();
  for (const btn of remarketing!.buttons) {
    const label = `R$ ${btn.value.toFixed(2).replace(".", ",")} — ${btn.text}`;
    keyboard.text(label, `rmkt:${btn.value}:${btn.id}`).row();
  }
  const reply_markup = remarketing!.buttons.length > 0 ? keyboard : undefined;

  try {
    if (remarketing!.useTextMessage && remarketing!.textMessage?.trim()) {
      // Send media first (if configured), then text message with buttons
      if (remarketing!.mediaUrl && remarketing!.mediaType) {
        if (remarketing!.mediaType === "video") {
          await bot.api.sendVideo(telegramId, remarketing!.mediaUrl, { caption: remarketing!.caption ?? undefined });
        } else {
          await bot.api.sendPhoto(telegramId, remarketing!.mediaUrl, { caption: remarketing!.caption ?? undefined });
        }
      }
      await bot.api.sendMessage(telegramId, remarketing!.textMessage, { reply_markup });
    } else if (remarketing!.mediaUrl && remarketing!.mediaType) {
      if (remarketing!.mediaType === "video") {
        await bot.api.sendVideo(telegramId, remarketing!.mediaUrl, {
          caption: remarketing!.caption ?? undefined,
          reply_markup,
        });
      } else {
        await bot.api.sendPhoto(telegramId, remarketing!.mediaUrl, {
          caption: remarketing!.caption ?? undefined,
          reply_markup,
        });
      }
    } else if (remarketing!.caption) {
      await bot.api.sendMessage(telegramId, remarketing!.caption, { reply_markup });
    }

    console.log(`[Remarketing] ✅ Sent to telegramId=${telegramId} (remarketing=${remarketing!.name})`);
    return { sent: true, blocked: false };
  } catch (err: any) {
    const msg = String(err?.description ?? err?.message ?? "").toLowerCase();
    if (msg.includes("blocked") || msg.includes("deactivated")) {
      await prisma.lead.updateMany({
        where: { telegramId, botId: remarketing!.flow.botId },
        data: { status: "blocked" },
      }).catch(() => {});
      console.warn(`[Remarketing] Lead ${telegramId} blocked bot — marked as blocked`);
      return { sent: false, blocked: true };
    } else {
      console.error(`[Remarketing] Failed to send to ${telegramId}:`, err.message);
      return { sent: false, blocked: false };
    }
  }
}

// ── Load a remarketing with all needed relations ───────────────────────────────

async function loadRemarketing(id: string) {
  return prisma.remarketing.findUnique({
    where: { id },
    include: {
      flow: { select: { id: true, botId: true, userId: true } },
      buttons: { orderBy: { order: "asc" } },
    },
  });
}

// ── Run one remarketing ────────────────────────────────────────────────────────

async function runRemarketing(id: string, name: string, flowBotId: string, targetAudience: string, startAfterMinutes: number) {
  const now = new Date();

  // Mark as running immediately to prevent duplicate runs
  await prisma.remarketing.update({ where: { id }, data: { lastRunAt: now } });

  const remarketing = await loadRemarketing(id);
  if (!remarketing) return;

  // cutoff: leads must have been in target state for at least startAfterMinutes
  const cutoff = new Date(now.getTime() - startAfterMinutes * 60_000);

  // Determine which leads to target and which timestamp to use as threshold
  let leads: { telegramId: string; name: string | null }[] = [];

  if (targetAudience === "paid") {
    // For paid leads, use updatedAt (when they became paid) as threshold
    leads = await prisma.lead.findMany({
      where: {
        botId:     flowBotId,
        status:    "paid",
        updatedAt: { lte: cutoff },
      },
      select: { telegramId: true, name: true },
    });
  } else if (targetAudience === "pending") {
    // For pending leads, use updatedAt (when they generated PIX) as threshold
    leads = await prisma.lead.findMany({
      where: {
        botId:     flowBotId,
        status:    "pending",
        updatedAt: { lte: cutoff },
      },
      select: { telegramId: true, name: true },
    });
  } else if (targetAudience === "new") {
    // For new leads, use startedAt as threshold
    leads = await prisma.lead.findMany({
      where: {
        botId:     flowBotId,
        status:    "new",
        startedAt: { lte: cutoff },
      },
      select: { telegramId: true, name: true },
    });
  } else {
    // "all": use startedAt as threshold, exclude blocked
    leads = await prisma.lead.findMany({
      where: {
        botId:     flowBotId,
        status:    { notIn: ["blocked"] },
        startedAt: { lte: cutoff },
      },
      select: { telegramId: true, name: true },
    });
  }

  console.log(
    `[Remarketing] Running "${name}" → ${leads.length} lead(s) (audience=${targetAudience}, startAfter=${startAfterMinutes}min)`
  );

  // Create log entry
  const log = await prisma.remarketingLog.create({
    data: { remarketingId: id, startedAt: now },
  });

  let sentCount = 0;
  let blockedCount = 0;

  for (const lead of leads) {
    const result = await sendToLead(remarketing, lead);
    if (result.sent) sentCount++;
    if (result.blocked) blockedCount++;
    // Small delay between messages to avoid Telegram rate limits
    await new Promise((r) => setTimeout(r, 50));
  }

  // Update log with results
  await prisma.remarketingLog.update({
    where: { id: log.id },
    data: { finishedAt: new Date(), sent: sentCount, blocked: blockedCount },
  });

  console.log(`[Remarketing] ✅ Finished "${name}" — sent=${sentCount}, blocked=${blockedCount}`);
}

// ── Scheduler loop ─────────────────────────────────────────────────────────────

async function checkAndRunDue() {
  try {
    const now = new Date();

    const due = await prisma.remarketing.findMany({
      where: { active: true },
      select: {
        id:                true,
        name:              true,
        targetAudience:    true,
        intervalMinutes:   true,
        startAfterMinutes: true,
        lastRunAt:         true,
        flow: { select: { botId: true } },
      },
    });

    for (const r of due) {
      const needsRun =
        !r.lastRunAt ||
        now.getTime() - r.lastRunAt.getTime() >= r.intervalMinutes * 60_000;

      if (needsRun) {
        runRemarketing(r.id, r.name, r.flow.botId, r.targetAudience, r.startAfterMinutes).catch((err) =>
          console.error(`[Remarketing] Error running "${r.name}":`, err.message)
        );
      }
    }
  } catch (err: any) {
    console.error("[Remarketing] Scheduler error:", err.message);
  }
}

// ── Handle rmkt: callback from Telegram button ─────────────────────────────────
// Called from bot-manager when a user clicks an rmkt button

export async function handleRemarketingCallback(params: {
  botId:    string;
  from:     { id: number; first_name: string; last_name?: string; username?: string };
  value:    number;
  buttonId: string;
  pendingPayments: Map<string, {
    pixCode: string; gatewayId: string; userId: string; flowId: string;
    planName: string | null; amountInCents: number;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    paymentDbId: string;
  }>;
  sendPixMessages: (pix: any, flow: any) => Promise<void>;
  setLeadStatus: (from: any, botId: string, status: string, extra?: any) => Promise<void>;
  telegramName: (from: any) => string | null;
}): Promise<{ ok: boolean; pixEntry?: any; flow?: any }> {
  const { botId, from, value, buttonId, pendingPayments, setLeadStatus, telegramName } = params;

  const rmktBtn = await prisma.remarketingButton.findUnique({
    where: { id: buttonId },
    include: { remarketing: { select: { id: true, flowId: true, defaultDeliveryUrl: true } } },
  });

  if (!rmktBtn) return { ok: false };

  const flow = await prisma.flow.findUnique({
    where: { id: rmktBtn.remarketing.flowId },
    select: {
      id: true, userId: true,
      pixQrCaption: true, pixHowToPay: true, pixCopyLabel: true, pixAfterLabel: true,
    },
  });

  if (!flow) return { ok: false };

  const planName = rmktBtn.text;
  await setLeadStatus(from, botId, "pending", { planName, planValue: value });

  const amountInCents = Math.round(value * 100);
  const pix = await createPixPayment(flow.userId, amountInCents, {
    flowId: flow.id,
    description: `Plano R$ ${value.toFixed(2).replace(".", ",")}`,
    externalReference: `tg-${from.id}-${Date.now()}`,
  });

  const paymentRecord = await prisma.payment.create({
    data: {
      externalId:    pix.id,
      userId:        flow.userId,
      gatewayId:     pix.gatewayId,
      botId,
      flowId:        flow.id,
      remarketingId: rmktBtn.remarketing.id,
      telegramId:    String(from.id),
      telegramName:  telegramName(from),
      planName,
      amountInCents,
      status:  "pending",
      pixCode: pix.pixCode,
    },
  });

  const pid = pix.pixCode.slice(0, 16);
  const pixEntry = {
    pixCode:     pix.pixCode,
    gatewayId:   pix.gatewayId,
    userId:      flow.userId,
    flowId:      flow.id,
    planName,
    amountInCents,
    from,
    paymentDbId: paymentRecord.id,
  };
  pendingPayments.set(pid, pixEntry);

  return { ok: true, pixEntry, flow };
}

// ── Start scheduler ────────────────────────────────────────────────────────────

export function startRemarketingScheduler() {
  console.log("[Remarketing] Scheduler started — checking every 60s");
  // Initial check after 10s (give bots time to start)
  setTimeout(checkAndRunDue, 10_000);
  // Then check every minute
  setInterval(checkAndRunDue, 60_000);
}

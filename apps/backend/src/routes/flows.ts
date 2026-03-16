import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

const buttonSchema = t.Object({
  text: t.String(),
  value: t.Number(),
  order: t.Number(),
  useDefaultDelivery: t.Boolean(),
  customDeliveryUrl: t.Optional(t.String()),
});

const flowBodySchema = t.Object({
  botId: t.String(),
  name: t.Optional(t.String()),
  mediaUrl: t.String(),
  mediaType: t.Union([t.Literal("image"), t.Literal("video")]),
  caption: t.String(),
  useTextMessage: t.Boolean(),
  textMessage: t.Optional(t.String()),
  defaultDeliveryUrl: t.Optional(t.String()),
  pixQrCaption: t.Optional(t.String()),
  pixHowToPay: t.Optional(t.String()),
  pixCopyLabel: t.Optional(t.String()),
  pixAfterLabel: t.Optional(t.String()),
  buttons: t.Array(buttonSchema),
});

export const flowRoutes = new Elysia({ prefix: "/api/flows" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get("/", async ({ session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const flows = await prisma.flow.findMany({
      where: { userId: session.user.id },
      include: { bot: true, buttons: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return flows;
  })
  .get("/:id", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const flow = await prisma.flow.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { bot: true, buttons: { orderBy: { order: "asc" } } },
    });

    if (!flow) { set.status = 404; return { error: "Fluxo não encontrado." }; }

    return flow;
  })
  .post("/", async ({ body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    // Verifica se o bot pertence ao usuário
    const bot = await prisma.bot.findFirst({
      where: { id: body.botId, userId: session.user.id },
    });
    if (!bot) { set.status = 404; return { error: "Bot não encontrado." }; }

    // Verifica se o bot já está em outro fluxo
    const existing = await prisma.flow.findUnique({ where: { botId: body.botId } });
    if (existing) { set.status = 409; return { error: "Este bot já está associado a um fluxo." }; }

    const flow = await prisma.flow.create({
      data: {
        botId: body.botId,
        userId: session.user.id,
        name: body.name ?? null,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        caption: body.caption,
        useTextMessage: body.useTextMessage,
        textMessage: body.textMessage ?? null,
        defaultDeliveryUrl: body.defaultDeliveryUrl ?? null,
        pixQrCaption: body.pixQrCaption ?? null,
        pixHowToPay: body.pixHowToPay ?? null,
        pixCopyLabel: body.pixCopyLabel ?? null,
        pixAfterLabel: body.pixAfterLabel ?? null,
        buttons: {
          create: body.buttons.map((b) => ({
            text: b.text,
            value: b.value,
            order: b.order,
            useDefaultDelivery: b.useDefaultDelivery,
            customDeliveryUrl: b.customDeliveryUrl ?? null,
          })),
        },
      },
      include: { bot: true, buttons: { orderBy: { order: "asc" } } },
    });

    return flow;
  }, { body: flowBodySchema })
  .put("/:id", async ({ params, body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const flow = await prisma.flow.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!flow) { set.status = 404; return { error: "Fluxo não encontrado." }; }

    // Se o bot mudou, verifica disponibilidade
    if (body.botId !== flow.botId) {
      const bot = await prisma.bot.findFirst({ where: { id: body.botId, userId: session.user.id } });
      if (!bot) { set.status = 404; return { error: "Bot não encontrado." }; }

      const conflict = await prisma.flow.findUnique({ where: { botId: body.botId } });
      if (conflict) { set.status = 409; return { error: "Este bot já está associado a um fluxo." }; }
    }

    // Recria os botões
    await prisma.flowButton.deleteMany({ where: { flowId: params.id } });

    const updated = await prisma.flow.update({
      where: { id: params.id },
      data: {
        botId: body.botId,
        name: body.name ?? null,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        caption: body.caption,
        useTextMessage: body.useTextMessage,
        textMessage: body.textMessage ?? null,
        defaultDeliveryUrl: body.defaultDeliveryUrl ?? null,
        pixQrCaption: body.pixQrCaption ?? null,
        pixHowToPay: body.pixHowToPay ?? null,
        pixCopyLabel: body.pixCopyLabel ?? null,
        pixAfterLabel: body.pixAfterLabel ?? null,
        buttons: {
          create: body.buttons.map((b) => ({
            text: b.text,
            value: b.value,
            order: b.order,
            useDefaultDelivery: b.useDefaultDelivery,
            customDeliveryUrl: b.customDeliveryUrl ?? null,
          })),
        },
      },
      include: { bot: true, buttons: { orderBy: { order: "asc" } } },
    });

    return updated;
  }, { body: flowBodySchema })
  .delete("/:id", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const flow = await prisma.flow.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!flow) { set.status = 404; return { error: "Fluxo não encontrado." }; }

    await prisma.flow.delete({ where: { id: params.id } });

    return { success: true };
  });

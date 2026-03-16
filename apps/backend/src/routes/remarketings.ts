import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

const buttonSchema = t.Object({
  text:               t.String(),
  value:              t.Number(),
  order:              t.Number(),
  useDefaultDelivery: t.Boolean(),
  customDeliveryUrl:  t.Optional(t.String()),
});

const variantSchema = t.Object({
  mediaUrl:       t.Optional(t.String()),
  mediaType:      t.Optional(t.Union([t.Literal("image"), t.Literal("video")])),
  caption:        t.Optional(t.String()),
  useTextMessage: t.Boolean(),
  textMessage:    t.Optional(t.String()),
  buttons:        t.Array(buttonSchema),
});

const remarketingBody = t.Object({
  flowId:             t.String(),
  name:               t.String(),
  targetAudience:     t.Union([t.Literal("all"), t.Literal("new"), t.Literal("pending"), t.Literal("paid")]),
  intervalMinutes:    t.Number({ minimum: 1 }),
  startAfterMinutes:  t.Number({ minimum: 0 }),
  defaultDeliveryUrl: t.Optional(t.String()),
  variants:           t.Array(variantSchema, { minItems: 1 }),
});

async function getUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

const include = {
  flow: {
    select: {
      id: true,
      name: true,
      caption: true,
      bot: { select: { id: true, username: true, name: true } },
    },
  },
  variants: {
    orderBy: { order: "asc" as const },
    include: {
      buttons: { orderBy: { order: "asc" as const } },
    },
  },
  logs: {
    orderBy: { startedAt: "desc" as const },
    take: 20,
  },
};

// Compute payment stats for a remarketing
async function getPaymentStats(remarketingId: string) {
  const payments = await prisma.payment.findMany({
    where: { remarketingId },
    select: { status: true, amountInCents: true },
  });
  const generated = payments.length;
  const paid = payments.filter((p) => p.status === "paid").length;
  const revenueInCents = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amountInCents, 0);
  return { generated, paid, revenueInCents };
}

export const remarketingRoutes = new Elysia({ prefix: "/api/remarketings" })

  // List
  .get("/", async ({ request, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const remarketings = await prisma.remarketing.findMany({
      where: { userId },
      include,
      orderBy: { createdAt: "desc" },
    });

    const results = await Promise.all(
      remarketings.map(async (r) => ({
        ...r,
        paymentStats: await getPaymentStats(r.id),
      }))
    );

    return results;
  })

  // Create
  .post("/", async ({ request, body, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const flow = await prisma.flow.findFirst({ where: { id: body.flowId, userId } });
    if (!flow) { set.status = 404; return { error: "Fluxo não encontrado" }; }

    const { variants, ...data } = body;
    const created = await prisma.remarketing.create({
      data: {
        ...data,
        userId,
        defaultDeliveryUrl: data.defaultDeliveryUrl ?? null,
        variants: {
          create: variants.map((v, vi) => ({
            order: vi,
            mediaUrl:       v.mediaUrl       ?? null,
            mediaType:      v.mediaType      ?? null,
            caption:        v.caption        ?? null,
            useTextMessage: v.useTextMessage,
            textMessage:    v.textMessage    ?? null,
            buttons: {
              create: v.buttons.map((b, bi) => ({
                text:               b.text,
                value:              b.value,
                order:              bi,
                useDefaultDelivery: b.useDefaultDelivery,
                customDeliveryUrl:  b.customDeliveryUrl ?? null,
              })),
            },
          })),
        },
      },
      include,
    });
    return { ...created, paymentStats: { generated: 0, paid: 0, revenueInCents: 0 } };
  }, { body: remarketingBody })

  // Update
  .put("/:id", async ({ request, params, body, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const existing = await prisma.remarketing.findFirst({ where: { id: params.id, userId } });
    if (!existing) { set.status = 404; return { error: "Remarketing não encontrado" }; }

    const flow = await prisma.flow.findFirst({ where: { id: body.flowId, userId } });
    if (!flow) { set.status = 404; return { error: "Fluxo não encontrado" }; }

    const { variants, ...data } = body;

    // Delete existing variants (cascade deletes buttons)
    await prisma.remarketingVariant.deleteMany({ where: { remarketingId: params.id } });

    const updated = await prisma.remarketing.update({
      where: { id: params.id },
      data: {
        ...data,
        defaultDeliveryUrl: data.defaultDeliveryUrl ?? null,
        currentVariantIndex: 0, // reset rotation when edited
        variants: {
          create: variants.map((v, vi) => ({
            order: vi,
            mediaUrl:       v.mediaUrl       ?? null,
            mediaType:      v.mediaType      ?? null,
            caption:        v.caption        ?? null,
            useTextMessage: v.useTextMessage,
            textMessage:    v.textMessage    ?? null,
            buttons: {
              create: v.buttons.map((b, bi) => ({
                text:               b.text,
                value:              b.value,
                order:              bi,
                useDefaultDelivery: b.useDefaultDelivery,
                customDeliveryUrl:  b.customDeliveryUrl ?? null,
              })),
            },
          })),
        },
      },
      include,
    });
    return { ...updated, paymentStats: await getPaymentStats(params.id) };
  }, { body: remarketingBody })

  // Toggle active
  .patch("/:id/toggle", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const existing = await prisma.remarketing.findFirst({ where: { id: params.id, userId } });
    if (!existing) { set.status = 404; return { error: "Remarketing não encontrado" }; }

    const updated = await prisma.remarketing.update({
      where: { id: params.id },
      data: { active: !existing.active },
      include,
    });
    return { ...updated, paymentStats: await getPaymentStats(params.id) };
  })

  // Manual run trigger
  .post("/:id/run", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const existing = await prisma.remarketing.findFirst({ where: { id: params.id, userId } });
    if (!existing) { set.status = 404; return { error: "Remarketing não encontrado" }; }

    await prisma.remarketing.update({
      where: { id: params.id },
      data: { lastRunAt: null },
    });

    return { ok: true };
  })

  // Delete
  .delete("/:id", async ({ request, params, set }) => {
    const userId = await getUserId(request);
    if (!userId) { set.status = 401; return { error: "Unauthorized" }; }

    const existing = await prisma.remarketing.findFirst({ where: { id: params.id, userId } });
    if (!existing) { set.status = 404; return { error: "Remarketing não encontrado" }; }

    await prisma.remarketing.delete({ where: { id: params.id } });
    return { success: true };
  });

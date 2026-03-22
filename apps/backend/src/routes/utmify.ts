import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";
import { sendUtmifyConversion } from "../services/utmify.js";

const prisma = new PrismaClient();

const trackerInclude = {
  flows: {
    include: {
      flow: {
        select: { id: true, name: true, caption: true, bot: { select: { username: true, name: true } } },
      },
    },
  },
};

const trackerBodySchema = t.Object({
  name:    t.String(),
  token:   t.String(),
  scope:   t.Union([t.Literal("global"), t.Literal("specific")]),
  flowIds: t.Optional(t.Array(t.String())),
});

export const utmifyRoutes = new Elysia({ prefix: "/api/utmify" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get("/", async ({ session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    return prisma.utmifyTracker.findMany({
      where:   { userId: session.user.id },
      include: trackerInclude,
      orderBy: { createdAt: "asc" },
    });
  })
  .post("/", async ({ body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    return prisma.utmifyTracker.create({
      data: {
        userId: session.user.id,
        name:   body.name,
        token:  body.token,
        scope:  body.scope,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: trackerInclude,
    });
  }, { body: trackerBodySchema })
  .put("/:id", async ({ params, body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const tracker = await prisma.utmifyTracker.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!tracker) { set.status = 404; return { error: "Tracker não encontrado." }; }

    await prisma.utmifyTrackerOnFlow.deleteMany({ where: { trackerId: params.id } });

    return prisma.utmifyTracker.update({
      where: { id: params.id },
      data: {
        name:  body.name,
        token: body.token,
        scope: body.scope,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: trackerInclude,
    });
  }, { body: trackerBodySchema })
  .patch("/:id/toggle", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const tracker = await prisma.utmifyTracker.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!tracker) { set.status = 404; return { error: "Tracker não encontrado." }; }

    return prisma.utmifyTracker.update({
      where: { id: params.id },
      data:  { active: !tracker.active },
      include: trackerInclude,
    });
  })
  .delete("/:id", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const tracker = await prisma.utmifyTracker.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!tracker) { set.status = 404; return { error: "Tracker não encontrado." }; }

    await prisma.utmifyTracker.delete({ where: { id: params.id } });
    return { success: true };
  })
  .post("/:id/test", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const tracker = await prisma.utmifyTracker.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!tracker) { set.status = 404; return { error: "Tracker não encontrado." }; }

    const now     = new Date();
    const orderId = `test-${Date.now()}`;

    const result = await sendUtmifyConversion({
      token:         tracker.token,
      orderId,
      amountInCents: 9700,
      isTest:        true,
      customerName:  "Cliente Teste",
      telegramId:    "000000000",
      utmSource:     "facebook",
      utmMedium:     "cpc",
      utmCampaign:   "campanha-teste",
      utmContent:    null,
      utmTerm:       null,
      planName:      "Plano Teste",
      createdAt:     now,
      paidAt:        now,
    });

    if (!result.success) {
      set.status = 400;
      return { success: false, error: result.error, rawResponse: result.rawResponse };
    }

    return { success: true, orderId, rawResponse: result.rawResponse };
  });

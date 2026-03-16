import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

const gatewayInclude = {
  flows: {
    include: {
      flow: {
        include: { bot: { select: { username: true, name: true } } },
      },
    },
  },
};

const gatewayBodySchema = t.Object({
  name: t.String(),
  type: t.Literal("syncpay"),
  apiKey: t.String(),
  apiSecret: t.String(),
  scope: t.Union([t.Literal("global"), t.Literal("specific")]),
  flowIds: t.Optional(t.Array(t.String())),
});

export const gatewayRoutes = new Elysia({ prefix: "/api/gateways" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get("/", async ({ session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    return prisma.gateway.findMany({
      where: { userId: session.user.id },
      include: gatewayInclude,
      orderBy: { order: "asc" },
    });
  })
  .post("/", async ({ body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const count = await prisma.gateway.count({ where: { userId: session.user.id } });

    return prisma.gateway.create({
      data: {
        userId: session.user.id,
        name: body.name,
        type: body.type,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        scope: body.scope,
        order: count,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: gatewayInclude,
    });
  }, { body: gatewayBodySchema })
  // Reorder must come before /:id routes to avoid ambiguity
  .patch("/reorder", async ({ body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    await Promise.all(
      body.ids.map((id, index) =>
        prisma.gateway.updateMany({
          where: { id, userId: session.user.id },
          data: { order: index },
        })
      )
    );

    return { success: true };
  }, { body: t.Object({ ids: t.Array(t.String()) }) })
  .put("/:id", async ({ params, body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const gateway = await prisma.gateway.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!gateway) { set.status = 404; return { error: "Gateway não encontrado." }; }

    await prisma.gatewayOnFlow.deleteMany({ where: { gatewayId: params.id } });

    return prisma.gateway.update({
      where: { id: params.id },
      data: {
        name: body.name,
        type: body.type,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        scope: body.scope,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: gatewayInclude,
    });
  }, { body: gatewayBodySchema })
  .patch("/:id/toggle", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const gateway = await prisma.gateway.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!gateway) { set.status = 404; return { error: "Gateway não encontrado." }; }

    return prisma.gateway.update({
      where: { id: params.id },
      data: { active: !gateway.active },
      include: gatewayInclude,
    });
  })
  .delete("/:id", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const gateway = await prisma.gateway.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!gateway) { set.status = 404; return { error: "Gateway não encontrado." }; }

    await prisma.gateway.delete({ where: { id: params.id } });

    return { success: true };
  });

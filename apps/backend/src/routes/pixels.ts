import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

const pixelInclude = {
  flows: {
    include: {
      flow: {
        select: { id: true, name: true, caption: true, bot: { select: { username: true, name: true } } },
      },
    },
  },
};

const pixelBodySchema = t.Object({
  name:          t.String(),
  pixelId:       t.String(),
  accessToken:   t.String(),
  testEventCode: t.Optional(t.String()),
  scope:         t.Union([t.Literal("global"), t.Literal("specific")]),
  flowIds:       t.Optional(t.Array(t.String())),
});

export const pixelRoutes = new Elysia({ prefix: "/api/pixels" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get("/", async ({ session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    return prisma.pixel.findMany({
      where:   { userId: session.user.id },
      include: pixelInclude,
      orderBy: { createdAt: "asc" },
    });
  })
  .post("/", async ({ body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    return prisma.pixel.create({
      data: {
        userId:        session.user.id,
        name:          body.name,
        pixelId:       body.pixelId,
        accessToken:   body.accessToken,
        testEventCode: body.testEventCode || null,
        scope:         body.scope,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: pixelInclude,
    });
  }, { body: pixelBodySchema })
  .put("/:id", async ({ params, body, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const pixel = await prisma.pixel.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!pixel) { set.status = 404; return { error: "Pixel não encontrado." }; }

    await prisma.pixelOnFlow.deleteMany({ where: { pixelId: params.id } });

    return prisma.pixel.update({
      where: { id: params.id },
      data: {
        name:          body.name,
        pixelId:       body.pixelId,
        accessToken:   body.accessToken,
        testEventCode: body.testEventCode || null,
        scope:         body.scope,
        flows: body.scope === "specific" && body.flowIds?.length
          ? { create: body.flowIds.map((flowId) => ({ flowId })) }
          : undefined,
      },
      include: pixelInclude,
    });
  }, { body: pixelBodySchema })
  .patch("/:id/toggle", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const pixel = await prisma.pixel.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!pixel) { set.status = 404; return { error: "Pixel não encontrado." }; }

    return prisma.pixel.update({
      where: { id: params.id },
      data:  { active: !pixel.active },
      include: pixelInclude,
    });
  })
  .delete("/:id", async ({ params, session, set }) => {
    if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

    const pixel = await prisma.pixel.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!pixel) { set.status = 404; return { error: "Pixel não encontrado." }; }

    await prisma.pixel.delete({ where: { id: params.id } });
    return { success: true };
  });

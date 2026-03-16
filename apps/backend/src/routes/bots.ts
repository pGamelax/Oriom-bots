import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";
import { auth } from "../lib/auth.js";
import { startBot, stopBot } from "../services/bot-manager.js";

const prisma = new PrismaClient();

export const botRoutes = new Elysia({ prefix: "/api/bots" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get("/", async ({ session, set }) => {
    if (!session?.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const bots = await prisma.bot.findMany({
      where: { userId: session.user.id },
      include: { flow: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    });

    return bots;
  })
  .post(
    "/",
    async ({ body, session, set }) => {
      if (!session?.user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const existing = await prisma.bot.findUnique({
        where: { token: body.token },
      });

      if (existing) {
        set.status = 409;
        return { error: "Este token já está em uso." };
      }

      const bot = await prisma.bot.create({
        data: {
          name: body.name,
          username: body.username,
          token: body.token,
          userId: session.user.id,
        },
      });

      startBot(bot.id, bot.token);

      return bot;
    },
    {
      body: t.Object({
        name: t.String(),
        username: t.String(),
        token: t.String(),
      }),
    }
  )
  .get("/:id", async ({ params, session, set }) => {
    if (!session?.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const bot = await prisma.bot.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!bot) {
      set.status = 404;
      return { error: "Bot não encontrado." };
    }

    return bot;
  })
  .put(
    "/:id",
    async ({ params, body, session, set }) => {
      if (!session?.user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const bot = await prisma.bot.findFirst({
        where: { id: params.id, userId: session.user.id },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado." };
      }

      if (body.token !== bot.token) {
        const conflict = await prisma.bot.findUnique({ where: { token: body.token } });
        if (conflict) {
          set.status = 409;
          return { error: "Este token já está em uso." };
        }
      }

      const updated = await prisma.bot.update({
        where: { id: params.id },
        data: { name: body.name, username: body.username, token: body.token },
      });

      // Reinicia com novo token
      startBot(updated.id, updated.token);

      return updated;
    },
    {
      body: t.Object({
        name: t.String(),
        username: t.String(),
        token: t.String(),
      }),
    }
  )
  .delete("/:id", async ({ params, session, set }) => {
    if (!session?.user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const bot = await prisma.bot.findFirst({
      where: { id: params.id, userId: session.user.id },
    });

    if (!bot) {
      set.status = 404;
      return { error: "Bot não encontrado." };
    }

    await stopBot(params.id);
    await prisma.bot.delete({ where: { id: params.id } });

    return { success: true };
  })
  .patch(
    "/:id/toggle",
    async ({ params, session, set }) => {
      if (!session?.user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const bot = await prisma.bot.findFirst({
        where: { id: params.id, userId: session.user.id },
      });

      if (!bot) {
        set.status = 404;
        return { error: "Bot não encontrado." };
      }

      const updated = await prisma.bot.update({
        where: { id: params.id },
        data: { active: !bot.active },
      });

      if (updated.active) {
        startBot(updated.id, updated.token);
      } else {
        await stopBot(updated.id);
      }

      return updated;
    }
  );

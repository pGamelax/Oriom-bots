import Elysia, { t } from "elysia";
import { PrismaClient, Prisma } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

export const leadsRoutes = new Elysia({ prefix: "/api/leads" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get(
    "/stats",
    async ({ session, set, query }) => {
      if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

      const base: Prisma.LeadWhereInput = { userId: session.user.id };
      if (query.from || query.to) {
        base.startedAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }

      const [total, newCount, pendingCount, paidCount, blockedCount] = await Promise.all([
        prisma.lead.count({ where: base }),
        prisma.lead.count({ where: { ...base, status: "new" } }),
        prisma.lead.count({ where: { ...base, status: "pending" } }),
        prisma.lead.count({ where: { ...base, status: "paid" } }),
        prisma.lead.count({ where: { ...base, status: "blocked" } }),
      ]);

      return { total, new: newCount, pending: pendingCount, paid: paidCount, blocked: blockedCount };
    },
    { query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }) }
  )
  .get(
    "/",
    async ({ session, set, query }) => {
      if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

      const where: Prisma.LeadWhereInput = { userId: session.user.id };

      if (query.status) where.status = query.status;
      if (query.botId) where.botId = query.botId;
      if (query.flowId) where.flowId = query.flowId;
      if (query.from || query.to) {
        where.startedAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: "insensitive" } },
          { username: { contains: query.search, mode: "insensitive" } },
          { telegramId: { contains: query.search } },
        ];
      }

      const leads = await prisma.lead.findMany({
        where,
        include: {
          bot: { select: { id: true, name: true, username: true } },
          flow: { select: { id: true, name: true, caption: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 1000,
      });

      return leads;
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        status: t.Optional(t.String()),
        botId: t.Optional(t.String()),
        flowId: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
    }
  );

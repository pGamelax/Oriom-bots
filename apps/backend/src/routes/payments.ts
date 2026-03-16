import Elysia, { t } from "elysia";
import { PrismaClient, Prisma } from "@prisma/client";
import { auth } from "../lib/auth.js";

const prisma = new PrismaClient();

export const paymentsRoutes = new Elysia({ prefix: "/api/payments" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .get(
    "/stats",
    async ({ session, set, query }) => {
      if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

      const base: Prisma.PaymentWhereInput = { userId: session.user.id };
      if (query.from || query.to) {
        base.createdAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }

      const [generated, paid, pending] = await Promise.all([
        prisma.payment.aggregate({ where: base, _count: true, _sum: { amountInCents: true } }),
        prisma.payment.aggregate({ where: { ...base, status: "paid" }, _count: true, _sum: { amountInCents: true } }),
        prisma.payment.aggregate({ where: { ...base, status: "pending" }, _count: true, _sum: { amountInCents: true } }),
      ]);

      return {
        generated: { count: generated._count, total: generated._sum.amountInCents ?? 0 },
        paid:      { count: paid._count,      total: paid._sum.amountInCents ?? 0 },
        pending:   { count: pending._count,   total: pending._sum.amountInCents ?? 0 },
      };
    },
    { query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }) }
  )
  .get(
    "/",
    async ({ session, set, query }) => {
      if (!session?.user) { set.status = 401; return { error: "Unauthorized" }; }

      const where: Prisma.PaymentWhereInput = { userId: session.user.id };

      if (query.status) where.status = query.status;
      if (query.gatewayId) where.gatewayId = query.gatewayId;
      if (query.from || query.to) {
        where.createdAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        };
      }
      if (query.search) {
        where.OR = [
          { telegramName: { contains: query.search, mode: "insensitive" } },
          { telegramId: { contains: query.search } },
          { planName: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          gateway: { select: { id: true, name: true } },
          bot:     { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });

      return payments;
    },
    {
      query: t.Object({
        search:    t.Optional(t.String()),
        status:    t.Optional(t.String()),
        gatewayId: t.Optional(t.String()),
        from:      t.Optional(t.String()),
        to:        t.Optional(t.String()),
      }),
    }
  );

import Elysia from "elysia";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const redirectRoutes = new Elysia().get(
  "/r/:token",
  async ({ params }) => {
    const record = await prisma.linkCloak.findUnique({
      where: { token: params.token },
      select: { targetUrl: true },
    });

    if (!record) {
      return new Response("Not found.", { status: 404 });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: record.targetUrl },
    });
  }
);

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth.js";
import { botRoutes } from "./routes/bots.js";
import { flowRoutes } from "./routes/flows.js";
import { gatewayRoutes } from "./routes/gateways.js";
import { leadsRoutes } from "./routes/leads.js";
import { paymentsRoutes } from "./routes/payments.js";
import { pixelRoutes } from "./routes/pixels.js";
import { trackingRoutes } from "./routes/tracking.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { remarketingRoutes } from "./routes/remarketings.js";
import { startAllBots } from "./services/bot-manager.js";
import { startRemarketingScheduler } from "./services/remarketing-scheduler.js";

const app = new Elysia({ adapter: node() })
  .use(
    cors({
      origin: [
        process.env.FRONTEND_URL ?? "http://localhost:5173",
      ],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  )
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(botRoutes)
  .use(flowRoutes)
  .use(gatewayRoutes)
  .use(leadsRoutes)
  .use(paymentsRoutes)
  .use(pixelRoutes)
  .use(trackingRoutes)
  .use(webhookRoutes)
  .use(remarketingRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(process.env.PORT ?? 3000);

console.log(`Server running at http://localhost:${app.server?.port}`);

// Suppress unhandled GramJS TIMEOUT errors from update loop
process.on("unhandledRejection", (reason: any) => {
  const msg = String(reason?.message ?? reason ?? "");
  if (msg.includes("TIMEOUT")) return; // GramJS internal, safe to ignore
  console.error("[UnhandledRejection]", reason);
});

startAllBots();
startRemarketingScheduler();

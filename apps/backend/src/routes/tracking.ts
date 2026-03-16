import Elysia, { t } from "elysia";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Tracking routes — no auth required.
 *
 * Flow:
 *  1. Facebook ad destination URL → GET /track/:botUsername?fbclid=IwAR...
 *  2. Server generates fbc, creates ClickToken, returns HTML page
 *  3. HTML JS reads _fbp cookie and POSTs to /track/fbp before redirecting
 *  4. Redirect → https://t.me/:botUsername?start=:token
 *  5. User opens bot → /start :token → bot attaches fbc/fbp to the Lead
 */
export const trackingRoutes = new Elysia()
  // ── GET /track/:botUsername ──────────────────────────────────────────────
  .get(
    "/track/:botUsername",
    async ({ params, query, set }) => {
      const bot = await prisma.bot.findFirst({
        where: { username: params.botUsername, active: true },
        select: { id: true, username: true },
      });

      if (!bot) {
        set.status = 404;
        return "Bot not found.";
      }

      const fbclid = (query as Record<string, string>).fbclid ?? null;

      // fbc format: fb.<version>.<creation_time_secs>.<fbclid>
      const fbc = fbclid
        ? `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`
        : null;

      const clickToken = await prisma.clickToken.create({
        data: { botId: bot.id, fbc },
      });

      const telegramUrl = `https://t.me/${bot.username}?start=${clickToken.token}`;
      const fbpEndpoint = "/track/fbp";

      set.headers["Content-Type"] = "text/html; charset=utf-8";
      set.headers["Cache-Control"] = "no-store";

      // The page:
      // 1. Reads _fbp from cookie via JS (set by FB Pixel SDK on prior visits)
      // 2. POSTs it to /track/fbp so we can attach it to the ClickToken
      // 3. Immediately redirects to Telegram deep link
      return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecionando...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; font-family: system-ui, sans-serif;
           background: #f0f2f5; color: #1c1e21; }
    .box { text-align: center; padding: 2rem; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e4e6ea;
               border-top-color: #1877f2; border-radius: 50%;
               animation: spin .7s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg) } }
  </style>
</head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>Redirecionando para o Telegram...</p>
</div>
<script>
(function () {
  var tokenId   = ${JSON.stringify(clickToken.id)};
  var targetUrl = ${JSON.stringify(telegramUrl)};
  var fbpUrl    = ${JSON.stringify(fbpEndpoint)};

  // Parse _fbp from cookies
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function redirect() { window.location.replace(targetUrl); }

  var fbp = getCookie('_fbp');
  if (fbp) {
    fetch(fbpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId: tokenId, fbp: fbp }),
    }).finally(redirect);
  } else {
    redirect();
  }
})();
</script>
</body>
</html>`;
    }
  )

  // ── POST /track/fbp ──────────────────────────────────────────────────────
  // Called by the browser JS above to store the _fbp cookie value.
  .post(
    "/track/fbp",
    async ({ body }) => {
      await prisma.clickToken.update({
        where: { id: body.tokenId },
        data:  { fbp: body.fbp },
      }).catch(() => {}); // ignore if token doesn't exist
      return { ok: true };
    },
    {
      body: t.Object({
        tokenId: t.String(),
        fbp:     t.String(),
      }),
    }
  );

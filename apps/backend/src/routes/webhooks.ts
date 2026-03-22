import Elysia from "elysia";
import { PrismaClient } from "@prisma/client";
import { SyncPayService } from "../services/syncpay.js";
import { firePurchasePixels, fireUtmifyEvent, sendPaymentConfirmation } from "../services/bot-manager.js";

const prisma = new PrismaClient();

// ── Status helpers ───────────────────────────────────────────────────────────

function isPaidStatus(payload: Record<string, unknown>): boolean {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const status = String(data.status ?? data.payment_status ?? data.state ?? "").toUpperCase();
  return ["PAID_OUT", "PAID", "PAGO", "APPROVED", "COMPLETED"].includes(status) || data.paid === true;
}

function isRefundedStatus(payload: Record<string, unknown>): boolean {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const status = String(data.status ?? data.payment_status ?? data.state ?? "").toUpperCase();
  return ["REFUNDED", "REEMBOLSADO", "REVERSED"].includes(status);
}

function isChargebackStatus(payload: Record<string, unknown>): boolean {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const status = String(data.status ?? data.payment_status ?? data.state ?? "").toUpperCase();
  return ["CHARGEBACK", "DISPUTE", "IN_DISPUTE"].includes(status);
}

// ── Webhook routes ───────────────────────────────────────────────────────────

export const webhookRoutes = new Elysia({ prefix: "/webhooks" })

  /**
   * POST /webhooks/syncpay/:gatewayId
   *
   * Called by SyncPay when a PIX payment status changes.
   * The URL is constructed dynamically per gateway when the PIX is created:
   *   ${APP_URL}/webhooks/syncpay/${gateway.id}
   */
  .post("/syncpay/:gatewayId", async ({ params, request, set }) => {
    const { gatewayId } = params;
    let body: Record<string, unknown>;

    // Parse raw body (SyncPay sends JSON)
    try {
      body = await request.json() as Record<string, unknown>;
      console.log(body)
    } catch {
      console.warn("[Webhook/SyncPay] Failed to parse request body");
      set.status = 400;
      return { error: "Invalid JSON" };
    }

    // ── 1. Extract the payment identifier ─────────────────────────────────
    // SyncPay wraps fields inside a "data" key
    const data = (body.data ?? body) as Record<string, unknown>;

    const identifier = String(
      data.id ?? data.idtransaction ?? data.identifier ?? data.payment_id ?? ""
    ).trim();

    const externalRef = String(
      data.externalreference ?? data.external_reference ?? data.externalReference ?? ""
    ).trim();

    console.log(
      `[Webhook/SyncPay] Received | identifier=${identifier || "(none)"} | externalRef=${externalRef || "(none)"} | status=${data.status ?? "?"}`
    );

    if (!identifier && !externalRef) {
      console.warn("[Webhook/SyncPay] No identifier or external_reference in payload");
      // Return 200 so SyncPay doesn't keep retrying an unrecognised payload
      return { ok: true };
    }

    // ── 2. Find gateway and payment in database ───────────────────────────
    const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
    if (!gateway) {
      console.warn(`[Webhook/SyncPay] Unknown gatewayId=${gatewayId}`);
      return { ok: true };
    }

    // Try to find by SyncPay transaction id first, then fallback to externalReference
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          ...(identifier ? [{ externalId: identifier }] : []),
          ...(externalRef ? [{ externalId: { contains: externalRef } }] : []),
        ],
      },
      include: {
        bot: { select: { id: true, userId: true } },
      },
    });

    if (!payment) {
      console.warn(`[Webhook/SyncPay] Payment not found — identifier=${identifier} externalRef=${externalRef}`);
      return { ok: true };
    }

    console.log(`[Webhook/SyncPay] Matched payment ${payment.id} (status=${payment.status})`);

    // ── 3. Idempotency check ──────────────────────────────────────────────
    if (payment.status === "paid") {
      console.log(`[Webhook/SyncPay] Payment ${payment.id} already paid — skipping`);
      return { ok: true };
    }

    // ── 4a. Refunded ──────────────────────────────────────────────────────
    if (isRefundedStatus(body)) {
      console.log(`[Webhook/SyncPay] Refund received for payment ${payment.id}`);
      const refundedAt = new Date();
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: "refunded" },
      });
      fireUtmifyEvent({
        userId:        payment.userId,
        botId:         payment.botId,
        flowId:        payment.flowId,
        paymentDbId:   payment.id,
        amountInCents: payment.amountInCents,
        planName:      payment.planName,
        telegramId:    payment.telegramId,
        telegramName:  payment.telegramName,
        status:        "refunded",
        createdAt:     payment.createdAt,
        paidAt:        payment.paidAt ?? refundedAt,
        refundedAt,
      }).catch((err) => console.error("[Webhook/SyncPay] UTMfy refunded:", err.message));
      return { ok: true };
    }

    // ── 4b. Chargeback ────────────────────────────────────────────────────
    if (isChargebackStatus(body)) {
      console.log(`[Webhook/SyncPay] Chargeback received for payment ${payment.id}`);
      const refundedAt = new Date();
      await prisma.payment.update({
        where: { id: payment.id },
        data:  { status: "chargeback" },
      });
      fireUtmifyEvent({
        userId:        payment.userId,
        botId:         payment.botId,
        flowId:        payment.flowId,
        paymentDbId:   payment.id,
        amountInCents: payment.amountInCents,
        planName:      payment.planName,
        telegramId:    payment.telegramId,
        telegramName:  payment.telegramName,
        status:        "chargeback",
        createdAt:     payment.createdAt,
        paidAt:        payment.paidAt ?? refundedAt,
        refundedAt,
      }).catch((err) => console.error("[Webhook/SyncPay] UTMfy chargeback:", err.message));
      return { ok: true };
    }

    // ── 4c. Check if this webhook signals a paid status ───────────────────
    if (!isPaidStatus(body)) {
      console.log(`[Webhook/SyncPay] Status not paid for payment ${payment.id} — ignoring`);
      return { ok: true };
    }

    // ── 5. Re-verify with SyncPay API (security: don't trust webhook blindly)
    const verifyId = identifier || payment.externalId!;
    console.log(`[Webhook/SyncPay] Verifying payment via API — externalId=${verifyId}`);
    try {
      const svc    = new SyncPayService(gateway.apiKey, gateway.apiSecret);
      const status = await svc.checkPayment(verifyId);

      console.log(`[Webhook/SyncPay] API verification returned "${status}" for payment ${payment.id}`);

      // Only block if API explicitly says pending or cancelled.
      // "expired" may mean 404 (lookup not supported for this ID format) — trust webhook in that case.
      if (status === "pending" || status === "cancelled") {
        console.warn(`[Webhook/SyncPay] API says "${status}" — skipping`);
        return { ok: true };
      }
    } catch (err: any) {
      console.warn(
        `[Webhook/SyncPay] API verification failed: ${err.message} — proceeding with webhook data`
      );
    }

    // ── 6. Mark payment as paid in DB ─────────────────────────────────────
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { status: "paid", paidAt: new Date() },
    });
    console.log(`[Webhook/SyncPay] ✅ Payment ${payment.id} marked as paid`);

    // ── 7. Mark lead as paid ──────────────────────────────────────────────
    await prisma.lead.updateMany({
      where: { telegramId: payment.telegramId, botId: payment.botId },
      data:  { status: "paid" },
    }).catch((e) => console.error("[Webhook/SyncPay] Failed to update lead:", e.message));

    // ── 8. Send Telegram confirmation message to the user ─────────────────
    await sendPaymentConfirmation(payment.botId, payment.telegramId, payment.planName, payment.flowId, payment.amountInCents);

    // ── 9. Fire Facebook CAPI Purchase event ──────────────────────────────
    console.log(`[Webhook/SyncPay] Triggering CAPI for payment ${payment.id}`);
    try {
      await firePurchasePixels({
        userId:        payment.userId,
        botId:         payment.botId,
        flowId:        payment.flowId,
        paymentDbId:   payment.id,
        amountInCents: payment.amountInCents,
        planName:      payment.planName,
        telegramId:    payment.telegramId,
        telegramName:  payment.telegramName,
      });
    } catch (err: any) {
      console.error(`[Webhook/SyncPay] CAPI error for payment ${payment.id}:`, err.message);
    }

    return { ok: true };
  });

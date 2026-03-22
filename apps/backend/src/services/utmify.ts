// ── Types ───────────────────────────────────────────────────────────────────

export interface UtmifyConversionPayload {
  token: string;
  orderId: string;
  amountInCents: number;
  isTest?: boolean;
  // Customer
  customerName: string | null;
  telegramId: string;
  // UTM params (captured at redirect)
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  // Plan
  planName: string | null;
  // Dates
  createdAt: Date;
  paidAt: Date;
}

export interface UtmifyResult {
  success: boolean;
  error?: string;
  rawResponse?: unknown;
}

// ── Main function ────────────────────────────────────────────────────────────

export async function sendUtmifyConversion(
  payload: UtmifyConversionPayload
): Promise<UtmifyResult> {
  const tag = `[UTMfy] orderId=${payload.orderId}`;

  console.log(`${tag} → Sending order | value=R$${(payload.amountInCents / 100).toFixed(2)}`);

  const productName = payload.planName ?? "Produto";
  const isoCreated  = payload.createdAt.toISOString().replace("Z", "");
  const isoPaid     = payload.paidAt.toISOString().replace("Z", "");

  const body = {
    isTest:        payload.isTest ?? false,
    orderId:       payload.orderId,
    platform:      "Telegram",
    paymentMethod: "pix",
    status:        "paid",
    createdAt:     isoCreated,
    approvedDate:  isoPaid,
    customer: {
      name:     payload.customerName ?? `Telegram ${payload.telegramId}`,
      email:    `${payload.telegramId}@telegram.bot`,
      phone:    null,
      document: null,
    },
    products: [
      {
        id:          payload.orderId,
        name:        productName,
        planId:      payload.orderId,
        planName:    productName,
        quantity:    1,
        priceInCents: payload.amountInCents,
      },
    ],
    commission: {
      totalPriceInCents:      payload.amountInCents,
      gatewayFeeInCents:      0,
      userCommissionInCents:  payload.amountInCents,
    },
    trackingParameters: {
      utm_source:   payload.utmSource,
      utm_medium:   payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_content:  payload.utmContent,
      utm_term:     payload.utmTerm,
      src:          null,
      sck:          null,
    },
  };

  let res: Response;
  try {
    res = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": payload.token,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr: any) {
    const msg = `Network error: ${networkErr.message}`;
    console.error(`${tag} ❌ ${msg}`);
    return { success: false, error: msg };
  }

  let json: unknown = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg = `HTTP ${res.status}`;
    console.error(`${tag} ❌ ${msg}`, JSON.stringify(json));
    return { success: false, error: msg, rawResponse: json };
  }

  console.log(`${tag} ✅ Order tracked successfully`);
  return { success: true, rawResponse: json };
}

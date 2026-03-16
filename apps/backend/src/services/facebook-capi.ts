import crypto from "node:crypto";

// ── Hashing helpers ─────────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface PurchaseEventPayload {
  // Pixel credentials
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;

  // Event deduplication
  eventId?: string;

  // Purchase data
  amountInCents: number;
  currency?: string;
  planName?: string | null;

  // User identity — hashed by this service where required
  telegramId: string;        // → external_id (NOT hashed per spec)
  firstName?: string | null; // → fn  (hashed)
  lastName?: string | null;  // → ln  (hashed)
  email?: string | null;     // → em  (hashed)
  phone?: string | null;     // → ph  (hashed, digits only)
  zipCode?: string | null;   // → zp  (hashed)
  dateOfBirth?: string | null; // → db (hashed, YYYYMMDD)
  country?: string | null;   // → country (hashed, 2-letter ISO)
  city?: string | null;      // → ct  (hashed)
  state?: string | null;     // → st  (hashed, 2-letter)

  // NOT hashed
  ipAddress?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface CAPIResult {
  success: boolean;
  pixelId: string;
  eventsReceived: number;
  error?: string;
  rawResponse?: unknown;
}

// ── Main function ────────────────────────────────────────────────────────────

export async function sendFacebookPurchaseEvent(
  payload: PurchaseEventPayload
): Promise<CAPIResult> {
  const tag = `[FacebookCAPI] pixel=${payload.pixelId} eventId=${payload.eventId ?? "?"}`;

  const userData: Record<string, unknown> = {};

  // NOT hashed
  userData.external_id = [payload.telegramId];
  if (payload.ipAddress)  userData.client_ip_address = payload.ipAddress;
  if (payload.userAgent)  userData.client_user_agent = payload.userAgent;
  if (payload.fbp)        userData.fbp = payload.fbp;
  if (payload.fbc)        userData.fbc = payload.fbc;

  // Hashed (SHA-256, lowercase)
  if (payload.email)       userData.em      = [sha256(payload.email)];
  if (payload.phone)       userData.ph      = [sha256(normalizePhone(payload.phone))];
  if (payload.firstName)   userData.fn      = [sha256(payload.firstName)];
  if (payload.lastName)    userData.ln      = [sha256(payload.lastName)];
  if (payload.city)        userData.ct      = [sha256(payload.city)];
  if (payload.state)       userData.st      = [sha256(payload.state)];
  if (payload.zipCode)     userData.zp      = [sha256(payload.zipCode)];
  if (payload.dateOfBirth) userData.db      = [sha256(payload.dateOfBirth)];
  if (payload.country)     userData.country = [sha256(payload.country)];

  const value    = payload.amountInCents / 100;
  const currency = payload.currency ?? "BRL";

  const eventData: Record<string, unknown> = {
    event_name:    "Purchase",
    event_time:    Math.floor(Date.now() / 1000),
    action_source: "other",
    user_data:     userData,
    custom_data: {
      value,
      currency,
      num_items: 1,
      content_type: "product",
      ...(payload.planName && {
        content_name: payload.planName,
        contents: [{ id: payload.planName, quantity: 1, item_price: value }],
      }),
    },
  };

  if (payload.eventId) eventData.event_id = payload.eventId;

  const requestBody: Record<string, unknown> = { data: [eventData] };
  if (payload.testEventCode) requestBody.test_event_code = payload.testEventCode;

  // Log what's being sent (without access token)
  const sentFields = Object.keys(userData).join(", ");
  console.log(
    `${tag} → Sending Purchase | value=R$${value.toFixed(2)} | fbc=${payload.fbc ?? "none"} | fbp=${payload.fbp ?? "none"} | fields=[${sentFields}]${payload.testEventCode ? ` | testCode=${payload.testEventCode}` : ""}`
  );

  const url = `https://graph.facebook.com/v19.0/${payload.pixelId}/events?access_token=${payload.accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(requestBody),
    });
  } catch (networkErr: any) {
    const msg = `Network error: ${networkErr.message}`;
    console.error(`${tag} ❌ ${msg}`);
    return { success: false, pixelId: payload.pixelId, eventsReceived: 0, error: msg };
  }

  let json: Record<string, unknown> = {};
  try {
    json = await res.json() as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const apiError = (json as any)?.error;
    const msg = apiError
      ? `API ${res.status}: [${apiError.code}] ${apiError.message}`
      : `HTTP ${res.status}`;
    console.error(`${tag} ❌ ${msg}`);
    console.error(`${tag} ❌ Full response:`, JSON.stringify(json));
    return { success: false, pixelId: payload.pixelId, eventsReceived: 0, error: msg, rawResponse: json };
  }

  const eventsReceived: number = (json as any)?.events_received ?? 0;

  if (eventsReceived === 0) {
    console.warn(`${tag} ⚠️  events_received=0 — check payload or pixel configuration`);
    console.warn(`${tag} ⚠️  Response:`, JSON.stringify(json));
    return { success: true, pixelId: payload.pixelId, eventsReceived: 0, rawResponse: json };
  }

  console.log(`${tag} ✅ events_received=${eventsReceived} — Purchase tracked successfully`);
  return { success: true, pixelId: payload.pixelId, eventsReceived };
}

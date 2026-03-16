export interface PixResponse {
  id: string;
  pixCode: string;
  qrCode?: string;
  expiresAt: Date;
}

export interface PixOptions {
  description?: string;
  clientName?: string;
  clientCpf?: string;
  clientEmail?: string;
  clientPhone?: string;
  webhookUrl?: string;
  externalReference?: string;
}

export type PaymentStatus = "pending" | "paid" | "expired" | "cancelled";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout após ${timeoutMs / 1000}s ao conectar em ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class SyncPayService {
  private readonly baseUrl = "https://api.syncpayments.com.br";
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const res = await fetchWithTimeout(`${this.baseUrl}/api/partner/v1/auth-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SyncPay auth falhou [${res.status}]: ${body.slice(0, 300)}`);
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data["access_token"]) {
      throw new Error(`SyncPay auth: access_token ausente na resposta`);
    }

    this.accessToken = String(data["access_token"]);

    if (data["expires_at"]) {
      this.tokenExpiresAt = new Date(String(data["expires_at"])).getTime() - 60_000;
    } else {
      const expiresIn = typeof data["expires_in"] === "number" ? data["expires_in"] : 3600;
      this.tokenExpiresAt = Date.now() + expiresIn * 1_000 - 60_000;
    }

    return this.accessToken;
  }

  async createPix(amountInCents: number, options: PixOptions = {}): Promise<PixResponse> {
    const token = await this.getToken();

    const body: Record<string, unknown> = {
      amount: amountInCents / 100,
      description: options.description ?? "Pagamento via Telegram Bot",
    };

    if (options.webhookUrl) body.webhook_url = options.webhookUrl;
    if (options.externalReference) body.external_reference = options.externalReference;

    if (options.clientName || options.clientCpf || options.clientEmail || options.clientPhone) {
      const client: Record<string, string> = {};
      if (options.clientName) client.name = options.clientName;
      if (options.clientCpf) client.cpf = options.clientCpf.replace(/\D/g, "");
      if (options.clientEmail) client.email = options.clientEmail;
      if (options.clientPhone) client.phone = options.clientPhone.replace(/\D/g, "");
      body.client = client;
    }

    const res = await fetchWithTimeout(`${this.baseUrl}/api/partner/v1/cash-in`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`SyncPay createPix falhou [${res.status}]: ${err.slice(0, 300)}`);
    }

    const data = await res.json() as Record<string, unknown>;

    if (!data["identifier"] || !data["pix_code"]) {
      throw new Error(
        `SyncPay createPix: resposta inesperada — ${JSON.stringify(data).slice(0, 300)}`
      );
    }

    const rawExpiry = data["expires_at"] ?? data["expiresAt"];
    const expiresAt = rawExpiry
      ? new Date(String(rawExpiry))
      : new Date(Date.now() + 30 * 60 * 1_000);

    return {
      id: String(data["identifier"]),
      pixCode: String(data["pix_code"]),
      qrCode: data["qr_code_image"] != null
        ? String(data["qr_code_image"])
        : data["qrCodeImage"] != null
          ? String(data["qrCodeImage"])
          : data["qr_code"] != null
            ? String(data["qr_code"])
            : undefined,
      expiresAt,
    };
  }

  async checkPayment(paymentId: string): Promise<PaymentStatus> {
    const token = await this.getToken();

    const res = await fetchWithTimeout(
      `${this.baseUrl}/api/partner/v1/cash-in/${paymentId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      if (res.status === 404) return "expired";
      throw new Error(`SyncPay checkPayment falhou [${res.status}]`);
    }

    const raw = await res.json() as Record<string, unknown>;
    // SyncPay may wrap fields inside a "data" key
    const data = (raw["data"] ?? raw) as Record<string, unknown>;
    const status = String(data.status ?? data.payment_status ?? data.state ?? "").toLowerCase();

    if (["paid", "paid_out", "pago", "approved"].includes(status) || data.paid === true) return "paid";
    if (["expired", "expirado"].includes(status) || data.expired === true) return "expired";
    if (["cancelled", "cancelado", "canceled"].includes(status) || data.cancelled === true)
      return "cancelled";

    return "pending";
  }
}

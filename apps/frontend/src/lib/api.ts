const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error ?? "Erro na requisição");
  }

  return res.json() as Promise<T>;
}

export interface Bot {
  id: string;
  name: string;
  username: string;
  token: string;
  active: boolean;
  flow?: { id: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlowButton {
  id: string;
  text: string;
  value: number;
  order: number;
  useDefaultDelivery: boolean;
  customDeliveryUrl: string | null;
}

export interface Flow {
  id: string;
  botId: string;
  bot: Bot;
  name: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  useTextMessage: boolean;
  textMessage: string | null;
  defaultDeliveryUrl: string | null;
  pixQrCaption: string | null;
  pixHowToPay: string | null;
  pixCopyLabel: string | null;
  pixAfterLabel: string | null;
  buttons: FlowButton[];
  createdAt: string;
  updatedAt: string;
}

export interface FlowPayload {
  botId: string;
  name?: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  useTextMessage: boolean;
  textMessage?: string;
  defaultDeliveryUrl?: string;
  pixQrCaption?: string;
  pixHowToPay?: string;
  pixCopyLabel?: string;
  pixAfterLabel?: string;
  buttons: {
    text: string;
    value: number;
    order: number;
    useDefaultDelivery: boolean;
    customDeliveryUrl?: string;
  }[];
}

export const flowsApi = {
  list: () => request<Flow[]>("/api/flows"),
  get: (id: string) => request<Flow>(`/api/flows/${id}`),
  create: (data: FlowPayload) =>
    request<Flow>("/api/flows", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: FlowPayload) =>
    request<Flow>(`/api/flows/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/flows/${id}`, { method: "DELETE" }),
};

export interface GatewayFlow {
  gatewayId: string;
  flowId: string;
  flow: {
    id: string;
    caption: string;
    bot: { username: string; name: string };
  };
}

export interface Gateway {
  id: string;
  name: string;
  type: "syncpay";
  apiKey: string;
  apiSecret: string;
  scope: "global" | "specific";
  order: number;
  active: boolean;
  flows: GatewayFlow[];
  createdAt: string;
  updatedAt: string;
}

export interface GatewayPayload {
  name: string;
  type: "syncpay";
  apiKey: string;
  apiSecret: string;
  scope: "global" | "specific";
  flowIds?: string[];
}

export const gatewaysApi = {
  list: () => request<Gateway[]>("/api/gateways"),
  create: (data: GatewayPayload) =>
    request<Gateway>("/api/gateways", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: GatewayPayload) =>
    request<Gateway>(`/api/gateways/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  reorder: (ids: string[]) =>
    request<{ success: boolean }>("/api/gateways/reorder", { method: "PATCH", body: JSON.stringify({ ids }) }),
  toggle: (id: string) =>
    request<Gateway>(`/api/gateways/${id}/toggle`, { method: "PATCH" }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/gateways/${id}`, { method: "DELETE" }),
};

export interface Lead {
  id: string;
  telegramId: string;
  name: string | null;
  username: string | null;
  botId: string;
  bot: { id: string; name: string; username: string };
  flowId: string | null;
  flow: { id: string; name: string | null; caption: string } | null;
  status: "new" | "pending" | "paid" | "blocked";
  planName: string | null;
  planValue: number | null;
  startedAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  new: number;
  pending: number;
  paid: number;
  blocked: number;
}

export interface LeadFilters {
  search?: string;
  status?: string;
  botId?: string;
  flowId?: string;
  from?: string;
  to?: string;
}

export interface Payment {
  id: string;
  externalId: string | null;
  userId: string;
  gatewayId: string | null;
  gateway: { id: string; name: string } | null;
  botId: string;
  bot: { id: string; username: string };
  flowId: string | null;
  telegramId: string;
  telegramName: string | null;
  planName: string | null;
  amountInCents: number;
  status: "pending" | "paid" | "expired" | "cancelled";
  pixCode: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentStats {
  generated: { count: number; total: number };
  paid:      { count: number; total: number };
  pending:   { count: number; total: number };
}

export interface PaymentFilters {
  search?: string;
  status?: string;
  gatewayId?: string;
  from?: string;
  to?: string;
}

export const paymentsApi = {
  stats: (filters?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (filters?.from) p.set("from", filters.from);
    if (filters?.to) p.set("to", filters.to);
    const qs = p.toString();
    return request<PaymentStats>(`/api/payments/stats${qs ? "?" + qs : ""}`);
  },
  list: (filters?: PaymentFilters) => {
    const p = new URLSearchParams();
    if (filters?.search)    p.set("search", filters.search);
    if (filters?.status)    p.set("status", filters.status);
    if (filters?.gatewayId) p.set("gatewayId", filters.gatewayId);
    if (filters?.from)      p.set("from", filters.from);
    if (filters?.to)        p.set("to", filters.to);
    const qs = p.toString();
    return request<Payment[]>(`/api/payments${qs ? "?" + qs : ""}`);
  },
};

export interface ChatMessage {
  from: "user" | "bot";
  type: "text" | "photo" | "video" | "sticker" | "other";
  text?: string;
  caption?: string;
  mediaUrl?: string;
  timestamp: number;
}

export const leadsApi = {
  list: (filters?: LeadFilters) => {
    const p = new URLSearchParams();
    if (filters?.search) p.set("search", filters.search);
    if (filters?.status) p.set("status", filters.status);
    if (filters?.botId) p.set("botId", filters.botId);
    if (filters?.flowId) p.set("flowId", filters.flowId);
    if (filters?.from) p.set("from", filters.from);
    if (filters?.to) p.set("to", filters.to);
    const qs = p.toString();
    return request<Lead[]>(`/api/leads${qs ? "?" + qs : ""}`);
  },
  stats: (filters?: { from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (filters?.from) p.set("from", filters.from);
    if (filters?.to) p.set("to", filters.to);
    const qs = p.toString();
    return request<LeadStats>(`/api/leads/stats${qs ? "?" + qs : ""}`);
  },
  chat: (botId: string, telegramId: string) =>
    request<ChatMessage[]>(`/api/leads/chat?botId=${botId}&telegramId=${telegramId}`),
};

export interface PixelFlow {
  pixelId: string;
  flowId: string;
  flow: {
    id: string;
    name: string | null;
    caption: string;
    bot: { username: string; name: string };
  };
}

export interface Pixel {
  id: string;
  name: string;
  pixelId: string;
  accessToken: string;
  testEventCode: string | null;
  scope: "global" | "specific";
  active: boolean;
  flows: PixelFlow[];
  createdAt: string;
  updatedAt: string;
}

export interface PixelPayload {
  name: string;
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
  scope: "global" | "specific";
  flowIds?: string[];
}

export const pixelsApi = {
  list: () => request<Pixel[]>("/api/pixels"),
  create: (data: PixelPayload) =>
    request<Pixel>("/api/pixels", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: PixelPayload) =>
    request<Pixel>(`/api/pixels/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) =>
    request<Pixel>(`/api/pixels/${id}/toggle`, { method: "PATCH" }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/pixels/${id}`, { method: "DELETE" }),
};

export interface RemarketingButton {
  id: string;
  text: string;
  value: number;
  order: number;
  useDefaultDelivery: boolean;
  customDeliveryUrl: string | null;
}

export interface RemarketingVariant {
  id: string;
  order: number;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  caption: string | null;
  useTextMessage: boolean;
  textMessage: string | null;
  buttons: RemarketingButton[];
}

export interface RemarketingLog {
  id: string;
  remarketingId: string;
  startedAt: string;
  finishedAt: string | null;
  sent: number;
  blocked: number;
}

export interface RemarketingPaymentStats {
  generated: number;
  paid: number;
  revenueInCents: number;
}

export interface Remarketing {
  id: string;
  userId: string;
  flowId: string;
  flow: {
    id: string;
    name: string | null;
    caption: string;
    bot: { id: string; username: string; name: string };
  };
  name: string;
  active: boolean;
  targetAudience: "all" | "new" | "pending" | "paid";
  intervalMinutes: number;
  startAfterMinutes: number;
  defaultDeliveryUrl: string | null;
  currentVariantIndex: number;
  variants: RemarketingVariant[];
  logs: RemarketingLog[];
  paymentStats: RemarketingPaymentStats;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemarketingPayload {
  flowId: string;
  name: string;
  targetAudience: "all" | "new" | "pending" | "paid";
  intervalMinutes: number;
  startAfterMinutes: number;
  defaultDeliveryUrl?: string;
  variants: {
    mediaUrl?: string;
    mediaType?: "image" | "video";
    caption?: string;
    useTextMessage: boolean;
    textMessage?: string;
    buttons: {
      text: string;
      value: number;
      order: number;
      useDefaultDelivery: boolean;
      customDeliveryUrl?: string;
    }[];
  }[];
}

export const remarketingsApi = {
  list: () => request<Remarketing[]>("/api/remarketings"),
  create: (data: RemarketingPayload) =>
    request<Remarketing>("/api/remarketings", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: RemarketingPayload) =>
    request<Remarketing>(`/api/remarketings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggle: (id: string) =>
    request<Remarketing>(`/api/remarketings/${id}/toggle`, { method: "PATCH" }),
  run: (id: string) =>
    request<{ ok: boolean }>(`/api/remarketings/${id}/run`, { method: "POST" }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/remarketings/${id}`, { method: "DELETE" }),
};

export const botsApi = {
  list: () => request<Bot[]>("/api/bots"),
  get: (id: string) => request<Bot>(`/api/bots/${id}`),
  create: (data: { name: string; username: string; token: string }) =>
    request<Bot>("/api/bots", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; username: string; token: string }) =>
    request<Bot>(`/api/bots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ success: boolean }>(`/api/bots/${id}`, { method: "DELETE" }),
  toggle: (id: string) =>
    request<Bot>(`/api/bots/${id}/toggle`, { method: "PATCH" }),
};

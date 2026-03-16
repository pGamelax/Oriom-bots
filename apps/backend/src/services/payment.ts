import { PrismaClient } from "@prisma/client";
import { SyncPayService, type PixOptions, type PixResponse, type PaymentStatus } from "./syncpay.js";

const prisma = new PrismaClient();

type GatewayRow = {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  apiSecret: string;
  scope: string;
  flows: { flowId: string }[];
};

function buildService(gateway: GatewayRow): SyncPayService {
  if (gateway.type === "syncpay") {
    return new SyncPayService(gateway.apiKey, gateway.apiSecret);
  }
  throw new Error(`Tipo de gateway não suportado: ${gateway.type}`);
}

/**
 * Retorna os gateways ativos do usuário aplicáveis ao fluxo, em ordem de prioridade.
 * Gateways globais são usados quando nenhum específico cobre o fluxo.
 */
async function resolveGateways(userId: string, flowId?: string): Promise<GatewayRow[]> {
  const all = await prisma.gateway.findMany({
    where: { userId, active: true },
    include: { flows: { select: { flowId: true } } },
    orderBy: { order: "asc" },
  });

  if (!flowId) return all.filter((g) => g.scope === "global");

  const specific = all.filter(
    (g) => g.scope === "specific" && g.flows.some((f) => f.flowId === flowId)
  );

  // Se há gateways específicos para este fluxo, use apenas eles; senão use globais
  return specific.length > 0
    ? specific
    : all.filter((g) => g.scope === "global");
}

/**
 * Cria uma cobrança PIX tentando os gateways em ordem de prioridade.
 * Se um gateway falhar, tenta o próximo.
 * Se não houver próximo, tenta novamente no mesmo antes de lançar erro.
 */
export async function createPixPayment(
  userId: string,
  amountInCents: number,
  options: PixOptions & { flowId?: string } = {}
): Promise<PixResponse & { gatewayId: string }> {
  const { flowId, ...pixOptions } = options;
  const gateways = await resolveGateways(userId, flowId);

  if (gateways.length === 0) {
    throw new Error("Nenhum gateway de pagamento ativo configurado para este fluxo.");
  }

  let lastError: Error = new Error("Erro desconhecido");

  for (let i = 0; i < gateways.length; i++) {
    const gateway = gateways[i];
    const isLast = i === gateways.length - 1;
    const attempts = isLast ? 2 : 1; // Retry no último gateway

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Payment] Tentativa ${attempt} no gateway "${gateway.name}"...`);
        }
        const service = buildService(gateway);
        const appUrl = process.env.APP_URL?.replace(/\/$/, "");
        const webhookUrl = appUrl ? `${appUrl}/webhooks/syncpay/${gateway.id}` : undefined;
        const result = await service.createPix(amountInCents, { ...pixOptions, webhookUrl });
        return { ...result, gatewayId: gateway.id };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[Payment] Gateway "${gateway.name}" falhou (tentativa ${attempt}):`,
          lastError.message
        );
      }
    }
  }

  throw new Error(`Falha ao processar pagamento: ${lastError.message}`);
}

/**
 * Verifica o status de um pagamento num gateway específico.
 */
export async function checkPixPayment(
  userId: string,
  gatewayId: string,
  paymentId: string
): Promise<PaymentStatus> {
  const gateway = await prisma.gateway.findFirst({
    where: { id: gatewayId, userId, active: true },
    include: { flows: { select: { flowId: true } } },
  });

  if (!gateway) throw new Error("Gateway não encontrado.");

  const service = buildService(gateway);
  return service.checkPayment(paymentId);
}

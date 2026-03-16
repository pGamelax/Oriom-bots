-- CreateTable
CREATE TABLE "Gateway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayOnFlow" (
    "gatewayId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,

    CONSTRAINT "GatewayOnFlow_pkey" PRIMARY KEY ("gatewayId","flowId")
);

-- AddForeignKey
ALTER TABLE "Gateway" ADD CONSTRAINT "Gateway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayOnFlow" ADD CONSTRAINT "GatewayOnFlow_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayOnFlow" ADD CONSTRAINT "GatewayOnFlow_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

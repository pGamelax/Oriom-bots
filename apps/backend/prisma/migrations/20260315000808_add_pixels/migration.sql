-- CreateTable
CREATE TABLE "Pixel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pixelId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "testEventCode" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pixel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixelOnFlow" (
    "pixelId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,

    CONSTRAINT "PixelOnFlow_pkey" PRIMARY KEY ("pixelId","flowId")
);

-- AddForeignKey
ALTER TABLE "Pixel" ADD CONSTRAINT "Pixel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelOnFlow" ADD CONSTRAINT "PixelOnFlow_pixelId_fkey" FOREIGN KEY ("pixelId") REFERENCES "Pixel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelOnFlow" ADD CONSTRAINT "PixelOnFlow_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

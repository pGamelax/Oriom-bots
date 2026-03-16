-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "fbc" TEXT,
ADD COLUMN     "fbp" TEXT;

-- CreateTable
CREATE TABLE "ClickToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "botId" TEXT,
    "fbc" TEXT,
    "fbp" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClickToken_token_key" ON "ClickToken"("token");

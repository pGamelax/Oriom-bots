-- AlterTable
ALTER TABLE "Flow" ADD COLUMN     "defaultDeliveryUrl" TEXT;

-- AlterTable
ALTER TABLE "FlowButton" ADD COLUMN     "customDeliveryUrl" TEXT,
ADD COLUMN     "useDefaultDelivery" BOOLEAN NOT NULL DEFAULT true;

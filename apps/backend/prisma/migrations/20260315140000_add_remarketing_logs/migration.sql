-- CreateTable
CREATE TABLE "RemarketingLog" (
    "id"            TEXT NOT NULL,
    "remarketingId" TEXT NOT NULL,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"    TIMESTAMP(3),
    "sent"          INTEGER NOT NULL DEFAULT 0,
    "blocked"       INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RemarketingLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RemarketingLog" ADD CONSTRAINT "RemarketingLog_remarketingId_fkey"
    FOREIGN KEY ("remarketingId") REFERENCES "Remarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add remarketingId to Payment
ALTER TABLE "Payment" ADD COLUMN "remarketingId" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_remarketingId_fkey"
    FOREIGN KEY ("remarketingId") REFERENCES "Remarketing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

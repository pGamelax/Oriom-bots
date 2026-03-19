-- AlterTable UserBot: add intervalMinutes
ALTER TABLE "UserBot" ADD COLUMN "intervalMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable UserBotQueueEntry: drop mediaFileId, add mediaUrl
ALTER TABLE "UserBotQueueEntry" DROP COLUMN IF EXISTS "mediaFileId";
ALTER TABLE "UserBotQueueEntry" ADD COLUMN "mediaUrl" TEXT;

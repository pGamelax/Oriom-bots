-- CreateTable
CREATE TABLE "UserBot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "apiId" INTEGER NOT NULL,
    "apiHash" TEXT NOT NULL,
    "session" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBotSourceGroup" (
    "id" TEXT NOT NULL,
    "userBotId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupUsername" TEXT,

    CONSTRAINT "UserBotSourceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBotTargetGroup" (
    "id" TEXT NOT NULL,
    "userBotId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupUsername" TEXT,

    CONSTRAINT "UserBotTargetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBotQueueEntry" (
    "id" TEXT NOT NULL,
    "userBotId" TEXT NOT NULL,
    "text" TEXT,
    "mediaType" TEXT,
    "mediaFileId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBotQueueEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserBot" ADD CONSTRAINT "UserBot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBotSourceGroup" ADD CONSTRAINT "UserBotSourceGroup_userBotId_fkey" FOREIGN KEY ("userBotId") REFERENCES "UserBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBotTargetGroup" ADD CONSTRAINT "UserBotTargetGroup_userBotId_fkey" FOREIGN KEY ("userBotId") REFERENCES "UserBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBotQueueEntry" ADD CONSTRAINT "UserBotQueueEntry_userBotId_fkey" FOREIGN KEY ("userBotId") REFERENCES "UserBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

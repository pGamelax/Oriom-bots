CREATE TABLE "Remarketing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "targetAudience" TEXT NOT NULL,
    "intervalHours" INTEGER NOT NULL DEFAULT 1,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "caption" TEXT,
    "useTextMessage" BOOLEAN NOT NULL DEFAULT false,
    "textMessage" TEXT,
    "defaultDeliveryUrl" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remarketing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemarketingButton" (
    "id" TEXT NOT NULL,
    "remarketingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "useDefaultDelivery" BOOLEAN NOT NULL DEFAULT true,
    "customDeliveryUrl" TEXT,

    CONSTRAINT "RemarketingButton_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Remarketing" ADD CONSTRAINT "Remarketing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Remarketing" ADD CONSTRAINT "Remarketing_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemarketingButton" ADD CONSTRAINT "RemarketingButton_remarketingId_fkey" FOREIGN KEY ("remarketingId") REFERENCES "Remarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

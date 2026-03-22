-- Add utmifyClickId to ClickToken
ALTER TABLE "ClickToken" ADD COLUMN "utmifyClickId" TEXT;

-- Add utmifyClickId to Lead
ALTER TABLE "Lead" ADD COLUMN "utmifyClickId" TEXT;

-- Create UtmifyTracker table
CREATE TABLE "UtmifyTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtmifyTracker_pkey" PRIMARY KEY ("id")
);

-- Create UtmifyTrackerOnFlow table
CREATE TABLE "UtmifyTrackerOnFlow" (
    "trackerId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,

    CONSTRAINT "UtmifyTrackerOnFlow_pkey" PRIMARY KEY ("trackerId","flowId")
);

-- Add foreign keys
ALTER TABLE "UtmifyTracker" ADD CONSTRAINT "UtmifyTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UtmifyTrackerOnFlow" ADD CONSTRAINT "UtmifyTrackerOnFlow_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "UtmifyTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UtmifyTrackerOnFlow" ADD CONSTRAINT "UtmifyTrackerOnFlow_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

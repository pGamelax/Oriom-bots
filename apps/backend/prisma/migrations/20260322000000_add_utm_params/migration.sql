-- Add UTM parameter fields to ClickToken
ALTER TABLE "ClickToken" ADD COLUMN "utmSource"   TEXT;
ALTER TABLE "ClickToken" ADD COLUMN "utmMedium"   TEXT;
ALTER TABLE "ClickToken" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "ClickToken" ADD COLUMN "utmContent"  TEXT;
ALTER TABLE "ClickToken" ADD COLUMN "utmTerm"     TEXT;

-- Add UTM parameter fields to Lead
ALTER TABLE "Lead" ADD COLUMN "utmSource"   TEXT;
ALTER TABLE "Lead" ADD COLUMN "utmMedium"   TEXT;
ALTER TABLE "Lead" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Lead" ADD COLUMN "utmContent"  TEXT;
ALTER TABLE "Lead" ADD COLUMN "utmTerm"     TEXT;

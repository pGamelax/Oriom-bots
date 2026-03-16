-- CreateTable: RemarketingVariant
CREATE TABLE "RemarketingVariant" (
    "id" TEXT NOT NULL,
    "remarketingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "caption" TEXT,
    "useTextMessage" BOOLEAN NOT NULL DEFAULT false,
    "textMessage" TEXT,
    CONSTRAINT "RemarketingVariant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RemarketingVariant" ADD CONSTRAINT "RemarketingVariant_remarketingId_fkey"
    FOREIGN KEY ("remarketingId") REFERENCES "Remarketing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add currentVariantIndex to Remarketing
ALTER TABLE "Remarketing" ADD COLUMN "currentVariantIndex" INTEGER NOT NULL DEFAULT 0;

-- Add variantId to RemarketingButton (nullable first for data migration)
ALTER TABLE "RemarketingButton" ADD COLUMN "variantId" TEXT;

-- Migrate existing data: create one variant per remarketing
DO $$
DECLARE
    r RECORD;
    v_id TEXT;
BEGIN
    FOR r IN SELECT id, "mediaUrl", "mediaType", "caption", "useTextMessage", "textMessage" FROM "Remarketing" LOOP
        v_id := gen_random_uuid()::TEXT;
        INSERT INTO "RemarketingVariant" ("id", "remarketingId", "order", "mediaUrl", "mediaType", "caption", "useTextMessage", "textMessage")
        VALUES (v_id, r.id, 0, r."mediaUrl", r."mediaType", r."caption", r."useTextMessage", r."textMessage");

        UPDATE "RemarketingButton"
        SET "variantId" = v_id
        WHERE "remarketingId" = r.id;
    END LOOP;
END $$;

-- Drop old FK on RemarketingButton.remarketingId
ALTER TABLE "RemarketingButton" DROP CONSTRAINT IF EXISTS "RemarketingButton_remarketingId_fkey";

-- Make variantId NOT NULL
ALTER TABLE "RemarketingButton" ALTER COLUMN "variantId" SET NOT NULL;

-- AddForeignKey: RemarketingButton -> RemarketingVariant
ALTER TABLE "RemarketingButton" ADD CONSTRAINT "RemarketingButton_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "RemarketingVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old column from RemarketingButton
ALTER TABLE "RemarketingButton" DROP COLUMN "remarketingId";

-- Drop old columns from Remarketing
ALTER TABLE "Remarketing" DROP COLUMN "mediaUrl";
ALTER TABLE "Remarketing" DROP COLUMN "mediaType";
ALTER TABLE "Remarketing" DROP COLUMN "caption";
ALTER TABLE "Remarketing" DROP COLUMN "useTextMessage";
ALTER TABLE "Remarketing" DROP COLUMN "textMessage";

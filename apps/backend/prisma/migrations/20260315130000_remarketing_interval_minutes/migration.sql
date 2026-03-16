ALTER TABLE "Remarketing" RENAME COLUMN "intervalHours" TO "intervalMinutes";
ALTER TABLE "Remarketing" ALTER COLUMN "intervalMinutes" SET DEFAULT 60;

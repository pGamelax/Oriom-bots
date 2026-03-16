/*
  Warnings:

  - Added the required column `apiSecret` to the `Gateway` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Gateway" ADD COLUMN     "apiSecret" TEXT NOT NULL;

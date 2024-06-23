/*
  Warnings:

  - Added the required column `wager` to the `CardGroup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CardGroup" ADD COLUMN     "wager" INTEGER NOT NULL;

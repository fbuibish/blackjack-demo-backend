/*
  Warnings:

  - You are about to drop the column `isSplit` on the `CardGroup` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - Added the required column `isDealer` to the `CardGroup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score` to the `Round` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CardGroup" DROP COLUMN "isSplit",
ADD COLUMN     "isDealer" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "score" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt",
ALTER COLUMN "name" SET NOT NULL;

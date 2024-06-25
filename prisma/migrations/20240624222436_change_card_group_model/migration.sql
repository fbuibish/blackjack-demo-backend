/*
  Warnings:

  - You are about to drop the column `outcome` on the `Hand` table. All the data in the column will be lost.
  - You are about to drop the `CardGroup` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `isActive` to the `Hand` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('win', 'lose', 'push');

-- DropForeignKey
ALTER TABLE "CardGroup" DROP CONSTRAINT "CardGroup_handId_fkey";

-- AlterTable
ALTER TABLE "Hand" DROP COLUMN "outcome",
ADD COLUMN     "isActive" BOOLEAN NOT NULL;

-- DropTable
DROP TABLE "CardGroup";

-- CreateTable
CREATE TABLE "DealerHand" (
    "id" SERIAL NOT NULL,
    "handId" INTEGER NOT NULL,
    "cards" TEXT NOT NULL,

    CONSTRAINT "DealerHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerHand" (
    "id" SERIAL NOT NULL,
    "handId" INTEGER NOT NULL,
    "cards" TEXT NOT NULL,
    "isDealer" BOOLEAN NOT NULL,
    "wager" INTEGER NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerHand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealerHand_handId_key" ON "DealerHand"("handId");

-- AddForeignKey
ALTER TABLE "DealerHand" ADD CONSTRAINT "DealerHand_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerHand" ADD CONSTRAINT "PlayerHand_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

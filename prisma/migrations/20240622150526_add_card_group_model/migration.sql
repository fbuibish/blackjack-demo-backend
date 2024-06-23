/*
  Warnings:

  - You are about to drop the column `dealerHand` on the `Hand` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `Hand` table. All the data in the column will be lost.
  - You are about to drop the column `playerHand` on the `Hand` table. All the data in the column will be lost.
  - You are about to drop the `Game` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `roundId` to the `Hand` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_userId_fkey";

-- DropForeignKey
ALTER TABLE "Hand" DROP CONSTRAINT "Hand_gameId_fkey";

-- AlterTable
ALTER TABLE "Hand" DROP COLUMN "dealerHand",
DROP COLUMN "gameId",
DROP COLUMN "playerHand",
ADD COLUMN     "roundId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Game";

-- CreateTable
CREATE TABLE "Round" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "shoe" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "aiAssisted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardGroup" (
    "id" SERIAL NOT NULL,
    "handId" INTEGER NOT NULL,
    "cards" TEXT NOT NULL,
    "isSplit" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardGroup_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGroup" ADD CONSTRAINT "CardGroup_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

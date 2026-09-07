/*
  Warnings:

  - A unique constraint covering the columns `[lichessName]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chesscomName]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chesscomName" TEXT,
ADD COLUMN     "lichessName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_lichessName_key" ON "User"("lichessName");

-- CreateIndex
CREATE UNIQUE INDEX "User_chesscomName_key" ON "User"("chesscomName");

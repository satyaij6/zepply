-- CreateEnum
CREATE TYPE "DraftKind" AS ENUM ('POST', 'CAROUSEL', 'REEL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "niche" TEXT,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "path" TEXT;

-- AlterTable
ALTER TABLE "BrandKit" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "font" TEXT,
ADD COLUMN     "offerings" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "themes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "voice" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DraftKind" NOT NULL,
    "headline" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "source" TEXT NOT NULL DEFAULT 'onboarding',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_userId_createdAt_idx" ON "Draft"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- People who signed up before onboarding existed skip it
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP, "onboardingStep" = 6 WHERE "onboardedAt" IS NULL;

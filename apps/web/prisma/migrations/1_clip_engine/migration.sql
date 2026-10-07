-- CreateEnum
CREATE TYPE "ClipJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClipSourceKind" AS ENUM ('UPLOAD', 'YOUTUBE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canCreateVideos" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ClipJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "sourceKind" "ClipSourceKind" NOT NULL,
    "sourcePath" TEXT,
    "sourceUrl" TEXT,
    "ownsContent" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'te',
    "clipCount" INTEGER NOT NULL DEFAULT 5,
    "style" TEXT NOT NULL DEFAULT 'clean',
    "captionPos" TEXT NOT NULL DEFAULT 'bottom',
    "status" "ClipJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sourceSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT,
    "reason" TEXT,
    "format" TEXT,
    "hookScore" DOUBLE PRECISION,
    "standaloneScore" DOUBLE PRECISION,
    "coherenceScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "durationSec" DOUBLE PRECISION,
    "videoPath" TEXT NOT NULL,
    "captionsPath" TEXT,
    "thumbPath" TEXT,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClipJob_status_createdAt_idx" ON "ClipJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClipJob_userId_createdAt_idx" ON "ClipJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Clip_jobId_rank_idx" ON "Clip"("jobId", "rank");

-- AddForeignKey
ALTER TABLE "ClipJob" ADD CONSTRAINT "ClipJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClipJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;


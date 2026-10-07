-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "handle" TEXT,
    "about" TEXT,
    "location" TEXT,
    "accent" TEXT NOT NULL DEFAULT '#3D7EFF',
    "logoPath" TEXT,
    "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'promo-classic',
    "format" TEXT NOT NULL,
    "length" TEXT NOT NULL DEFAULT 'standard',
    "music" TEXT NOT NULL DEFAULT 'upbeat',
    "variables" JSONB NOT NULL,
    "status" "ClipJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "outputPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_userId_key" ON "BrandKit"("userId");

-- CreateIndex
CREATE INDEX "ReelJob_status_createdAt_idx" ON "ReelJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReelJob_userId_createdAt_idx" ON "ReelJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelJob_groupId_idx" ON "ReelJob"("groupId");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelJob" ADD CONSTRAINT "ReelJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


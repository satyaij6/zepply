-- AlterTable
ALTER TABLE "ClipJob" ADD COLUMN     "template" TEXT NOT NULL DEFAULT 'simple',
ADD COLUMN     "brollLook" TEXT NOT NULL DEFAULT 'editorial',
ADD COLUMN     "cardLayout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ctaKeyword" TEXT,
ADD COLUMN     "ctaLink" TEXT,
ADD COLUMN     "triggerId" TEXT,
ADD COLUMN     "bundlePath" TEXT,
ADD COLUMN     "parentJobId" TEXT,
ADD COLUMN     "onlyRank" INTEGER;

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "variantOf" TEXT;

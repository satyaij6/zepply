-- AlterTable
ALTER TABLE "ClipJob" ADD COLUMN     "layout" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "effects" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceKit" JSONB;

-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "coverPath" TEXT,
ADD COLUMN     "titles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[];

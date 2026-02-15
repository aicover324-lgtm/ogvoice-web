CREATE TYPE "BackingVocalMode" AS ENUM ('do_not_convert', 'convert');

ALTER TABLE "GenerationJob"
ADD COLUMN "pitch" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "searchFeatureRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
ADD COLUMN "addBackVocals" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "backingVocalMode" "BackingVocalMode" NOT NULL DEFAULT 'do_not_convert';

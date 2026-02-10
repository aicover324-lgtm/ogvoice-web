-- Add new UploadAssetType enum values for image uploads.
-- Use a guarded DO block so this migration is safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UploadAssetType' AND e.enumlabel = 'avatar_image'
  ) THEN
    ALTER TYPE "UploadAssetType" ADD VALUE 'avatar_image';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UploadAssetType' AND e.enumlabel = 'voice_cover_image'
  ) THEN
    ALTER TYPE "UploadAssetType" ADD VALUE 'voice_cover_image';
  END IF;
END $$;

-- NOTE: This migration has an earlier timestamp than the initial schema migration.
-- On a fresh database, the UploadAsset table does not exist yet when this migration runs.
-- To keep migrations applyable in order, we guard these indexes behind a table existence check.
DO $$
BEGIN
  IF to_regclass('public."UploadAsset"') IS NOT NULL THEN
    -- Prevent race condition: only 1 draft dataset per user (voiceProfileId IS NULL)
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "UploadAsset_userId_draftDataset_unique"\n'
            'ON "UploadAsset" ("userId")\n'
            'WHERE ("type" = ''dataset_audio'' AND "voiceProfileId" IS NULL)';

    -- Only 1 dataset asset per voice profile
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "UploadAsset_voiceProfileId_dataset_unique"\n'
            'ON "UploadAsset" ("voiceProfileId")\n'
            'WHERE ("type" = ''dataset_audio'' AND "voiceProfileId" IS NOT NULL)';
  END IF;
END $$;

type TrainingKeyArgs = {
  userId: string;
  voiceProfileId: string;
  jobId: string;
};

const SAFE_KEY_PART_RE = /^[a-zA-Z0-9_-]+$/;

function assertSafeKeyPart(value: string, label: string) {
  if (!value || typeof value !== "string") throw new Error(`Missing ${label}`);
  if (value.trim() !== value) throw new Error(`Invalid ${label}`);
  if (value.length > 128) throw new Error(`Invalid ${label}`);
  // Prevent path traversal / prefix escape.
  // Prisma IDs are cuid() so they should already be safe, but we enforce anyway.
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error(`Invalid ${label}`);
  }
  // Keep it to safe key segments (cuid/uuid-friendly).
  if (!SAFE_KEY_PART_RE.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function trainingPrefix(args: TrainingKeyArgs) {
  assertSafeKeyPart(args.userId, "userId");
  assertSafeKeyPart(args.voiceProfileId, "voiceProfileId");
  assertSafeKeyPart(args.jobId, "jobId");
  return `u/${args.userId}/v/${args.voiceProfileId}/j/${args.jobId}`;
}

// Dataset wav for a specific training job
export function trainingDatasetWavKey(args: TrainingKeyArgs) {
  return `datasets/${trainingPrefix(args)}/dataset.wav`;
}

// Zipped inference artifact (e.g. model.pth + index)
export function trainingModelZipKey(args: TrainingKeyArgs) {
  return `models/${trainingPrefix(args)}/model.zip`;
}

// Optional: training log artifact
export function trainingLogKey(args: TrainingKeyArgs) {
  return `models/${trainingPrefix(args)}/train.log`;
}

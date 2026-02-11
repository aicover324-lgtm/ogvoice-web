type TrainingKeyArgs = {
  userId: string;
  voiceProfileId: string;
  jobId: string;
};

type TrainingNamedKeyArgs = TrainingKeyArgs & {
  voiceName: string;
};

type VoiceKeyArgs = {
  userId: string;
  voiceProfileId: string;
};

type VoiceNamedKeyArgs = VoiceKeyArgs & {
  voiceName: string;
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

function voicePrefix(args: VoiceKeyArgs) {
  assertSafeKeyPart(args.userId, "userId");
  assertSafeKeyPart(args.voiceProfileId, "voiceProfileId");
  return `u/${args.userId}/v/${args.voiceProfileId}`;
}

export function canonicalVoiceAssetBaseName(voiceName: string) {
  if (!voiceName || typeof voiceName !== "string") return "voice";
  const stem = voiceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stem || "voice";
}

// Dataset wav for a specific training job
export function trainingDatasetWavKey(args: TrainingNamedKeyArgs) {
  return `datasets/${trainingPrefix(args)}/${canonicalVoiceAssetBaseName(args.voiceName)}.wav`;
}

// Zipped inference artifact (e.g. model.pth + index)
export function trainingModelZipKey(args: TrainingNamedKeyArgs) {
  return `models/${trainingPrefix(args)}/${canonicalVoiceAssetBaseName(args.voiceName)}.zip`;
}

// Optional: training log artifact
export function trainingLogKey(args: TrainingKeyArgs) {
  return `models/${trainingPrefix(args)}/train.log`;
}

export function voiceDatasetWavKey(args: VoiceNamedKeyArgs) {
  return `datasets/${voicePrefix(args)}/${canonicalVoiceAssetBaseName(args.voiceName)}.wav`;
}

// Long-term dataset archive (lossless, smaller than WAV)
export function voiceDatasetFlacKey(args: VoiceNamedKeyArgs) {
  return `datasets/${voicePrefix(args)}/${canonicalVoiceAssetBaseName(args.voiceName)}.flac`;
}

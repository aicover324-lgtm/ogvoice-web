import { getObjectRangeBytes } from "@/lib/storage/s3";

const HEADER_READ_BYTES = 256 * 1024;
const ANALYZE_READ_BYTES = 8 * 1024 * 1024;

type WavInfo = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  blockAlign: number;
  dataOffset: number;
  dataSize: number;
  durationSec: number;
};

type PrecheckMetrics = {
  durationSec: number;
  sampleRate: number;
  channels: number;
  peak: number;
  rms: number;
  silenceRatio: number;
  clipRatio: number;
};

type PrecheckResult =
  | { ok: true; details: PrecheckMetrics }
  | { ok: false; reason: string; details?: Partial<PrecheckMetrics> };

export async function precheckDatasetWav(args: {
  storageKey: string;
  fileSize: number;
  fileName: string;
  mimeType: string;
}): Promise<PrecheckResult> {
  const lower = args.fileName.toLowerCase();
  if (!lower.endsWith(".wav")) return { ok: false, reason: "Dataset must be a .wav file." };

  const mime = args.mimeType.toLowerCase();
  if (mime && mime !== "audio/wav" && mime !== "audio/x-wav") {
    return { ok: false, reason: "Dataset must be a .wav file." };
  }

  if (!Number.isFinite(args.fileSize) || args.fileSize < 64 * 1024) {
    return { ok: false, reason: "Dataset file is too small." };
  }

  const headerEnd = Math.min(args.fileSize - 1, HEADER_READ_BYTES - 1);
  if (headerEnd < 63) return { ok: false, reason: "Dataset .wav header is invalid." };

  const header = await getObjectRangeBytes({
    key: args.storageKey,
    start: 0,
    end: headerEnd,
    maxBytes: HEADER_READ_BYTES,
  });

  const wav = parseWavHeader(header);
  if (!wav) return { ok: false, reason: "Dataset .wav header is invalid." };

  const baseDetails = {
    durationSec: wav.durationSec,
    sampleRate: wav.sampleRate,
    channels: wav.channels,
  };

  if (![1, 3].includes(wav.audioFormat)) {
    return { ok: false, reason: "Unsupported wav encoding. Please upload PCM or float wav.", details: baseDetails };
  }

  if (wav.channels < 1 || wav.channels > 2) {
    return { ok: false, reason: "Dataset must be mono or stereo.", details: baseDetails };
  }

  if (wav.sampleRate < 16000) {
    return { ok: false, reason: "Dataset sample rate is too low (minimum 16 kHz).", details: baseDetails };
  }

  if (wav.durationSec < 20) {
    return { ok: false, reason: "Dataset is too short. Please upload at least 20 seconds.", details: baseDetails };
  }

  if (wav.durationSec > 60 * 30) {
    return { ok: false, reason: "Dataset is too long. Please keep it under 30 minutes.", details: baseDetails };
  }

  const analyzeBytes = Math.min(wav.dataSize, ANALYZE_READ_BYTES);
  if (analyzeBytes < wav.blockAlign * 50) {
    return { ok: false, reason: "Dataset does not contain enough audio frames.", details: baseDetails };
  }

  const dataEnd = wav.dataOffset + analyzeBytes - 1;
  const dataBuf = await getObjectRangeBytes({
    key: args.storageKey,
    start: wav.dataOffset,
    end: dataEnd,
    maxBytes: ANALYZE_READ_BYTES,
  });

  const quality = analyzeQuality({
    data: dataBuf,
    audioFormat: wav.audioFormat,
    bitsPerSample: wav.bitsPerSample,
    blockAlign: wav.blockAlign,
  });

  if (!quality.valid) {
    return { ok: false, reason: "Unsupported wav bit depth.", details: baseDetails };
  }

  const details: PrecheckMetrics = {
    ...baseDetails,
    peak: quality.peak,
    rms: quality.rms,
    silenceRatio: quality.silenceRatio,
    clipRatio: quality.clipRatio,
  };

  if (quality.peak < 0.06 || quality.rms < 0.01 || quality.silenceRatio > 0.985) {
    return { ok: false, reason: "Dataset audio is too silent. Please upload a cleaner vocal take.", details };
  }

  if (quality.clipRatio > 0.18) {
    return { ok: false, reason: "Dataset audio is heavily clipped. Please lower input gain and re-record.", details };
  }

  return {
    ok: true,
    details,
  };
}

function parseWavHeader(buf: Buffer): WavInfo | null {
  if (buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null;

  let fmt: {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    byteRate: number;
    blockAlign: number;
    bitsPerSample: number;
  } | null = null;
  let dataOffset = -1;
  let dataSize = -1;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;

    if (id === "fmt " && size >= 16 && end <= buf.length) {
      fmt = {
        audioFormat: buf.readUInt16LE(start),
        channels: buf.readUInt16LE(start + 2),
        sampleRate: buf.readUInt32LE(start + 4),
        byteRate: buf.readUInt32LE(start + 8),
        blockAlign: buf.readUInt16LE(start + 12),
        bitsPerSample: buf.readUInt16LE(start + 14),
      };
    }

    if (id === "data") {
      dataOffset = start;
      dataSize = size;
      break;
    }

    offset = end + (size % 2);
  }

  if (!fmt || dataOffset < 0 || dataSize <= 0) return null;
  if (fmt.byteRate <= 0 || fmt.blockAlign <= 0) return null;

  const durationSec = dataSize / fmt.byteRate;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null;

  return {
    audioFormat: fmt.audioFormat,
    channels: fmt.channels,
    sampleRate: fmt.sampleRate,
    bitsPerSample: fmt.bitsPerSample,
    blockAlign: fmt.blockAlign,
    dataOffset,
    dataSize,
    durationSec,
  };
}

function analyzeQuality(args: {
  data: Buffer;
  audioFormat: number;
  bitsPerSample: number;
  blockAlign: number;
}): {
  valid: boolean;
  peak: number;
  rms: number;
  silenceRatio: number;
  clipRatio: number;
} {
  const frames = Math.floor(args.data.length / args.blockAlign);
  if (frames <= 0) {
    return { valid: false, peak: 0, rms: 0, silenceRatio: 1, clipRatio: 0 };
  }

  const maxSamples = 150000;
  const step = Math.max(1, Math.floor(frames / maxSamples));

  let count = 0;
  let silence = 0;
  let clipped = 0;
  let peak = 0;
  let energy = 0;

  for (let frame = 0; frame < frames; frame += step) {
    const i = frame * args.blockAlign;
    const amp = decodeFirstChannelAmplitude(args.data, i, args.audioFormat, args.bitsPerSample);
    if (!Number.isFinite(amp)) {
      return { valid: false, peak: 0, rms: 0, silenceRatio: 1, clipRatio: 0 };
    }
    const abs = Math.min(1, Math.max(0, Math.abs(amp)));
    if (abs > peak) peak = abs;
    energy += abs * abs;
    if (abs < 0.01) silence += 1;
    if (abs >= 0.995) clipped += 1;
    count += 1;
  }

  if (count === 0) {
    return { valid: false, peak: 0, rms: 0, silenceRatio: 1, clipRatio: 0 };
  }

  return {
    valid: true,
    peak,
    rms: Math.sqrt(energy / count),
    silenceRatio: silence / count,
    clipRatio: clipped / count,
  };
}

function decodeFirstChannelAmplitude(buf: Buffer, offset: number, audioFormat: number, bitsPerSample: number) {
  if (audioFormat === 1 && bitsPerSample === 16) {
    if (offset + 2 > buf.length) return NaN;
    return buf.readInt16LE(offset) / 32768;
  }

  if (audioFormat === 1 && bitsPerSample === 24) {
    if (offset + 3 > buf.length) return NaN;
    const b0 = buf[offset] ?? 0;
    const b1 = buf[offset + 1] ?? 0;
    const b2 = buf[offset + 2] ?? 0;
    let v = b0 | (b1 << 8) | (b2 << 16);
    if (v & 0x800000) v |= ~0xffffff;
    return v / 8388608;
  }

  if (audioFormat === 1 && bitsPerSample === 32) {
    if (offset + 4 > buf.length) return NaN;
    return buf.readInt32LE(offset) / 2147483648;
  }

  if (audioFormat === 3 && bitsPerSample === 32) {
    if (offset + 4 > buf.length) return NaN;
    return buf.readFloatLE(offset);
  }

  return NaN;
}

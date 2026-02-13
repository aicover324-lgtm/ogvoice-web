import { z } from "zod";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runpodRun } from "@/lib/runpod";

const schema = z.object({
  jobId: z.string().min(1),
  userId: z.string().min(1),
  voiceProfileId: z.string().min(1),
  inputAssetId: z.string().min(1),
  inputStorageKey: z.string().min(1),
  modelArtifactKey: z.string().min(1),
  config: z.unknown(),
});

const allowedExportFormats = new Set(["WAV", "MP3", "FLAC", "OGG", "M4A"]);

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid cover dispatch payload",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const rvc = asRecord(asRecord(data.config)?.rvc);
  const audioSeparation = asRecord(asRecord(data.config)?.audioSeparation);
  const postProcess = asRecord(asRecord(data.config)?.postProcess);

  const pitch = clampInt(asNumber(rvc?.pitch, 0), -24, 24);
  const searchFeatureRatio = clamp(asNumber(rvc?.searchFeatureRatio, 0.75), 0, 1);
  const splitAudio = asBoolean(rvc?.splitAudio, true);
  const protect = clamp(asNumber(rvc?.protectVoicelessConsonants, 0.33), 0, 0.5);
  const f0Method = asNonEmptyString(rvc?.pitchExtractor, "rmvpe");
  const embedderModel = asNonEmptyString(rvc?.embedderModel, "contentvec");
  const addBackVocals = asBoolean(audioSeparation?.addBackVocals, false);
  const backVocalMode = asNonEmptyString(audioSeparation?.backVocalMode, "do_not_convert");
  const convertBackVocals = addBackVocals && backVocalMode === "convert";

  const requestedFormat = asNonEmptyString(postProcess?.exportFormat, "WAV").toUpperCase();
  const exportFormat = allowedExportFormats.has(requestedFormat) ? requestedFormat : "WAV";
  const outExt = exportFormat.toLowerCase();

  const outKey = `outputs/u/${safeSegment(data.userId)}/v/${safeSegment(data.voiceProfileId)}/j/${safeSegment(data.jobId)}/cover.${outExt}`;

  try {
    const runRes = await runpodRun({
      mode: "infer",
      modelKey: data.modelArtifactKey,
      inputKey: data.inputStorageKey,
      outKey,
      pitch,
      searchFeatureRatio,
      splitAudio,
      protect,
      f0Method,
      embedderModel,
      exportFormat,
      addBackVocals,
      convertBackVocals,
      mixWithInput: true,
    });

    return NextResponse.json({
      requestId: runRes.id,
      status: "QUEUED",
      outKey,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Cover dispatch failed",
      },
      { status: 502 }
    );
  }
}

function isAuthorized(req: Request) {
  const token = env.COVER_ENGINE_TOKEN;
  if (!token) return true;

  const header = req.headers.get("authorization") || "";
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value === token;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function asNonEmptyString(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  return t || fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.trunc(clamp(value, min, max));
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128) || "x";
}

export const runtime = "nodejs";

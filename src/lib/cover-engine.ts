import { env } from "@/lib/env";

export type CoverEngineDispatchPayload = {
  jobId: string;
  userId: string;
  voiceProfileId: string;
  inputAssetId: string;
  inputStorageKey: string;
  modelArtifactKey: string;
  config: unknown;
};

export type CoverEngineStatusResponse = {
  status: string;
  progress: number | null;
  outputKey: string | null;
  outputBytes: number | null;
  errorMessage: string | null;
  raw: Record<string, unknown>;
};

export async function dispatchCoverEngineJob(payload: CoverEngineDispatchPayload) {
  if (!env.COVER_ENGINE_URL) {
    throw new Error("Cover engine is not configured yet.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (env.COVER_ENGINE_TOKEN) {
    headers.Authorization = `Bearer ${env.COVER_ENGINE_TOKEN}`;
  }

  const res = await fetch(env.COVER_ENGINE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore non-json bodies
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && json && "error" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).error)
        : text || `Cover engine request failed (${res.status}).`;
    throw new Error(msg);
  }

  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const requestId = [body.requestId, body.id, body.jobId].find((x) => typeof x === "string") as
    | string
    | undefined;

  return {
    requestId: requestId || null,
    raw: body,
  };
}

export async function pollCoverEngineJob(requestId: string): Promise<CoverEngineStatusResponse> {
  if (!env.COVER_ENGINE_URL) {
    throw new Error("Cover engine is not configured yet.");
  }

  const headers: Record<string, string> = {};
  if (env.COVER_ENGINE_TOKEN) {
    headers.Authorization = `Bearer ${env.COVER_ENGINE_TOKEN}`;
  }

  const statusUrl = buildCoverEngineStatusUrl(requestId);
  const res = await fetch(statusUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore non-json bodies
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "error" in (json as Record<string, unknown>)
        ? String((json as Record<string, unknown>).error)
        : text || `Cover engine status request failed (${res.status}).`;
    throw new Error(msg);
  }

  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const nestedOutput = body.output && typeof body.output === "object" ? (body.output as Record<string, unknown>) : null;
  const outputKey =
    firstString(body.outputKey, body.outKey, nestedOutput?.outputKey, nestedOutput?.outKey) || null;
  const outputBytes =
    firstNumber(body.outputBytes, body.bytes, nestedOutput?.outputBytes, nestedOutput?.bytes) ?? null;
  const progress = firstNumber(body.progress, body.percent) ?? null;
  const status = firstString(body.status, body.state) || "UNKNOWN";
  const errorMessage =
    firstString(body.error, body.errorMessage, body.message, nestedOutput?.error, nestedOutput?.errorMessage) || null;

  return {
    status,
    progress,
    outputKey,
    outputBytes,
    errorMessage,
    raw: body,
  };
}

function buildCoverEngineStatusUrl(requestId: string) {
  const base = env.COVER_ENGINE_URL || "";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return new URL(encodeURIComponent(requestId), normalized).toString();
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function firstNumber(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

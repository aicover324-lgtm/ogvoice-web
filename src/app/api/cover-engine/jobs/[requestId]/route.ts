import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runpodStatus } from "@/lib/runpod";

type Ctx = { params: Promise<{ requestId: string }> };

const terminalFailureStatuses = new Set(["FAILED", "CANCELLED", "CANCELED", "TIMED_OUT", "ABORTED"]);
const queuedStatuses = new Set(["IN_QUEUE", "QUEUED"]);
const runningStatuses = new Set(["IN_PROGRESS", "RUNNING", "PROCESSING"]);

export async function GET(req: Request, ctx: Ctx) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await ctx.params;
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  try {
    const st = await runpodStatus(requestId);
    const status = String(st.status || "UNKNOWN").toUpperCase();
    const out = asRecord(st.output);

    const outputKey = firstString(out?.outputKey, out?.outKey) || null;
    const outputBytes = firstNumber(out?.outputBytes, out?.bytes) ?? null;

    if (status === "COMPLETED") {
      return NextResponse.json({
        id: requestId,
        status: "COMPLETED",
        progress: 100,
        outputKey,
        outputBytes,
        error: null,
      });
    }

    if (terminalFailureStatuses.has(status)) {
      return NextResponse.json({
        id: requestId,
        status,
        progress: 100,
        outputKey,
        outputBytes,
        error: safeText(st.error) || "Cover generation failed",
      });
    }

    const progress = queuedStatuses.has(status) ? 12 : runningStatuses.has(status) ? 60 : 25;
    return NextResponse.json({
      id: requestId,
      status,
      progress,
      outputKey,
      outputBytes,
      error: null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Cover status check failed",
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

function safeText(value: unknown) {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value).slice(0, 1000);
  } catch {
    return String(value).slice(0, 1000);
  }
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

export const runtime = "nodejs";

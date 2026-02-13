import { env } from "@/lib/env";

const MVSEP_BASE_URL = "https://mvsep.com/api";

type CreateArgs = {
  sepType: number;
  addOpt1?: string | number;
  addOpt2?: string | number;
  addOpt3?: string | number;
  outputFormat?: number;
  isDemo?: boolean;
} & (
  | {
      url: string;
      remoteType?: "direct" | "mega" | "drive" | "dropbox";
      audioBytes?: never;
      fileName?: never;
      mimeType?: never;
    }
  | {
      audioBytes: Uint8Array;
      fileName: string;
      mimeType?: string;
      url?: never;
      remoteType?: never;
    }
);

export type MvsepFile = {
  url: string;
  download: string;
  label: string;
};

export type MvsepGetResult = {
  success: boolean;
  status: string;
  message?: string;
  files: MvsepFile[];
  raw: unknown;
};

function requireToken() {
  if (!env.MVSEP_API_TOKEN) {
    throw new Error("MVSEP API token is missing.");
  }
  return env.MVSEP_API_TOKEN;
}

function toStringSafe(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function cleanUrl(value: string) {
  return value.replaceAll("\\/", "/").trim();
}

function mapFiles(rawFiles: unknown): MvsepFile[] {
  if (!Array.isArray(rawFiles)) return [];
  const out: MvsepFile[] = [];

  for (const row of rawFiles) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const url = cleanUrl(toStringSafe(item.url || item.link));
    if (!url) continue;
    const download = toStringSafe(item.download || item.name || item.filename || "output.wav");
    const label = `${download} ${toStringSafe(item.title)} ${toStringSafe(item.type)}`.toLowerCase();
    out.push({ url, download, label });
  }

  return out;
}

async function parseJsonOrThrow(res: Response) {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`MVSEP returned non-JSON response (${res.status}).`);
  }
  if (!res.ok) {
    const message =
      json && typeof json === "object" && "message" in (json as Record<string, unknown>)
        ? toStringSafe((json as Record<string, unknown>).message)
        : `MVSEP request failed (${res.status}).`;
    throw new Error(message || `MVSEP request failed (${res.status}).`);
  }
  return json;
}

export async function mvsepCreateSeparation(args: CreateArgs) {
  const token = requireToken();
  const form = new FormData();
  form.set("api_token", token);
  form.set("sep_type", String(args.sepType));
  form.set("output_format", String(args.outputFormat ?? 1));
  form.set("is_demo", args.isDemo ? "1" : "0");

  if (args.addOpt1 !== undefined) form.set("add_opt1", String(args.addOpt1));
  if (args.addOpt2 !== undefined) form.set("add_opt2", String(args.addOpt2));
  if (args.addOpt3 !== undefined) form.set("add_opt3", String(args.addOpt3));

  if ("url" in args && typeof args.url === "string") {
    form.set("url", args.url);
    if (args.remoteType) form.set("remote_type", args.remoteType);
  } else {
    const end = args.audioBytes.byteOffset + args.audioBytes.byteLength;
    const arrayBuffer = args.audioBytes.buffer.slice(args.audioBytes.byteOffset, end) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: args.mimeType || "audio/wav" });
    form.set("audiofile", blob, args.fileName || "input.wav");
  }

  const res = await fetch(`${MVSEP_BASE_URL}/separation/create`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const json = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  const ok = Boolean(json.success);
  if (!ok) {
    const message =
      json.data && typeof json.data === "object"
        ? toStringSafe((json.data as Record<string, unknown>).message)
        : "MVSEP could not create separation.";
    throw new Error(message || "MVSEP could not create separation.");
  }
  const data = json.data as Record<string, unknown>;
  const hash = toStringSafe(data.hash);
  if (!hash) throw new Error("MVSEP did not return a job hash.");
  return { hash };
}

export async function mvsepGetSeparation(hash: string): Promise<MvsepGetResult> {
  const u = new URL(`${MVSEP_BASE_URL}/separation/get`);
  u.searchParams.set("hash", hash);

  const res = await fetch(u.toString(), { method: "GET", cache: "no-store" });
  const json = (await parseJsonOrThrow(res)) as Record<string, unknown>;
  const data = (json.data && typeof json.data === "object" ? json.data : {}) as Record<string, unknown>;

  return {
    success: Boolean(json.success),
    status: toStringSafe(json.status || "not_found").toLowerCase(),
    message: toStringSafe(data.message),
    files: mapFiles(data.files),
    raw: json,
  };
}

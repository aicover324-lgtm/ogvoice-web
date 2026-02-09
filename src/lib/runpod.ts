import { env } from "@/lib/env";

type RunpodRunResult = {
  id: string;
  status?: string;
  output?: unknown;
};

type RunpodStatusResult = {
  id: string;
  status: string;
  output?: unknown;
  error?: unknown;
};

function requireRunpodConfig() {
  if (!env.RUNPOD_API_KEY) throw new Error("RUNPOD_API_KEY is not set");
  if (!env.RUNPOD_ENDPOINT_ID) throw new Error("RUNPOD_ENDPOINT_ID is not set");
  return {
    apiKey: env.RUNPOD_API_KEY,
    endpointId: env.RUNPOD_ENDPOINT_ID,
  };
}

export async function runpodRun(input: Record<string, unknown>): Promise<RunpodRunResult> {
  const { apiKey, endpointId } = requireRunpodConfig();
  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.id) {
    throw new Error(json?.error?.message || json?.message || "RunPod run failed");
  }
  return json as RunpodRunResult;
}

export async function runpodStatus(requestId: string): Promise<RunpodStatusResult> {
  const { apiKey, endpointId } = requireRunpodConfig();
  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${encodeURIComponent(requestId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    throw new Error(json?.error?.message || json?.message || "RunPod status failed");
  }
  return json as RunpodStatusResult;
}

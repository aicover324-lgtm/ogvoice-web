import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getObjectBytes, putObjectBytes } from "@/lib/storage/s3";
import { stemOutputWavKey } from "@/lib/storage/keys";
import { mvsepCreateSeparation, mvsepGetSeparation, type MvsepFile } from "@/lib/mvsep";

const STEM_ACTION_PREFIX = "stem.separation.state:";
const WAITING_STATUSES = new Set(["waiting", "processing", "distributing", "merging"]);

type StemStage = "ensemble_wait" | "leadback_wait" | "dereverb_wait" | "denoise_wait" | "upload_outputs" | "done";

export type StemJobState = {
  jobId: string;
  userId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: StemStage;
  progress: number;
  message: string;
  errorMessage: string | null;
  inputAssetId: string;
  voiceProfileId: string | null;
  hashes: {
    ensemble: string | null;
    leadback: string | null;
    dereverbLead: string | null;
    dereverbBack: string | null;
    denoiseLead: string | null;
    denoiseBack: string | null;
  };
  urls: {
    ensembleVocal: string | null;
    instrumental: string | null;
    leadVocal: string | null;
    backVocal: string | null;
    leadDeryverbed: string | null;
    backDeryverbed: string | null;
    rawMainVocal: string | null;
    rawBackVocal: string | null;
  };
  outputs: {
    rawMainVocalAssetId: string | null;
    rawBackVocalAssetId: string | null;
    instrumentalAssetId: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

function actionFor(jobId: string) {
  return `${STEM_ACTION_PREFIX}${jobId}`;
}

function normalizeState(meta: unknown): StemJobState | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Partial<StemJobState>;
  if (!m.jobId || !m.userId || !m.status || !m.stage || !m.inputAssetId) return null;
  return {
    jobId: m.jobId,
    userId: m.userId,
    status: m.status,
    stage: m.stage,
    progress: Number(m.progress || 0),
    message: String(m.message || ""),
    errorMessage: m.errorMessage ? String(m.errorMessage) : null,
    inputAssetId: m.inputAssetId,
    voiceProfileId: m.voiceProfileId || null,
    hashes: {
      ensemble: m.hashes?.ensemble || null,
      leadback: m.hashes?.leadback || null,
      dereverbLead: m.hashes?.dereverbLead || null,
      dereverbBack: m.hashes?.dereverbBack || null,
      denoiseLead: m.hashes?.denoiseLead || null,
      denoiseBack: m.hashes?.denoiseBack || null,
    },
    urls: {
      ensembleVocal: m.urls?.ensembleVocal || null,
      instrumental: m.urls?.instrumental || null,
      leadVocal: m.urls?.leadVocal || null,
      backVocal: m.urls?.backVocal || null,
      leadDeryverbed: m.urls?.leadDeryverbed || null,
      backDeryverbed: m.urls?.backDeryverbed || null,
      rawMainVocal: m.urls?.rawMainVocal || null,
      rawBackVocal: m.urls?.rawBackVocal || null,
    },
    outputs: {
      rawMainVocalAssetId: m.outputs?.rawMainVocalAssetId || null,
      rawBackVocalAssetId: m.outputs?.rawBackVocalAssetId || null,
      instrumentalAssetId: m.outputs?.instrumentalAssetId || null,
    },
    createdAt: String(m.createdAt || new Date().toISOString()),
    updatedAt: String(m.updatedAt || new Date().toISOString()),
  };
}

async function saveState(userId: string, state: StemJobState) {
  const next: StemJobState = {
    ...state,
    progress: Math.max(0, Math.min(100, Math.round(state.progress))),
    updatedAt: new Date().toISOString(),
  };
  await prisma.auditLog.create({
    data: {
      userId,
      action: actionFor(next.jobId),
      meta: next,
    },
  });
  return next;
}

function fileByRules(args: { files: MvsepFile[]; include: RegExp[]; exclude?: RegExp[] }) {
  const exclude = args.exclude || [];
  return (
    args.files.find((f) => args.include.some((rx) => rx.test(f.label)) && !exclude.some((rx) => rx.test(f.label))) ||
    null
  );
}

function vocalLikeFile(files: MvsepFile[]) {
  return (
    fileByRules({
      files,
      include: [/vocal/, /voice/, /lead/, /back/, /speech/, /clean/, /dry/],
      exclude: [/instrument/, /instrum/, /music/, /other/, /drum/, /bass/],
    }) || files[0] || null
  );
}

function pickMainAndInstrumental(files: MvsepFile[]) {
  const vocalStrict = fileByRules({
    files,
    include: [/vocal/, /voice/, /acapella/],
    exclude: [/back/, /lead/, /instrument/, /instrum/, /music/, /other/, /drum/, /bass/],
  });
  const instrumentalStrict = fileByRules({
    files,
    include: [/instrument/, /instrum/, /music/, /karaoke/, /no[_ -]?vocal/],
    exclude: [/vocal/, /voice/, /lead/, /back/],
  });

  if (vocalStrict && instrumentalStrict) {
    return { vocal: vocalStrict, instrumental: instrumentalStrict };
  }

  if (files.length >= 2) {
    const withInstrKeyword = files.find((f) => /instrument|instrum|karaoke|no[_ -]?vocal|music/.test(f.label)) || null;
    if (withInstrKeyword) {
      const other = files.find((f) => f !== withInstrKeyword) || null;
      if (other) return { vocal: other, instrumental: withInstrKeyword };
    }

    return { vocal: files[0]!, instrumental: files[1]! };
  }

  return { vocal: vocalLikeFile(files), instrumental: null };
}

function failState(state: StemJobState, message: string): StemJobState {
  return {
    ...state,
    status: "failed",
    stage: "done",
    progress: Math.max(state.progress, 1),
    message: "Stem separation failed.",
    errorMessage: message,
  };
}

async function uploadRemoteAudioAsset(args: {
  state: StemJobState;
  sourceUrl: string;
  stemName: string;
  fileName: string;
}) {
  const res = await fetch(args.sourceUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not download ${args.stemName} from MVSEP.`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error(`${args.stemName} is empty.`);

  const contentType = (res.headers.get("content-type") || "audio/wav").toLowerCase().includes("audio")
    ? (res.headers.get("content-type") || "audio/wav")
    : "audio/wav";

  const key = stemOutputWavKey({
    userId: args.state.userId,
    jobId: args.state.jobId,
    stemName: args.stemName,
  });

  await putObjectBytes({
    key,
    bytes,
    contentType,
  });

  const asset = await prisma.uploadAsset.create({
    data: {
      userId: args.state.userId,
      voiceProfileId: args.state.voiceProfileId,
      type: "generated_output",
      fileName: args.fileName,
      fileSize: bytes.length,
      mimeType: contentType,
      storageKey: key,
    },
    select: { id: true },
  });

  return asset.id;
}

export async function createStemSeparationJob(args: {
  userId: string;
  inputAssetId: string;
  voiceProfileId: string | null;
}) {
  const inputAsset = await prisma.uploadAsset.findFirst({
    where: { id: args.inputAssetId, userId: args.userId, type: "song_input" },
    select: { id: true, fileName: true, mimeType: true, storageKey: true },
  });
  if (!inputAsset) {
    throw new Error("Singing record not found.");
  }

  const inputBytes = await getObjectBytes({
    key: inputAsset.storageKey,
    maxBytes: 256 * 1024 * 1024,
  });

  const created = await mvsepCreateSeparation({
    audioBytes: inputBytes,
    fileName: inputAsset.fileName,
    mimeType: inputAsset.mimeType,
    sepType: 40,
    addOpt1: 81,
    outputFormat: 1,
  });

  const now = new Date().toISOString();
  const state: StemJobState = {
    jobId: randomUUID(),
    userId: args.userId,
    status: "running",
    stage: "ensemble_wait",
    progress: 8,
    message: "Separating main vocals and instrumentals...",
    errorMessage: null,
    inputAssetId: args.inputAssetId,
    voiceProfileId: args.voiceProfileId,
    hashes: {
      ensemble: created.hash,
      leadback: null,
      dereverbLead: null,
      dereverbBack: null,
      denoiseLead: null,
      denoiseBack: null,
    },
    urls: {
      ensembleVocal: null,
      instrumental: null,
      leadVocal: null,
      backVocal: null,
      leadDeryverbed: null,
      backDeryverbed: null,
      rawMainVocal: null,
      rawBackVocal: null,
    },
    outputs: {
      rawMainVocalAssetId: null,
      rawBackVocalAssetId: null,
      instrumentalAssetId: null,
    },
    createdAt: now,
    updatedAt: now,
  };

  return saveState(args.userId, state);
}

export async function getStemSeparationJob(args: { userId: string; jobId: string }) {
  const row = await prisma.auditLog.findFirst({
    where: {
      userId: args.userId,
      action: actionFor(args.jobId),
    },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });
  return normalizeState(row?.meta ?? null);
}

export async function advanceStemSeparationJob(args: { userId: string; jobId: string }) {
  const current = await getStemSeparationJob(args);
  if (!current) return null;
  if (current.status === "failed" || current.status === "succeeded" || current.stage === "done") return current;

  try {
    if (current.stage === "ensemble_wait") {
      if (!current.hashes.ensemble) return saveState(args.userId, failState(current, "Missing ensemble hash."));
      const result = await mvsepGetSeparation(current.hashes.ensemble);

      if (result.status === "failed" || result.status === "not_found") {
        return saveState(args.userId, failState(current, result.message || "Main vocal separation failed."));
      }

      if (WAITING_STATUSES.has(result.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 16),
          message: result.message || "Separating main vocals and instrumentals...",
        });
      }

      const picked = pickMainAndInstrumental(result.files);
      const vocal = picked.vocal;
      const instrumental = picked.instrumental;

      if (!vocal || !instrumental) {
        const names = result.files.map((f) => f.download).join(", ");
        return saveState(
          args.userId,
          failState(
            current,
            names
              ? `Could not identify vocal/instrumental outputs from MVSEP. Files: ${names}`
              : "Could not identify vocal/instrumental outputs from MVSEP."
          )
        );
      }

      const leadBack = await mvsepCreateSeparation({
        url: vocal.url,
        sepType: 49,
        addOpt1: 6,
        addOpt2: 0,
        outputFormat: 1,
      });

      return saveState(args.userId, {
        ...current,
        status: "running",
        stage: "leadback_wait",
        progress: 32,
        message: "Separating lead and back vocals...",
        hashes: {
          ...current.hashes,
          leadback: leadBack.hash,
        },
        urls: {
          ...current.urls,
          ensembleVocal: vocal.url,
          instrumental: instrumental.url,
        },
      });
    }

    if (current.stage === "leadback_wait") {
      if (!current.hashes.leadback) return saveState(args.userId, failState(current, "Missing lead/back hash."));
      const result = await mvsepGetSeparation(current.hashes.leadback);

      if (result.status === "failed" || result.status === "not_found") {
        return saveState(args.userId, failState(current, result.message || "Lead/back separation failed."));
      }

      if (WAITING_STATUSES.has(result.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 44),
          message: result.message || "Separating lead and back vocals...",
        });
      }

      const lead = fileByRules({
        files: result.files,
        include: [/lead/, /main/],
        exclude: [/back/, /instrument/, /music/, /other/],
      });
      const back = fileByRules({
        files: result.files,
        include: [/back/, /bv/, /background/],
        exclude: [/lead/, /main/, /instrument/, /music/, /other/],
      });

      const leadFile = lead || vocalLikeFile(result.files);
      const backFile = back || result.files.find((f) => f !== leadFile) || null;

      if (!leadFile || !backFile) {
        return saveState(args.userId, failState(current, "Could not identify lead/back vocal files."));
      }

      return saveState(args.userId, {
        ...current,
        status: "running",
        stage: "dereverb_wait",
        progress: 56,
        message: "Removing echo and reverb (lead vocal)...",
        hashes: { ...current.hashes, dereverbLead: null, dereverbBack: null },
        urls: {
          ...current.urls,
          leadVocal: leadFile.url,
          backVocal: backFile.url,
        },
      });
    }

    if (current.stage === "dereverb_wait") {
      if (!current.urls.leadVocal || !current.urls.backVocal) {
        return saveState(args.userId, failState(current, "Missing lead/back vocal URLs."));
      }

      if (!current.hashes.dereverbLead) {
        const lead = await mvsepCreateSeparation({
          url: current.urls.leadVocal,
          sepType: 9,
          addOpt1: 16,
          addOpt2: 0.3,
          outputFormat: 1,
        });
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 58),
          message: "Removing echo and reverb (lead vocal)...",
          hashes: { ...current.hashes, dereverbLead: lead.hash },
        });
      }

      const leadStatus = await mvsepGetSeparation(current.hashes.dereverbLead);
      if (leadStatus.status === "failed" || leadStatus.status === "not_found") {
        return saveState(args.userId, failState(current, leadStatus.message || "Lead vocal de-reverb failed."));
      }
      if (WAITING_STATUSES.has(leadStatus.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 64),
          message: "Removing echo and reverb (lead vocal)...",
        });
      }

      const leadDry = vocalLikeFile(leadStatus.files);
      if (!leadDry) {
        return saveState(args.userId, failState(current, "Could not identify de-reverbed lead vocal."));
      }

      if (!current.hashes.dereverbBack) {
        const back = await mvsepCreateSeparation({
          url: current.urls.backVocal,
          sepType: 9,
          addOpt1: 16,
          addOpt2: 0.3,
          outputFormat: 1,
        });
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 70),
          message: "Removing echo and reverb (back vocal)...",
          hashes: { ...current.hashes, dereverbBack: back.hash },
          urls: { ...current.urls, leadDeryverbed: leadDry.url },
        });
      }

      const backStatus = await mvsepGetSeparation(current.hashes.dereverbBack);
      if (backStatus.status === "failed" || backStatus.status === "not_found") {
        return saveState(args.userId, failState(current, backStatus.message || "Back vocal de-reverb failed."));
      }
      if (WAITING_STATUSES.has(backStatus.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 74),
          message: "Removing echo and reverb (back vocal)...",
          urls: { ...current.urls, leadDeryverbed: leadDry.url },
        });
      }

      const backDry = vocalLikeFile(backStatus.files);
      if (!backDry) {
        return saveState(args.userId, failState(current, "Could not identify de-reverbed back vocal."));
      }

      return saveState(args.userId, {
        ...current,
        status: "running",
        stage: "denoise_wait",
        progress: 80,
        message: "Applying denoise (lead vocal)...",
        hashes: {
          ...current.hashes,
          denoiseLead: null,
          denoiseBack: null,
        },
        urls: {
          ...current.urls,
          leadDeryverbed: leadDry.url,
          backDeryverbed: backDry.url,
        },
      });
    }

    if (current.stage === "denoise_wait") {
      if (!current.urls.leadDeryverbed || !current.urls.backDeryverbed) {
        return saveState(args.userId, failState(current, "Missing de-reverbed vocal URLs."));
      }

      if (!current.hashes.denoiseLead) {
        const lead = await mvsepCreateSeparation({
          url: current.urls.leadDeryverbed,
          sepType: 9,
          addOpt1: 15,
          addOpt2: 0.3,
          outputFormat: 1,
        });
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 82),
          message: "Applying denoise (lead vocal)...",
          hashes: { ...current.hashes, denoiseLead: lead.hash },
        });
      }

      const leadStatus = await mvsepGetSeparation(current.hashes.denoiseLead);
      if (leadStatus.status === "failed" || leadStatus.status === "not_found") {
        return saveState(args.userId, failState(current, leadStatus.message || "Lead vocal denoise failed."));
      }
      if (WAITING_STATUSES.has(leadStatus.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 86),
          message: "Applying denoise (lead vocal)...",
        });
      }

      const leadRaw = vocalLikeFile(leadStatus.files);
      if (!leadRaw) {
        return saveState(args.userId, failState(current, "Could not identify denoised lead vocal."));
      }

      if (!current.hashes.denoiseBack) {
        const back = await mvsepCreateSeparation({
          url: current.urls.backDeryverbed,
          sepType: 9,
          addOpt1: 15,
          addOpt2: 0.3,
          outputFormat: 1,
        });
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 90),
          message: "Applying denoise (back vocal)...",
          hashes: { ...current.hashes, denoiseBack: back.hash },
          urls: { ...current.urls, rawMainVocal: leadRaw.url },
        });
      }

      const backStatus = await mvsepGetSeparation(current.hashes.denoiseBack);
      if (backStatus.status === "failed" || backStatus.status === "not_found") {
        return saveState(args.userId, failState(current, backStatus.message || "Back vocal denoise failed."));
      }
      if (WAITING_STATUSES.has(backStatus.status)) {
        return saveState(args.userId, {
          ...current,
          status: "running",
          progress: Math.max(current.progress, 92),
          message: "Applying denoise (back vocal)...",
          urls: { ...current.urls, rawMainVocal: leadRaw.url },
        });
      }

      const backRaw = vocalLikeFile(backStatus.files);
      if (!backRaw) {
        return saveState(args.userId, failState(current, "Could not identify denoised back vocal."));
      }

      return saveState(args.userId, {
        ...current,
        status: "running",
        stage: "upload_outputs",
        progress: 94,
        message: "Saving stems to your library...",
        urls: {
          ...current.urls,
          rawMainVocal: leadRaw.url,
          rawBackVocal: backRaw.url,
        },
      });
    }

    if (current.stage === "upload_outputs") {
      if (!current.urls.rawMainVocal || !current.urls.rawBackVocal || !current.urls.instrumental) {
        return saveState(args.userId, failState(current, "Missing final stem URLs."));
      }

      if (!current.outputs.rawMainVocalAssetId) {
        const id = await uploadRemoteAudioAsset({
          state: current,
          sourceUrl: current.urls.rawMainVocal,
          stemName: "raw-main-vocal",
          fileName: "raw-main-vocal.wav",
        });
        return saveState(args.userId, {
          ...current,
          outputs: { ...current.outputs, rawMainVocalAssetId: id },
          progress: 94,
          message: "Saving stems to your library...",
        });
      }

      if (!current.outputs.rawBackVocalAssetId) {
        const id = await uploadRemoteAudioAsset({
          state: current,
          sourceUrl: current.urls.rawBackVocal,
          stemName: "raw-back-vocal",
          fileName: "raw-back-vocal.wav",
        });
        return saveState(args.userId, {
          ...current,
          outputs: { ...current.outputs, rawBackVocalAssetId: id },
          progress: 97,
          message: "Saving stems to your library...",
        });
      }

      if (!current.outputs.instrumentalAssetId) {
        const id = await uploadRemoteAudioAsset({
          state: current,
          sourceUrl: current.urls.instrumental,
          stemName: "instrumental",
          fileName: "instrumental.wav",
        });
        return saveState(args.userId, {
          ...current,
          outputs: { ...current.outputs, instrumentalAssetId: id },
          progress: 99,
          message: "Saving stems to your library...",
        });
      }

      return saveState(args.userId, {
        ...current,
        status: "succeeded",
        stage: "done",
        progress: 100,
        message: "Stem separation completed.",
        errorMessage: null,
      });
    }

    return current;
  } catch (e) {
    const failed = failState(current, e instanceof Error ? e.message : "Stem separation failed.");
    return saveState(args.userId, failed);
  }
}

export const COVER_RVC_HIDDEN_DEFAULTS = {
  splitAudio: true,
  pitchExtractor: "rmvpe",
  embedderModel: "contentvec",
  autotune: false,
  filterRadius: 3,
  volumeEnvelope: 0.25,
  protectVoicelessConsonants: 0.33,
} as const;

export const COVER_AUDIO_SEPARATION_DEFAULTS = {
  useTta: false,
  batchSize: 1,
  vocalsModel: "Mel-Roformer by KimberleyJSN",
  karaokeModel: "Mel-Roformer Karaoke by aufr33 and viperx",
  dereverbModel: "UVR-Deecho-Dereverb",
  deechoEnabled: true,
  deechoModel: "UVR-Deecho-Normal",
} as const;

export const COVER_POST_PROCESS_DEFAULTS = {
  deleteIntermediateAudios: true,
  reverb: false,
  exportFormat: "WAV",
  instrumentalPitchFollowsMainPitch: true,
} as const;

export function buildCoverPipelineConfig(args: {
  pitch: number;
  searchFeatureRatio: number;
  inferBackingVocals: boolean;
}) {
  return {
    rvc: {
      inferBackingVocals: args.inferBackingVocals,
      pitch: args.pitch,
      searchFeatureRatio: args.searchFeatureRatio,
      ...COVER_RVC_HIDDEN_DEFAULTS,
    },
    audioSeparation: {
      ...COVER_AUDIO_SEPARATION_DEFAULTS,
    },
    postProcess: {
      ...COVER_POST_PROCESS_DEFAULTS,
      instrumentalPitch: args.pitch,
    },
  };
}

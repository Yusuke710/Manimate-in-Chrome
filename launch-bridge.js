const LAUNCH_HASH_FLAG = "manimate_chrome_launch";
const NONE_VOICE_ID = "none";
const VOICE_ID_PATTERN = /^(?:[a-z]{1,2}_[a-z0-9_]{2,64}|[a-zA-Z0-9]{8,64})$/;

const VALID_MODEL_IDS = new Set([
  "claude",
  "codex",
]);

const VALID_ASPECT_RATIOS = new Set([
  "16:9",
  "9:16",
  "1:1",
]);

function isValidVoiceId(voiceId) {
  return voiceId === NONE_VOICE_ID || VOICE_ID_PATTERN.test(voiceId);
}

function buildLaunchUrlFromHash() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return null;

  const hashParams = new URLSearchParams(hash);
  if (hashParams.get(LAUNCH_HASH_FLAG) !== "1") return null;

  const prompt = hashParams.get("prompt")?.trim() || "";
  const send = hashParams.get("send");
  const model = hashParams.get("model") || "";
  const voiceId = hashParams.get("voice_id") || "";
  const aspectRatio = hashParams.get("aspect_ratio") || "";

  if (
    !prompt
    || send !== "1"
    || !VALID_MODEL_IDS.has(model)
    || !isValidVoiceId(voiceId)
    || !VALID_ASPECT_RATIOS.has(aspectRatio)
  ) {
    return null;
  }

  const launchUrl = new URL(window.location.href);
  launchUrl.hash = "";
  launchUrl.search = "";
  launchUrl.searchParams.set("prompt", prompt);
  launchUrl.searchParams.set("send", send);
  launchUrl.searchParams.set("model", model);
  launchUrl.searchParams.set("voice_id", voiceId);
  launchUrl.searchParams.set("aspect_ratio", aspectRatio);
  return launchUrl;
}

const launchUrl = buildLaunchUrlFromHash();
if (launchUrl) {
  history.replaceState(null, "", launchUrl.toString());
}

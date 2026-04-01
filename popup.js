const CLOUD_MANIMATE_BASE_URL = "https://manimate.ai";
const LOCAL_STUDIO_STATUS_PATH = "/api/cloud-sync/status";
const STUDIO_DISCOVERY_HEADER_NAME = "x-manimate-studio";
const STUDIO_DISCOVERY_HEADER_VALUE = "local";
const LOCAL_STUDIO_HOSTS = ["127.0.0.1", "localhost"];
const LOCAL_STUDIO_PORT_START = 3000;
const LOCAL_STUDIO_PORT_ATTEMPTS = 20;
const LOCAL_STUDIO_PROBE_TIMEOUT_MS = 350;

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_VOICE_ID = "Lci8YeL6PAFHJjNKvwXq";
const DEFAULT_ASPECT_RATIO = "16:9";
const NONE_VOICE_ID = "none";
const VOICE_ID_PATTERN = /^[a-zA-Z0-9]{8,64}$/;

const STORAGE_KEYS = {
  model: "preferredModel",
  voice: "preferredVoice",
  aspectRatio: "preferredAspectRatio",
  lastLocalStudioBaseUrl: "lastLocalStudioBaseUrl",
};

const MODELS = [
  {
    id: "kimi-k2.5",
    label: "Manimate Lite",
    description: "A lightweight agent for everyday animations",
  },
  {
    id: "claude-opus-4-6",
    label: "Manimate Pro",
    description: "Best quality, 10x Lite credit usage",
  },
];

const VOICES = [
  {
    id: "Lci8YeL6PAFHJjNKvwXq",
    label: "Yusuke",
    description: "Japanese accent, narration",
    isDefault: true,
  },
];

const ASPECT_RATIOS = [
  { id: "16:9", label: "Landscape" },
  { id: "9:16", label: "Reel" },
  { id: "1:1", label: "Square" },
];

const VALID_MODEL_IDS = new Set(MODELS.map((entry) => entry.id));
const VALID_ASPECT_RATIOS = new Set(ASPECT_RATIOS.map((entry) => entry.id));

const promptEl = document.getElementById("prompt");
const openEl = document.getElementById("open");
const helperEl = document.getElementById("helper");
const errorEl = document.getElementById("error");

const modelButtonEl = document.getElementById("modelButton");
const modelLabelEl = document.getElementById("modelLabel");
const modelMenuEl = document.getElementById("modelMenu");

const voiceButtonEl = document.getElementById("voiceButton");
const voiceIconEl = document.getElementById("voiceIcon");
const voiceMenuEl = document.getElementById("voiceMenu");

const aspectButtonEl = document.getElementById("aspectButton");
const aspectLabelEl = document.getElementById("aspectLabel");
const aspectIconEl = document.getElementById("aspectIcon");
const aspectMenuEl = document.getElementById("aspectMenu");

const selectors = [
  { button: modelButtonEl, menu: modelMenuEl, name: "model" },
  { button: voiceButtonEl, menu: voiceMenuEl, name: "voice" },
  { button: aspectButtonEl, menu: aspectMenuEl, name: "aspect" },
];

const state = {
  model: DEFAULT_MODEL,
  voice: DEFAULT_VOICE_ID,
  aspectRatio: DEFAULT_ASPECT_RATIO,
};

let activePageUrl = "";
let customVoiceDraft = "";
let launchTarget = {
  kind: "cloud",
  baseUrl: CLOUD_MANIMATE_BASE_URL,
};
let launchTargetReady = false;
let launchTargetPromise = null;

function setError(message) {
  errorEl.textContent = message || "";
}

function setHelper(message) {
  helperEl.textContent = message || "";
}

function getLaunchTargetLabel(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/^https?:\/\//, "");
  }
}

function getModelById(id) {
  return MODELS.find((entry) => entry.id === id) || MODELS.find((entry) => entry.id === DEFAULT_MODEL);
}

function truncateVoiceId(voiceId) {
  return voiceId.length > 14 ? `${voiceId.slice(0, 6)}...${voiceId.slice(-4)}` : voiceId;
}

function isValidVoiceId(voiceId) {
  return voiceId === NONE_VOICE_ID || VOICE_ID_PATTERN.test(voiceId);
}

function getVoiceById(id) {
  if (id === NONE_VOICE_ID) {
    return {
      id: NONE_VOICE_ID,
      label: "No Voice",
      description: "Silent video, saves credits",
      isCustom: false,
    };
  }

  const knownVoice = VOICES.find((entry) => entry.id === id);
  if (knownVoice) {
    return {
      ...knownVoice,
      isCustom: false,
    };
  }

  return {
    id,
    label: "Custom Voice",
    description: truncateVoiceId(id),
    isCustom: true,
  };
}

function getAspectRatioById(id) {
  return ASPECT_RATIOS.find((entry) => entry.id === id) || ASPECT_RATIOS.find((entry) => entry.id === DEFAULT_ASPECT_RATIO);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function voiceIconSvg(voiceId) {
  if (voiceId === NONE_VOICE_ID) {
    return `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;
  }

  return `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
  `;
}

function isAllowedPageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizeLoopbackBaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!LOCAL_STUDIO_HOSTS.includes(parsed.hostname)) return null;
    if (!parsed.port) return null;
    return normalizeBaseUrl(`${parsed.protocol}//${parsed.hostname}:${parsed.port}`);
  } catch {
    return null;
  }
}

function isStudioStatusPayload(value) {
  return Boolean(
    value
      && typeof value === "object"
      && typeof value.status === "string"
      && typeof value.connected === "boolean"
      && typeof value.base_url === "string"
  );
}

function buildHelperMessage() {
  const promptMessage = activePageUrl
    ? "Current page URL inserted. Edit it or replace it with any text prompt."
    : "Type any prompt to launch Manimate from the popup.";

  const targetMessage = launchTargetReady
    ? launchTarget.kind === "local"
      ? `Opening local Studio at ${getLaunchTargetLabel(launchTarget.baseUrl)}.`
      : "Opening manimate.ai."
    : "Checking for local Studio...";

  return `${promptMessage} ${targetMessage}`;
}

function renderHelper() {
  setHelper(buildHelperMessage());
}

function setLaunchTarget(kind, baseUrl) {
  launchTarget = {
    kind,
    baseUrl,
  };
  launchTargetReady = true;
  renderHelper();
}

async function loadCachedLocalStudioBaseUrl() {
  const stored = await chrome.storage.local.get({
    [STORAGE_KEYS.lastLocalStudioBaseUrl]: "",
  });
  return normalizeLoopbackBaseUrl(stored[STORAGE_KEYS.lastLocalStudioBaseUrl]);
}

async function saveCachedLocalStudioBaseUrl(baseUrl) {
  const normalized = normalizeLoopbackBaseUrl(baseUrl);
  if (!normalized) return;

  await chrome.storage.local.set({
    [STORAGE_KEYS.lastLocalStudioBaseUrl]: normalized,
  });
}

async function clearCachedLocalStudioBaseUrl() {
  await chrome.storage.local.remove(STORAGE_KEYS.lastLocalStudioBaseUrl);
}

function buildLocalStudioCandidateBaseUrls(cachedBaseUrl) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const normalized = normalizeLoopbackBaseUrl(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  addCandidate(cachedBaseUrl);

  for (const host of LOCAL_STUDIO_HOSTS) {
    for (let offset = 0; offset < LOCAL_STUDIO_PORT_ATTEMPTS; offset += 1) {
      addCandidate(`http://${host}:${LOCAL_STUDIO_PORT_START + offset}`);
    }
  }

  return candidates;
}

async function probeLocalStudio(baseUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOCAL_STUDIO_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(LOCAL_STUDIO_STATUS_PATH, `${baseUrl}/`).toString(), {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;
    if (response.headers.get(STUDIO_DISCOVERY_HEADER_NAME) !== STUDIO_DISCOVERY_HEADER_VALUE) return null;

    const payload = await response.json();
    if (!isStudioStatusPayload(payload)) return null;

    return baseUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function discoverLocalStudioBaseUrl() {
  const cachedBaseUrl = await loadCachedLocalStudioBaseUrl();
  if (cachedBaseUrl) {
    const cachedMatch = await probeLocalStudio(cachedBaseUrl);
    if (cachedMatch) return cachedMatch;
  }

  const candidates = buildLocalStudioCandidateBaseUrls(cachedBaseUrl)
    .filter((baseUrl) => baseUrl !== cachedBaseUrl);

  if (candidates.length === 0) return null;

  const results = await Promise.all(
    candidates.map(async (baseUrl) => ({
      baseUrl,
      ok: Boolean(await probeLocalStudio(baseUrl)),
    }))
  );

  return results.find((entry) => entry.ok)?.baseUrl || null;
}

async function resolveLaunchTarget({ forceRefresh = false } = {}) {
  if (launchTargetPromise && !forceRefresh) {
    return launchTargetPromise;
  }

  launchTargetReady = false;
  renderHelper();

  launchTargetPromise = (async () => {
    try {
      const localStudioBaseUrl = await discoverLocalStudioBaseUrl();

      if (localStudioBaseUrl) {
        await saveCachedLocalStudioBaseUrl(localStudioBaseUrl);
        setLaunchTarget("local", localStudioBaseUrl);
        return launchTarget;
      }

      await clearCachedLocalStudioBaseUrl();
    } catch {
      await clearCachedLocalStudioBaseUrl();
    }

    setLaunchTarget("cloud", CLOUD_MANIMATE_BASE_URL);
    return launchTarget;
  })();

  return launchTargetPromise;
}

function aspectRatioIconSvg(ratio, color = "var(--text-tertiary)", size = 14) {
  let width;
  let height;
  if (ratio === "9:16") {
    height = size;
    width = Math.round((size * 9) / 16);
  } else if (ratio === "1:1") {
    width = size;
    height = size;
  } else {
    width = size;
    height = Math.round((size * 9) / 16);
  }

  const x = (size - width) / 2;
  const y = (size - height) / 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" aria-hidden="true">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5" stroke="${color}" stroke-width="1.5"></rect>
    </svg>
  `;
}

function closeMenus() {
  for (const selector of selectors) {
    selector.menu.classList.remove("open");
    selector.button.setAttribute("aria-expanded", "false");
  }
}

function autosizePrompt() {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 220)}px`;
}

function toggleMenu(name) {
  const current = selectors.find((selector) => selector.name === name);
  if (!current) return;

  const shouldOpen = !current.menu.classList.contains("open");
  closeMenus();

  if (shouldOpen) {
    current.menu.classList.add("open");
    current.button.setAttribute("aria-expanded", "true");
  }
}

async function loadPreferences() {
  const stored = await chrome.storage.sync.get({
    [STORAGE_KEYS.model]: DEFAULT_MODEL,
    [STORAGE_KEYS.voice]: DEFAULT_VOICE_ID,
    [STORAGE_KEYS.aspectRatio]: DEFAULT_ASPECT_RATIO,
  });

  state.model = VALID_MODEL_IDS.has(stored[STORAGE_KEYS.model]) ? stored[STORAGE_KEYS.model] : DEFAULT_MODEL;
  state.voice = isValidVoiceId(stored[STORAGE_KEYS.voice]) ? stored[STORAGE_KEYS.voice] : DEFAULT_VOICE_ID;
  state.aspectRatio = VALID_ASPECT_RATIOS.has(stored[STORAGE_KEYS.aspectRatio])
    ? stored[STORAGE_KEYS.aspectRatio]
    : DEFAULT_ASPECT_RATIO;
}

async function savePreferences() {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.model]: state.model,
    [STORAGE_KEYS.voice]: state.voice,
    [STORAGE_KEYS.aspectRatio]: state.aspectRatio,
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function renderSelectors() {
  const model = getModelById(state.model);
  const voice = getVoiceById(state.voice);
  const aspectRatio = getAspectRatioById(state.aspectRatio);

  modelLabelEl.textContent = model.label;
  voiceButtonEl.setAttribute("title", voice.label);
  voiceButtonEl.setAttribute("aria-label", `Voice selector, current voice ${voice.label}`);
  voiceIconEl.innerHTML = voiceIconSvg(state.voice);
  aspectLabelEl.textContent = aspectRatio.label;
  aspectIconEl.innerHTML = aspectRatioIconSvg(aspectRatio.id);

  modelMenuEl.innerHTML = MODELS.map((entry) => `
    <button class="menuItem${entry.id === state.model ? " active" : ""}" type="button" data-model-id="${entry.id}" role="menuitem">
      <span class="menuTitle">${entry.label}</span>
      <span class="menuMeta">${entry.description}</span>
    </button>
  `).join("");

  const customVoiceValue = customVoiceDraft || (voice.isCustom ? voice.id : "");
  const customVoiceId = isValidVoiceId(customVoiceValue) && customVoiceValue !== NONE_VOICE_ID
    ? customVoiceValue
    : "";

  voiceMenuEl.innerHTML = `
    <button class="menuItem${state.voice === NONE_VOICE_ID ? " active" : ""}" type="button" data-voice-id="${NONE_VOICE_ID}" role="menuitem">
      <span class="menuTitle">No Voice</span>
      <span class="menuMeta">Silent video, saves credits</span>
    </button>
    <div class="menuDivider"></div>
    ${VOICES.map((entry) => `
      <button class="menuItem${entry.id === state.voice ? " active" : ""}" type="button" data-voice-id="${entry.id}" role="menuitem">
        <span class="menuTitle">${entry.label}${entry.isDefault ? " (Default)" : ""}</span>
        <span class="menuMeta">${entry.description}</span>
      </button>
    `).join("")}
    <div class="menuDivider"></div>
    <div class="menuSection">
      <input
        class="menuInput"
        type="text"
        value="${escapeHtml(customVoiceValue)}"
        placeholder="Paste voice ID..."
        autocomplete="off"
        spellcheck="false"
        data-custom-voice-input="1"
      />
      <div class="menuHint">Paste any ElevenLabs voice ID. Voice setup stays in Manimate Studio.</div>
      <div class="menuActionRow">
        <button class="menuButtonSecondary" type="button" data-apply-custom-voice="1"${customVoiceId ? "" : " disabled"}>Use Voice ID</button>
      </div>
    </div>
  `;

  aspectMenuEl.innerHTML = ASPECT_RATIOS.map((entry) => `
    <button class="menuItemRow aspectOption${entry.id === state.aspectRatio ? " active" : ""}" type="button" data-aspect-id="${entry.id}" role="menuitem">
      <span class="aspectMenuIcon">${aspectRatioIconSvg(entry.id, entry.id === state.aspectRatio ? "var(--text-primary)" : "var(--text-secondary)", 16)}</span>
      <span class="menuTitle">${entry.label}</span>
    </button>
  `).join("");
}

function bindMenuEvents() {
  modelMenuEl.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-model-id]") : null;
    if (!target) return;
    state.model = target.getAttribute("data-model-id");
    renderSelectors();
    closeMenus();
    await savePreferences();
  });

  voiceMenuEl.addEventListener("click", async (event) => {
    const applyButton = event.target instanceof Element ? event.target.closest("[data-apply-custom-voice]") : null;
    if (applyButton) {
      const nextVoiceId = customVoiceDraft.trim();
      if (!isValidVoiceId(nextVoiceId) || nextVoiceId === NONE_VOICE_ID) return;
      state.voice = nextVoiceId;
      renderSelectors();
      closeMenus();
      await savePreferences();
      return;
    }

    const target = event.target instanceof Element ? event.target.closest("[data-voice-id]") : null;
    if (!target) return;
    state.voice = target.getAttribute("data-voice-id");
    customVoiceDraft = "";
    renderSelectors();
    closeMenus();
    await savePreferences();
  });

  voiceMenuEl.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.customVoiceInput !== "1") return;
    customVoiceDraft = target.value.trim();
    const applyButton = voiceMenuEl.querySelector("[data-apply-custom-voice='1']");
    if (applyButton instanceof HTMLButtonElement) {
      applyButton.disabled = !isValidVoiceId(customVoiceDraft) || customVoiceDraft === NONE_VOICE_ID;
    }
  });

  voiceMenuEl.addEventListener("keydown", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.customVoiceInput !== "1") return;
    if (event.key !== "Enter") return;

    const nextVoiceId = customVoiceDraft.trim();
    if (!isValidVoiceId(nextVoiceId) || nextVoiceId === NONE_VOICE_ID) return;

    event.preventDefault();
    state.voice = nextVoiceId;
    renderSelectors();
    closeMenus();
    await savePreferences();
  });

  aspectMenuEl.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-aspect-id]") : null;
    if (!target) return;
    state.aspectRatio = target.getAttribute("data-aspect-id");
    renderSelectors();
    closeMenus();
    await savePreferences();
  });
}

function updateSendState() {
  openEl.disabled = promptEl.value.trim().length === 0;
}

async function openInManimate() {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    setError("Prompt is required.");
    promptEl.focus();
    return;
  }

  openEl.disabled = true;
  setError("");

  try {
    const target = await resolveLaunchTarget({ forceRefresh: true });
    const launchUrl = new URL("/app", target.baseUrl);
    launchUrl.searchParams.set("prompt", prompt);
    launchUrl.searchParams.set("send", "1");
    launchUrl.searchParams.set("model", state.model);
    launchUrl.searchParams.set("voice_id", state.voice);
    launchUrl.searchParams.set("aspect_ratio", state.aspectRatio);

    await chrome.tabs.create({ url: launchUrl.toString() });
    window.close();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to open Manimate.");
    updateSendState();
  }
}

async function init() {
  await loadPreferences();
  renderSelectors();
  bindMenuEvents();

  const activeTab = await getActiveTab();
  const pageUrl = activeTab?.url || "";

  if (isAllowedPageUrl(pageUrl)) {
    activePageUrl = pageUrl;
    promptEl.value = pageUrl;
  } else {
    activePageUrl = "";
    promptEl.value = "";
  }

  renderHelper();
  autosizePrompt();
  updateSendState();
  promptEl.focus();
  if (activePageUrl) {
    promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
  }

  void resolveLaunchTarget();
}

modelButtonEl.addEventListener("click", () => toggleMenu("model"));
voiceButtonEl.addEventListener("click", () => toggleMenu("voice"));
aspectButtonEl.addEventListener("click", () => toggleMenu("aspect"));

document.addEventListener("mousedown", (event) => {
  const withinSelector = event.target instanceof Element ? event.target.closest(".selector") : null;
  if (!withinSelector) closeMenus();
});

promptEl.addEventListener("input", () => {
  autosizePrompt();
  updateSendState();
  setError("");
});

promptEl.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    void openInManimate();
  }
});

openEl.addEventListener("click", () => {
  void openInManimate();
});

void init().catch((error) => {
  setError(error instanceof Error ? error.message : "Failed to initialize popup.");
});

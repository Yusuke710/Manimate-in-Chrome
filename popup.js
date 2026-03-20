const MANIMATE_BASE_URL = "https://manimate.ai";

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_VOICE_ID = "Lci8YeL6PAFHJjNKvwXq";
const DEFAULT_ASPECT_RATIO = "16:9";

const STORAGE_KEYS = {
  model: "preferredModel",
  voice: "preferredVoice",
  aspectRatio: "preferredAspectRatio",
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
    name: "Yusuke",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    label: "Liam",
    description: "Young male, American",
    name: "Liam",
  },
];

const ASPECT_RATIOS = [
  { id: "16:9", label: "Landscape" },
  { id: "9:16", label: "Reel" },
  { id: "1:1", label: "Square" },
];

const VALID_MODEL_IDS = new Set(MODELS.map((entry) => entry.id));
const VALID_VOICE_IDS = new Set(VOICES.map((entry) => entry.id));
const VALID_ASPECT_RATIOS = new Set(ASPECT_RATIOS.map((entry) => entry.id));

const promptEl = document.getElementById("prompt");
const openEl = document.getElementById("open");
const helperEl = document.getElementById("helper");
const errorEl = document.getElementById("error");

const modelButtonEl = document.getElementById("modelButton");
const modelLabelEl = document.getElementById("modelLabel");
const modelMenuEl = document.getElementById("modelMenu");

const voiceButtonEl = document.getElementById("voiceButton");
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

function setError(message) {
  errorEl.textContent = message || "";
}

function setHelper(message) {
  helperEl.textContent = message || "";
}

function getModelById(id) {
  return MODELS.find((entry) => entry.id === id) || MODELS.find((entry) => entry.id === DEFAULT_MODEL);
}

function getVoiceById(id) {
  return VOICES.find((entry) => entry.id === id) || VOICES.find((entry) => entry.id === DEFAULT_VOICE_ID);
}

function getAspectRatioById(id) {
  return ASPECT_RATIOS.find((entry) => entry.id === id) || ASPECT_RATIOS.find((entry) => entry.id === DEFAULT_ASPECT_RATIO);
}

function getVoicePageUrl(voiceId) {
  const entry = getVoiceById(voiceId);
  return `https://elevenlabs.io/app/default-voices?search=${encodeURIComponent(entry.name)}`;
}

function isAllowedPageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
  state.voice = VALID_VOICE_IDS.has(stored[STORAGE_KEYS.voice]) ? stored[STORAGE_KEYS.voice] : DEFAULT_VOICE_ID;
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
  aspectLabelEl.textContent = aspectRatio.label;
  aspectIconEl.innerHTML = aspectRatioIconSvg(aspectRatio.id);

  modelMenuEl.innerHTML = MODELS.map((entry) => `
    <button class="menuItem${entry.id === state.model ? " active" : ""}" type="button" data-model-id="${entry.id}" role="menuitem">
      <span class="menuTitle">${entry.label}</span>
      <span class="menuMeta">${entry.description}</span>
    </button>
  `).join("");

  voiceMenuEl.innerHTML = VOICES.map((entry) => `
    <div class="menuItemRow${entry.id === state.voice ? " active" : ""}">
      <button class="menuButtonCore" type="button" data-voice-id="${entry.id}" role="menuitem">
        <span class="menuTitle">${entry.label}</span>
        <span class="menuMeta">${entry.description}</span>
      </button>
      <a
        class="previewLink"
        href="${getVoicePageUrl(entry.id)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Preview ${entry.label} on ElevenLabs"
        title="Preview on ElevenLabs"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>
  `).join("");

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
    const target = event.target instanceof Element ? event.target.closest("[data-voice-id]") : null;
    if (!target) return;
    state.voice = target.getAttribute("data-voice-id");
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
    const launchUrl = new URL("/app", MANIMATE_BASE_URL);
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
    setHelper("Current page URL inserted. Edit it or replace it with any text prompt.");
  } else {
    activePageUrl = "";
    promptEl.value = "";
    setHelper("Type any prompt to launch Manimate from the popup.");
  }

  autosizePrompt();
  updateSendState();
  promptEl.focus();
  if (activePageUrl) {
    promptEl.setSelectionRange(promptEl.value.length, promptEl.value.length);
  }
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

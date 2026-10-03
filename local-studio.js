const LOCAL_STUDIO_STATUS_PATH = "/api/status";
const STUDIO_DISCOVERY_HEADER_NAME = "x-manimate-studio";
const STUDIO_DISCOVERY_HEADER_VALUE = "local";
const STUDIO_DISCOVERY_BODY_VALUE = "manimate-local";
const CANONICAL_LOCAL_STUDIO_HOST = "127.0.0.1";
const LOCAL_STUDIO_HOSTS = [CANONICAL_LOCAL_STUDIO_HOST, "localhost"];
const LOCAL_STUDIO_PORT_START = 32179;
const LOCAL_STUDIO_PORT_ATTEMPTS = 20;
const LOCAL_STUDIO_PROBE_TIMEOUT_MS = 350;


const STORAGE_KEYS={lastLocalStudioBaseUrl:"lastLocalStudioBaseUrl"};
function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function canonicalizeLoopbackHost(hostname) {
  if (typeof hostname !== "string") return null;
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return null;
  return LOCAL_STUDIO_HOSTS.includes(normalized) ? CANONICAL_LOCAL_STUDIO_HOST : null;
}

function isLocalStudioPortInRange(port) {
  return Number.isInteger(port) && port >= LOCAL_STUDIO_PORT_START && port < LOCAL_STUDIO_PORT_START + LOCAL_STUDIO_PORT_ATTEMPTS;
}

function normalizeLoopbackBaseUrl(value, options = {}) {
  const allowAnyPort = options.allowAnyPort === true;
  if (typeof value !== "string" || value.trim().length === 0) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const canonicalHost = canonicalizeLoopbackHost(parsed.hostname);
    if (!canonicalHost) return null;
    const port = Number.parseInt(parsed.port || "", 10);
    if (!Number.isFinite(port) || port <= 0) return null;
    if (!allowAnyPort && !isLocalStudioPortInRange(port)) return null;
    return normalizeBaseUrl(`${parsed.protocol}//${canonicalHost}:${port}`);
  } catch {
    return null;
  }
}

function isLocalStudioStatusPayload(value, options = {}) {
  const markedLocal = options.markedLocal === true;
  if (!value || typeof value !== "object") return false;
  if (typeof value.status !== "string") return false;

  if (markedLocal) {
    return true;
  }

  return Boolean(
    typeof value.connected === "boolean"
      || typeof value.base_url === "string"
      || typeof value.connect_url === "string"
      || typeof value.message === "string"
  );
}

function hasStudioMarker(payload, headerValue) {
  if (headerValue === STUDIO_DISCOVERY_HEADER_VALUE) return true;

  return Boolean(
    payload
      && (
        payload.local_studio === true
        || payload.studio === STUDIO_DISCOVERY_BODY_VALUE
      )
  );
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

    const payload = await response.json();
    const headerValue = response.headers.get(STUDIO_DISCOVERY_HEADER_NAME);
    if (headerValue && headerValue !== STUDIO_DISCOVERY_HEADER_VALUE) return null;
    if (!isLocalStudioStatusPayload(payload, { markedLocal: headerValue === STUDIO_DISCOVERY_HEADER_VALUE })) {
      return null;
    }
    if (!hasStudioMarker(payload, headerValue)) return null;

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


export {discoverLocalStudioBaseUrl, normalizeLoopbackBaseUrl, probeLocalStudio, saveCachedLocalStudioBaseUrl, clearCachedLocalStudioBaseUrl};

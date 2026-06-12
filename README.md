# Manimate In Chrome

Chrome extension for sending the current page into Manimate.

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this repo folder

## Behavior

- Prefills the prompt from the active tab when the page is `http:` or `https:`
- Opens Manimate with the selected logical runtime `model` (`claude` or `codex`), `voice`, and `aspectRatio`
- Sends local Studio launches as query params so the current app can read them immediately
- Uses the URL hash for cloud launch payload transport so long prompts avoid request-line limits
- Opens cloud launches on `/launch`, which stores a short launch intent before auth redirects
- Keeps the local launch bridge for older hash-based local launch links
- Probes local Studio on `http://127.0.0.1:32179-32198` and `http://localhost:32179-32198`
- Normalizes loopback matches to `http://127.0.0.1:<port>`
- Reuses cached local Studio URLs only inside the `32179-32198` range
- Falls back to `https://manimate.ai` when no verified local Studio is available

## Safety

- Ignores non-`http(s)` pages such as `chrome://`
- Accepts a local target only when it returns the Manimate discovery marker
- Sends only allowlisted `model` values (`claude` or `codex`) and `aspect_ratio` values plus a validated `voice_id`
- Opens cloud launches on `/launch` so auth redirects only need to preserve a short launch pointer

## Files

- `manifest.json` - MV3 manifest
- `popup.html` - popup UI
- `popup.js` - discovery and launch logic
- `popup.css` - popup styles

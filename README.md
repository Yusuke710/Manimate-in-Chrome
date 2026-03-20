# Manimate In Chrome

Chrome extension v1 for launching the current page into Manimate.

## V1 Scope

- Click the toolbar icon to open a popup that mirrors Manimate's landing-page composer
- The popup prefills the prompt with the current page URL when it is `http:` or `https:`
- The user can edit the prompt before launch
- The popup uses Manimate-style dropdown controls for model, voice, and aspect ratio
- Clicking the send button opens Manimate in a new tab using `/app?...` deep links

This extension is intentionally independent from `Manimate-Infra`. It is a separate repo, but it follows the deep-link contract documented in the infra repo at:

- `Manimate-Infra/docs/2026-03-20-chrome-extension-integration.md`

## Local Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this repo folder

## Configuration

The extension targets `https://manimate.ai`.

If you want to point it at local dev instead, change `MANIMATE_BASE_URL` in [popup.js](/Users/ymiy/github/2026/Manimate-in-Chrome/popup.js#L1) and reload the unpacked extension.

The extension stores the user's selected:

- `model`
- `voice`
- `aspectRatio`

## Security Notes

- The extension only auto-prefills from `http:` and `https:` tabs
- It rejects internal browser pages such as `chrome://`
- It always constructs the destination from a fixed site origin in code
- It only sends allowlisted `model`, `voice_id`, and `aspect_ratio` values
- It opens `/app`, not `/`, so login redirects preserve the prompt safely

## File Layout

- `manifest.json` - MV3 manifest
- `logo.svg` - copied Manimate wordmark for popup branding
- `popup.html` - toolbar popup UI
- `popup.js` - popup behavior and launch logic
- `popup.css` - popup styles

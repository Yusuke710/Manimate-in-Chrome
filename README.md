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

The extension auto-discovers a local Manimate Studio instance first by probing:

- `http://127.0.0.1:3000-3019`
- `http://localhost:3000-3019`

It only accepts ports that return the dedicated Manimate Studio discovery marker. If no verified local Studio responds, it falls back to `https://manimate.ai`.

The extension stores the user's selected:

- `model`
- `voice` (`No Voice`, `Yusuke`, or a pasted voice ID)
- `aspectRatio`

## Security Notes

- The extension only auto-prefills from `http:` and `https:` tabs
- It rejects internal browser pages such as `chrome://`
- It only switches to local Studio when a port returns the expected Manimate discovery marker
- It falls back to `https://manimate.ai` when no verified local Studio is available
- It only sends allowlisted `model` and `aspect_ratio` values, plus a validated `voice_id`
- Voice setup stays in Manimate Studio; the extension does not manage ElevenLabs keys or voice browsing
- It opens `/app`, not `/`, so login redirects preserve the prompt safely

## File Layout

- `manifest.json` - MV3 manifest
- `logo.svg` - copied Manimate wordmark for popup branding
- `popup.html` - toolbar popup UI
- `popup.js` - popup behavior and launch logic
- `popup.css` - popup styles

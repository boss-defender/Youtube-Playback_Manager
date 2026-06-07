# YouTube Music Tutorial Playback Manager

A Manifest V3 Chrome extension for Windows Chrome that keeps YouTube Music and one YouTube tutorial tab from playing over each other.

## Behavior

- YouTube Music pages are detected on `music.youtube.com`.
- Tutorial pages are detected on `youtube.com/watch`, `youtube.com/shorts/...`, and `youtube.com/embed/...`.
- If a tutorial starts playing while YouTube Music is playing, the extension pauses YouTube Music immediately.
- When that tutorial pauses or ends, YouTube Music resumes after a short debounce only if it was playing before the tutorial took over.
- If YouTube Music was already manually paused before the tutorial started, the extension does not resume it.
- Other websites and non-video YouTube pages are ignored.

## Files

```text
youtube-playback-manager/
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  styles.css
  rules.js
  test-rules.js
  README.md
```

## Install In Chrome

1. Open Chrome on Windows.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder: `youtube-playback-manager`.
6. Keep YouTube Music open in one tab and a tutorial video open in another tab.
7. Click the extension icon to enable or disable automation, rescan tabs, or manually pause/resume music.

## Notes

- Chrome may block programmatic resume if the tab has never been user-started. Start YouTube Music manually once; after that, resuming a track that this extension paused should work normally.
- The extension stores only the enabled/disabled setting in local Chrome extension storage.
- No browsing history is collected or sent anywhere.

## Development Test

Run the pure playback-rule test with Node:

```powershell
node test-rules.js
```

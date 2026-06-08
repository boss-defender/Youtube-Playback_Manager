# YouTube Playback Link (Chrome Extension - Manifest V3)

A lightweight and clever Google Chrome Extension that automatically coordinates playback between YouTube video pages (e.g., coding tutorials or lecture classes) and YouTube Music tabs. 

No more switching tabs manually to pause your background study beats when clicking "play" on a tutorial!

---

## 🚀 Key Features

* **Instant Pause**: Pauses any active YouTube Music tab immediately when you click Play on a youtube.com tutorial or review video.
* **Intelligent Auto-Resume**: Automatically resumes your YouTube Music playback 1.2 seconds after you pause or finish the tutorial video.
* **User Override Guard**: Detects if you manually clicked "pause" on your YouTube Music before starting a tutorial, and safely protects that choice by *not* autoplaying when the tutorial stops.
* **Debounce Buffer**: Prevents rapid pause/play loops when scrubbing tracks or clicking around.
* **Integrated Popup Control Panel**: Toggle sync behaviors instantly, see open matching tabs and their real-time states, and control any tab manually with one click.

---

## 🛠️ Step-by-Step Installation Guide

To install this Chrome Extension as an "unpacked developer extension", follow these quick steps:

1. **Download the Extension Files**
   * Make sure you have the files downloaded and located in a single directory on your machine (e.g., a folder named `youtube-playback-link` containing `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `styles.css`, and an `icons` folder).

2. **Open Chrome Extension Management**
   * Open your Google Chrome browser.
   * In the address bar, type `chrome://extensions/` and hit **Enter**.
   * Alternatively, click the puzzle piece icon (Extensions) in the top-right corner and select **Manage Extensions**.

3. **Enable Developer Mode**
   * In the top-right corner of the Extensions page, find the toggle labeled **Developer mode**.
   * Turn the toggle **ON** (active). Additional execution buttons will slide into view on the top-left.

4. **Load the Unpacked Folder**
   * Click the **Load unpacked** button in the top-left corner.
   * A folder picker dialog will open. Navigate to and select the `youtube-playback-link` directory containing the unpacked files.
   * Click **Select Folder** (or **Open**).

5. **Pin the Shortcut (Optional, Recommended)**
   * Click the puzzle icon next to your profile picture in Chrome's top toolbar.
   * Find **YT Playback Link** in the dropdown list and click the **Pin** icon. This places the direct popup dashboard icon right in your browser toolbar!

---

## 🎯 Verification & How to Use

1. **Open YouTube Music** in a standard Chrome tab, search for your favorite lofi study beats stream, and start playing: `https://music.youtube.com`.
2. **Open YouTube** in a separate Chrome tab, navigate to any video tutorial or lecture, and keep it loaded: `https://www.youtube.com`.
3. Go back to your tutorial tab and click **Play**:
   * *Observe:* The YouTube Music tab immediately pauses music!
4. Click **Pause** on your tutorial video:
   * *Observe:* After 1.2 seconds of buffer debounce, the YouTube Music tab automatically starts playing again!
5. Open the Extension's toolbar popup:
   * Play/pause individual music tracks, review active tabs matching YouTube origins in real-time, or toggle the automatic Sync toggle **ON/OFF**!

---

## 📂 File Manifest List

* `manifest.json` - Defines Chrome permissions (`tabs`, `storage`), host patterns, background service workers, and script assets.
* `background.js` - The Manifest V3 Background Service Worker containing the central synchronization state machine.
* `content.js` - Lightweight MutationObserver script injected into YouTube pages that hooks `<video>` HTML5 elements.
* `popup.html` - Premium styled control panel dashboard with reactive elements.
* `popup.js` - Logic controller for interactive checkboxes, rescanning tabs, and manual trigger controls.
* `styles.css` - Clean, minimalist charcoal slate UI styles with modern typography.

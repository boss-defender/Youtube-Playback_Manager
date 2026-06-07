const MESSAGE = {
  GET_STATUS: "GET_STATUS",
  SET_ENABLED: "SET_ENABLED",
  RESCAN_TABS: "RESCAN_TABS",
  MANUAL_PAUSE_MUSIC: "MANUAL_PAUSE_MUSIC",
  MANUAL_RESUME_MUSIC: "MANUAL_RESUME_MUSIC",
  STATUS_CHANGED: "STATUS_CHANGED"
};

const enabledToggle = document.getElementById("enabledToggle");
const statusText = document.getElementById("statusText");
const musicState = document.getElementById("musicState");
const musicTitle = document.getElementById("musicTitle");
const tutorialState = document.getElementById("tutorialState");
const tutorialTitle = document.getElementById("tutorialTitle");
const rescanButton = document.getElementById("rescanButton");
const pauseMusicButton = document.getElementById("pauseMusicButton");
const resumeMusicButton = document.getElementById("resumeMusicButton");

document.addEventListener("DOMContentLoaded", refresh);

enabledToggle.addEventListener("change", async () => {
  const status = await sendMessage({ type: MESSAGE.SET_ENABLED, enabled: enabledToggle.checked });
  renderStatus(status);
});

rescanButton.addEventListener("click", async () => {
  setBusy(rescanButton, true);
  const status = await sendMessage({ type: MESSAGE.RESCAN_TABS });
  renderStatus(status);
  setBusy(rescanButton, false);
});

pauseMusicButton.addEventListener("click", async () => {
  const status = await sendMessage({ type: MESSAGE.MANUAL_PAUSE_MUSIC });
  renderStatus(status);
});

resumeMusicButton.addEventListener("click", async () => {
  const status = await sendMessage({ type: MESSAGE.MANUAL_RESUME_MUSIC });
  renderStatus(status);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === MESSAGE.STATUS_CHANGED) {
    renderStatus(message.status);
  }
});

async function refresh() {
  renderStatus(await sendMessage({ type: MESSAGE.GET_STATUS }));
}

function renderStatus(status) {
  if (!status) {
    statusText.textContent = "Background service worker unavailable.";
    return;
  }

  enabledToggle.checked = Boolean(status.enabled);
  statusText.textContent = status.status || "Ready.";
  renderTab(musicState, musicTitle, status.music, "Music");
  renderTab(tutorialState, tutorialTitle, status.tutorial, "Tutorial");

  const hasMusic = Boolean(status.music);
  pauseMusicButton.disabled = !hasMusic;
  resumeMusicButton.disabled = !hasMusic;
}

function renderTab(stateElement, titleElement, tab, fallbackLabel) {
  if (!tab) {
    stateElement.textContent = "Not detected";
    titleElement.textContent = "";
    return;
  }

  stateElement.textContent = tab.playing ? "Playing" : tab.ended ? "Ended" : "Paused";
  titleElement.textContent = tab.title || fallbackLabel;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.dataset.busy = busy ? "true" : "false";
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

importScripts("rules.js");

const MESSAGE = {
  PLAYBACK_STATE: "PLAYBACK_STATE",
  CONTROL_MEDIA: "CONTROL_MEDIA",
  GET_STATUS: "GET_STATUS",
  SET_ENABLED: "SET_ENABLED",
  RESCAN_TABS: "RESCAN_TABS",
  MANUAL_PAUSE_MUSIC: "MANUAL_PAUSE_MUSIC",
  MANUAL_RESUME_MUSIC: "MANUAL_RESUME_MUSIC",
  STATUS_CHANGED: "STATUS_CHANGED"
};

const RESUME_DEBOUNCE_MS = 900;
const YOUTUBE_URLS = [
  "https://music.youtube.com/*",
  "https://www.youtube.com/*",
  "https://youtube.com/*"
];

const tabsById = new Map();
let ruleState = YouTubePlaybackRules.createInitialRuleState();
let resumeTimer = null;
let lastStatus = "Scanning YouTube tabs...";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true });
  scanOpenTabs();
});

chrome.runtime.onStartup.addListener(() => {
  loadSettings().then(scanOpenTabs);
});

loadSettings().then(scanOpenTabs);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;

  if (message && message.type === MESSAGE.PLAYBACK_STATE && tabId != null) {
    handlePlaybackState(tabId, message.state);
    sendResponse({ ok: true });
    return false;
  }

  if (message && message.type === MESSAGE.GET_STATUS) {
    sendResponse(getPopupStatus());
    return false;
  }

  if (message && message.type === MESSAGE.SET_ENABLED) {
    setEnabled(Boolean(message.enabled)).then(sendResponse);
    return true;
  }

  if (message && message.type === MESSAGE.RESCAN_TABS) {
    scanOpenTabs().then(() => sendResponse(getPopupStatus()));
    return true;
  }

  if (message && message.type === MESSAGE.MANUAL_PAUSE_MUSIC) {
    controlSelectedMusic("pause", "popup-manual-pause").then(sendResponse);
    return true;
  }

  if (message && message.type === MESSAGE.MANUAL_RESUME_MUSIC) {
    controlSelectedMusic("play", "popup-manual-resume").then(sendResponse);
    return true;
  }

  return false;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  const tab = tabsById.get(tabId);
  if (!tab || tab.kind !== "tutorial") {
    return;
  }

  // Activation itself does not force autoplay. It asks the page for fresh state
  // and immediately enforces the one-audio-source rule if the tutorial is playing.
  requestTabState(tabId);
  if (tab.playing) {
    applyRuleEvent({ type: "TUTORIAL_STATE", tabId, playing: true });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    tabsById.delete(tabId);
    updateStatus("Waiting for YouTube page state...");
  }

  if (changeInfo.status === "complete" && isYouTubeUrl(tab.url || changeInfo.url || "")) {
    requestTabState(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsById.delete(tabId);
  if (ruleState.musicTabId === tabId) {
    ruleState.musicTabId = null;
    ruleState.musicPlaying = false;
  }
  if (ruleState.tutorialTabId === tabId) {
    clearResumeTimer();
    ruleState.tutorialTabId = null;
    ruleState.tutorialPlaying = false;
    ruleState.takeover = YouTubePlaybackRules.createInitialRuleState().takeover;
  }
  updateStatusFromState();
});

async function loadSettings() {
  const stored = await chrome.storage.local.get({ enabled: true });
  ruleState = YouTubePlaybackRules.createInitialRuleState();
  ruleState.enabled = Boolean(stored.enabled);
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ enabled });
  clearResumeTimer();
  applyRuleEvent({ type: "SET_ENABLED", enabled });
  updateStatus(enabled ? "Enabled. Watching YouTube tabs." : "Disabled.");
  return getPopupStatus();
}

async function scanOpenTabs() {
  const tabs = await chrome.tabs.query({ url: YOUTUBE_URLS });
  await Promise.all(tabs.map((tab) => requestTabState(tab.id)));
  updateStatusFromState();
}

async function requestTabState(tabId) {
  if (tabId == null) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "REQUEST_PLAYBACK_STATE" });
  } catch (error) {
    // Content scripts may not be injected yet during reloads. The next page event
    // or rescan will fill the state back in.
  }
}

function handlePlaybackState(tabId, state) {
  if (!state || state.kind === "other") {
    return;
  }

  const previous = tabsById.get(tabId) || {};
  const tabState = {
    ...previous,
    ...state,
    tabId,
    lastSeenAt: Date.now()
  };
  tabsById.set(tabId, tabState);

  if (state.kind === "music") {
    applyRuleEvent({ type: "MUSIC_STATE", tabId, playing: state.playing });
  }

  if (state.kind === "tutorial") {
    applyRuleEvent({ type: "TUTORIAL_STATE", tabId, playing: state.playing });
  }

  updateStatusFromState();
}

function applyRuleEvent(event) {
  const result = YouTubePlaybackRules.reducePlaybackEvent(ruleState, event);
  ruleState = result.state;

  for (const action of result.actions) {
    if (action.type === "PAUSE_MUSIC") {
      clearResumeTimer();
      sendMediaCommand(action.tabId, "pause", "tutorial-takeover");
    }

    if (action.type === "CANCEL_RESUME") {
      clearResumeTimer();
    }

    if (action.type === "RESUME_MUSIC_DEBOUNCED") {
      scheduleResume(action.tabId);
    }
  }
}

function scheduleResume(tabId) {
  clearResumeTimer();
  resumeTimer = setTimeout(() => {
    const tutorial = tabsById.get(ruleState.tutorialTabId);
    const music = tabsById.get(tabId);
    resumeTimer = null;

    if (!ruleState.enabled || !music || music.kind !== "music") {
      ruleState.takeover.resumePending = false;
      return;
    }

    if (tutorial && tutorial.playing) {
      ruleState.takeover.resumePending = false;
      return;
    }

    sendMediaCommand(tabId, "play", "tutorial-released");
  }, RESUME_DEBOUNCE_MS);
}

function clearResumeTimer() {
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
}

async function controlSelectedMusic(command, reason) {
  const musicTab = getSelectedMusicTab();
  if (!musicTab) {
    return { ok: false, error: "No YouTube Music tab found.", ...getPopupStatus() };
  }

  const result = await sendMediaCommand(musicTab.tabId, command, reason);
  return { ok: result.ok, error: result.error, ...getPopupStatus() };
}

function getSelectedMusicTab() {
  const current = tabsById.get(ruleState.musicTabId);
  if (current && current.kind === "music") {
    return current;
  }

  return [...tabsById.values()]
    .filter((tab) => tab.kind === "music")
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
}

async function sendMediaCommand(tabId, command, reason) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE.CONTROL_MEDIA,
      command,
      reason,
      requestId: crypto.randomUUID()
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error && error.message ? error.message : String(error) };
  }
}

function getPopupStatus() {
  const music = getSelectedMusicTab();
  const tutorial = tabsById.get(ruleState.tutorialTabId);

  return {
    enabled: ruleState.enabled,
    status: lastStatus,
    music: summarizeTab(music),
    tutorial: summarizeTab(tutorial),
    takeover: ruleState.takeover
  };
}

function summarizeTab(tab) {
  if (!tab) {
    return null;
  }

  return {
    tabId: tab.tabId,
    title: tab.title || "",
    url: tab.url || "",
    playing: Boolean(tab.playing),
    paused: Boolean(tab.paused),
    ended: Boolean(tab.ended)
  };
}

function updateStatusFromState() {
  const music = getSelectedMusicTab();
  const tutorial = tabsById.get(ruleState.tutorialTabId);

  if (!ruleState.enabled) {
    updateStatus("Disabled.");
    return;
  }

  if (!music && !tutorial) {
    updateStatus("No matching YouTube Music or tutorial tabs detected.");
    return;
  }

  if (tutorial && tutorial.playing) {
    updateStatus("Tutorial is playing. YouTube Music is kept paused.");
    return;
  }

  if (music && music.playing) {
    updateStatus("YouTube Music is playing. Waiting for tutorial playback.");
    return;
  }

  updateStatus("Ready. Only YouTube Music and tutorial tabs are managed.");
}

function updateStatus(status) {
  lastStatus = status;
  chrome.runtime.sendMessage({ type: MESSAGE.STATUS_CHANGED, status: getPopupStatus() }).catch(() => {});
}

function isYouTubeUrl(url) {
  return /^https:\/\/(music\.youtube\.com|www\.youtube\.com|youtube\.com)\//.test(url || "");
}

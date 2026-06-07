const MESSAGE = {
  PLAYBACK_STATE: "PLAYBACK_STATE",
  CONTROL_MEDIA: "CONTROL_MEDIA"
};

let currentVideo = null;
let lastStateKey = "";
let reportTimer = null;
let urlBeforeNavigation = location.href;

bindVideo();
installNavigationHooks();
reportSoon(100);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "REQUEST_PLAYBACK_STATE") {
    bindVideo();
    reportState(true);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === MESSAGE.CONTROL_MEDIA) {
    controlMedia(message.command)
      .then((result) => {
        reportSoon(0);
        sendResponse(result);
      })
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});

function classifyPage() {
  const hostname = location.hostname;
  const pathname = location.pathname;

  if (hostname === "music.youtube.com") {
    return "music";
  }

  if ((hostname === "www.youtube.com" || hostname === "youtube.com") && isTutorialPath(pathname)) {
    return "tutorial";
  }

  return "other";
}

function isTutorialPath(pathname) {
  return pathname === "/watch" || pathname.startsWith("/shorts/") || pathname.startsWith("/embed/");
}

function bindVideo() {
  const video = findBestVideo();
  if (video === currentVideo) {
    return;
  }

  if (currentVideo) {
    removeVideoListeners(currentVideo);
  }

  currentVideo = video;

  if (currentVideo) {
    addVideoListeners(currentVideo);
  }
}

function findBestVideo() {
  const videos = [...document.querySelectorAll("video")];
  if (!videos.length) {
    return null;
  }

  return videos.find((video) => video.readyState > 0) || videos[0];
}

function addVideoListeners(video) {
  for (const eventName of ["play", "playing", "pause", "ended", "emptied", "loadedmetadata", "ratechange", "volumechange"]) {
    video.addEventListener(eventName, onVideoEvent, true);
  }
}

function removeVideoListeners(video) {
  for (const eventName of ["play", "playing", "pause", "ended", "emptied", "loadedmetadata", "ratechange", "volumechange"]) {
    video.removeEventListener(eventName, onVideoEvent, true);
  }
}

function onVideoEvent() {
  reportSoon(60);
}

function reportSoon(delay) {
  clearTimeout(reportTimer);
  reportTimer = setTimeout(() => {
    bindVideo();
    reportState(false);
  }, delay);
}

function reportState(force) {
  const kind = classifyPage();
  const video = currentVideo;
  const state = {
    kind,
    url: location.href,
    title: document.title,
    hasVideo: Boolean(video),
    playing: Boolean(video && !video.paused && !video.ended && video.readyState > 0),
    paused: Boolean(video && video.paused && !video.ended),
    ended: Boolean(video && video.ended),
    currentTime: video ? video.currentTime : 0,
    duration: Number.isFinite(video && video.duration) ? video.duration : 0,
    muted: Boolean(video && video.muted),
    volume: video ? video.volume : 1,
    reportedAt: Date.now()
  };

  const stateKey = [
    state.kind,
    state.url,
    state.hasVideo,
    state.playing,
    state.paused,
    state.ended,
    Math.floor(state.currentTime)
  ].join("|");

  if (!force && stateKey === lastStateKey) {
    return;
  }

  lastStateKey = stateKey;
  chrome.runtime.sendMessage({ type: MESSAGE.PLAYBACK_STATE, state }).catch(() => {});
}

async function controlMedia(command) {
  bindVideo();

  if (!currentVideo) {
    return { ok: false, error: "No video element found on this page." };
  }

  if (command === "pause") {
    if (!currentVideo.paused) {
      currentVideo.pause();
    }
    return { ok: true };
  }

  if (command === "play") {
    if (currentVideo.paused || currentVideo.ended) {
      await currentVideo.play();
    }
    return { ok: true };
  }

  return { ok: false, error: `Unknown command: ${command}` };
}

function installNavigationHooks() {
  const observer = new MutationObserver(() => {
    bindVideo();
    if (location.href !== urlBeforeNavigation) {
      urlBeforeNavigation = location.href;
      lastStateKey = "";
      reportSoon(150);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("yt-navigate-finish", () => {
    urlBeforeNavigation = location.href;
    lastStateKey = "";
    bindVideo();
    reportSoon(150);
  });

  window.addEventListener("popstate", () => {
    urlBeforeNavigation = location.href;
    lastStateKey = "";
    reportSoon(150);
  });
}

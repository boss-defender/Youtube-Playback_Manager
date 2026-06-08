// State tracking for all connected YouTube & YouTube Music tabs
let tabStates = {};
// Keeps track of the last commands sent to prevent race conditions or confusing user intent
let commandHistory = {}; 
// Whether the sync behavior is globally enabled
let isEnabled = true;
// Stores if YouTube Music was playing before a tutorial started playing
let musicWasPlayingBeforeTutorial = false;
// Active debounce timer for auto-resuming music when tutorial pauses
let resumeDebounceTimer = null;

// Initialize state from storage
chrome.storage.local.get(['isEnabled', 'musicWasPlayingBeforeTutorial'], (result) => {
  if (result.isEnabled !== undefined) {
    isEnabled = result.isEnabled;
  }
  if (result.musicWasPlayingBeforeTutorial !== undefined) {
    musicWasPlayingBeforeTutorial = result.musicWasPlayingBeforeTutorial;
  }
  console.log('[Background] Initialized. Enabled State:', isEnabled, 'Music previously playing:', musicWasPlayingBeforeTutorial);
});

// Sync local states when storage changes (e.g. from popup toggle)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.isEnabled) {
      isEnabled = changes.isEnabled.newValue;
      console.log('[Background] Sync state updated to:', isEnabled);
      if (!isEnabled) {
        // Clear variables when disabled
        if (resumeDebounceTimer) {
          clearTimeout(resumeDebounceTimer);
          resumeDebounceTimer = null;
        }
        // Reset state
        Object.keys(tabStates).forEach(id => {
          if (tabStates[id]) tabStates[id].pausedByExtension = false;
        });
        chrome.storage.local.set({ musicWasPlayingBeforeTutorial: false });
      }
    }
    if (changes.musicWasPlayingBeforeTutorial) {
      musicWasPlayingBeforeTutorial = changes.musicWasPlayingBeforeTutorial.newValue;
    }
  }
});

// Listen to reports from content scripts and popups
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLAYBACK_STATE_CHANGE') {
    if (sender.tab && sender.tab.id) {
      handlePlaybackStateChange(sender.tab.id, message);
    }
  } else if (message.type === 'GET_STATUS') {
    sendResponse({
      isEnabled,
      tabStates,
      musicWasPlayingBeforeTutorial
    });
  } else if (message.type === 'RESCAN_TABS') {
    rescanOpenTabs().then((result) => {
      sendResponse(result);
    });
    return true; // Keep response channel open for async response
  } else if (message.type === 'MANUAL_CONTROL') {
    handleManualControl(message.tabId, message.action);
    sendResponse({ success: true });
  }
});

// Clean up state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates[tabId]) {
    console.log(`[Background] Tab ${tabId} closed. Cleaning up state.`);
    delete tabStates[tabId];
    delete commandHistory[tabId];
    coordinatePlayback();
  }
});

// Clear tracker if user navigates away from YouTube
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const isYouTube = changeInfo.url.includes('youtube.com');
    if (!isYouTube) {
      if (tabStates[tabId]) {
        console.log(`[Background] Tab ${tabId} left YouTube. Removing tracker.`);
        delete tabStates[tabId];
        coordinatePlayback();
      }
    }
  }
});

function handlePlaybackStateChange(tabId, state) {
  const isMusic = state.isMusic;
  const isPlaying = state.isPlaying;
  const title = state.title || 'YouTube Tab';

  const prevState = tabStates[tabId];
  const hadPrevState = !!prevState;
  const wasPrevPlaying = hadPrevState ? prevState.isPlaying : false;

  // Sync state verification: check if this is an extension command output
  const lastCmd = commandHistory[tabId];
  let isFromExtension = false;
  
  if (lastCmd && (Date.now() - lastCmd.timestamp < 3000)) {
    if ((lastCmd.action === 'PAUSE' && !isPlaying) || (lastCmd.action === 'PLAY' && isPlaying)) {
      isFromExtension = true;
    }
  }

  // Record newest state from tab content script
  tabStates[tabId] = {
    id: tabId,
    isMusic,
    isPlaying,
    title,
    isMuted: state.isMuted,
    lastUpdated: Date.now(),
    pausedByExtension: prevState ? prevState.pausedByExtension : false
  };

  // Keep track of user's intention
  if (hadPrevState && wasPrevPlaying !== isPlaying && !isFromExtension) {
    if (isMusic) {
      if (!isPlaying) {
        // User manually paused the music - cancel our auto-resume memory
        console.log(`[Background] User manually PAUSED music on tab ${tabId}. Deactivating auto-resume tracker.`);
        tabStates[tabId].pausedByExtension = false;
        chrome.storage.local.set({ musicWasPlayingBeforeTutorial: false });
      } else {
        // User manually played music - reset pausedByExtension flag
        console.log(`[Background] User manually PLAYED music on tab ${tabId}. Resetting pausedByExtension flag.`);
        tabStates[tabId].pausedByExtension = false;
      }
    }
  }

  coordinatePlayback();
}

// Sends actual JS command to a tab
function sendPlaybackCommand(tabId, action) {
  console.log(`[Background] Sending command: ${action} to TabID: ${tabId}`);
  commandHistory[tabId] = {
    action,
    timestamp: Date.now()
  };

  chrome.tabs.sendMessage(tabId, { type: `COMMAND_${action}` }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(`[Background] Failed to message Tab ${tabId}:`, chrome.runtime.lastError.message);
    }
  });
}

// Logic coordinator
function coordinatePlayback() {
  if (!isEnabled) return;

  const tabs = Object.values(tabStates);
  const playingTutorials = tabs.filter(t => !t.isMusic && t.isPlaying);
  const musicTabs = tabs.filter(t => t.isMusic);

  const isAnyTutorialPlaying = playingTutorials.length > 0;

  if (isAnyTutorialPlaying) {
    // Instantly cancel any pending timers to resume music
    if (resumeDebounceTimer) {
      clearTimeout(resumeDebounceTimer);
      resumeDebounceTimer = null;
    }

    // A tutorial is active and playing. Check if any music tab is active and pause it!
    let musicWasPlaying = false;

    musicTabs.forEach(music => {
      if (music.isPlaying) {
        musicWasPlaying = true;
        music.pausedByExtension = true;
        sendPlaybackCommand(music.id, 'PAUSE');
      }
    });

    if (musicWasPlaying) {
      console.log('[Background] Tutorial active. Paused matching YT Music tab, saved resume intent.');
      chrome.storage.local.set({ musicWasPlayingBeforeTutorial: true });
    }
  } else {
    // If no tutorial is currently playing, check if we need to resume the music tab
    if (musicWasPlayingBeforeTutorial) {
      const pausedMusicTabs = musicTabs.filter(mt => mt.pausedByExtension === true);
      
      if (pausedMusicTabs.length > 0 && !resumeDebounceTimer) {
        console.log('[Background] Tutorials paused. Scheduling YT Music resume in 1200ms...');
        resumeDebounceTimer = setTimeout(() => {
          resumeDebounceTimer = null;

          // Double check no other tutorial started playing in the meantime
          const activeTutorials = Object.values(tabStates).filter(t => !t.isMusic && t.isPlaying);
          if (activeTutorials.length === 0) {
            console.log('[Background] Double check complete: Resuming paused Music tabs.');
            pausedMusicTabs.forEach(mt => {
              mt.pausedByExtension = false;
              sendPlaybackCommand(mt.id, 'PLAY');
            });
            chrome.storage.local.set({ musicWasPlayingBeforeTutorial: false });
          } else {
            console.log('[Background] Resume aborted: Another tutorial tab started playing.');
          }
        }, 1200);
      }
    }
  }
}

// Allow manual force play/pause triggers from extension UI
function handleManualControl(tabId, action) {
  if (tabStates[tabId]) {
    sendPlaybackCommand(tabId, action);
    // Overwrite manual flag so it updates beautifully
    if (action === 'PAUSE' && tabStates[tabId].isMusic) {
      tabStates[tabId].pausedByExtension = false;
    }
  }
}

// Query all tabs matching YouTube patterns on startup or manual refresh
async function rescanOpenTabs() {
  console.log('[Background] Performing manual rescan...');
  tabStates = {};
  commandHistory = {};

  try {
    const tabs = await chrome.tabs.query({
      url: ['*://*.youtube.com/*', '*://music.youtube.com/*']
    });

    console.log(`[Background] Query found ${tabs.length} tabs matching.`);

    for (const tab of tabs) {
      const isMusic = tab.url && tab.url.includes('music.youtube.com');
      
      // Let's create an initial placeholder state
      tabStates[tab.id] = {
        id: tab.id,
        isMusic,
        isPlaying: false, // Will be updated by state response or message report
        title: tab.title || (isMusic ? 'YouTube Music' : 'YouTube Video'),
        isMuted: false,
        lastUpdated: Date.now(),
        pausedByExtension: false
      };

      // Poll content script for state sync
      chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_CURRENT_STATE' }, (state) => {
        if (chrome.runtime.lastError) return; // Script might not be loaded yet
        if (state) {
          handlePlaybackStateChange(tab.id, state);
        }
      });
    }

    return { success: true, count: tabs.length };
  } catch (err) {
    console.error('[Background] Error rescanning:', err);
    return { success: false, error: err.toString() };
  }
}

// Trigger initial scan
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isEnabled: true, musicWasPlayingBeforeTutorial: false });
  console.log('[Background] Installed. Running initial scan...');
  setTimeout(rescanOpenTabs, 1000);
});

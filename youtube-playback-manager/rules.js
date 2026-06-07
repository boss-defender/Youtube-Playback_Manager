(function attachPlaybackRules(root) {
  "use strict";

  function createInitialRuleState() {
    return {
      enabled: true,
      musicTabId: null,
      tutorialTabId: null,
      musicPlaying: false,
      tutorialPlaying: false,
      takeover: {
        active: false,
        tutorialTabId: null,
        musicTabId: null,
        shouldResume: false,
        resumePending: false
      }
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function reducePlaybackEvent(previousState, event) {
    const state = cloneState(previousState || createInitialRuleState());
    const actions = [];

    if (event.type === "SET_ENABLED") {
      state.enabled = Boolean(event.enabled);
      if (!state.enabled) {
        state.takeover = createInitialRuleState().takeover;
      }
      return { state, actions };
    }

    if (event.type === "MUSIC_STATE") {
      state.musicTabId = event.tabId;
      state.musicPlaying = Boolean(event.playing);

      if (
        state.musicPlaying &&
        state.takeover.active &&
        state.takeover.musicTabId === event.tabId &&
        !state.tutorialPlaying
      ) {
        state.takeover = createInitialRuleState().takeover;
      }

      if (state.enabled && state.tutorialPlaying && state.musicPlaying) {
        state.takeover = {
          active: true,
          tutorialTabId: state.tutorialTabId,
          musicTabId: event.tabId,
          shouldResume: true,
          resumePending: false
        };
        actions.push({ type: "PAUSE_MUSIC", tabId: event.tabId });
      }

      return { state, actions };
    }

    if (event.type === "TUTORIAL_STATE") {
      state.tutorialTabId = event.tabId;
      state.tutorialPlaying = Boolean(event.playing);

      if (!state.enabled) {
        return { state, actions };
      }

      if (state.tutorialPlaying && state.musicTabId && state.musicPlaying) {
        state.takeover = {
          active: true,
          tutorialTabId: event.tabId,
          musicTabId: state.musicTabId,
          shouldResume: true,
          resumePending: false
        };
        actions.push({ type: "PAUSE_MUSIC", tabId: state.musicTabId });
      }

      if (state.tutorialPlaying && state.takeover.active && state.takeover.tutorialTabId === event.tabId) {
        if (state.takeover.resumePending) {
          actions.push({ type: "CANCEL_RESUME" });
        }
        state.takeover.resumePending = false;
      }

      if (!state.tutorialPlaying && state.takeover.active && state.takeover.tutorialTabId === event.tabId) {
        if (state.takeover.shouldResume && state.takeover.musicTabId && !state.takeover.resumePending) {
          actions.push({ type: "RESUME_MUSIC_DEBOUNCED", tabId: state.takeover.musicTabId });
          state.takeover.resumePending = true;
        }
      }

      return { state, actions };
    }

    return { state, actions };
  }

  const api = {
    createInitialRuleState,
    reducePlaybackEvent
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.YouTubePlaybackRules = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

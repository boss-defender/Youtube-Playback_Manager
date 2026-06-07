const assert = require("assert");
const { createInitialRuleState, reducePlaybackEvent } = require("./rules");

function apply(state, event) {
  return reducePlaybackEvent(state, event);
}

let state = createInitialRuleState();
let result = apply(state, { type: "MUSIC_STATE", tabId: 1, playing: true });
state = result.state;
assert.deepStrictEqual(result.actions, []);

result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: true });
state = result.state;
assert.deepStrictEqual(result.actions, [{ type: "PAUSE_MUSIC", tabId: 1 }]);
assert.strictEqual(state.takeover.shouldResume, true);

result = apply(state, { type: "MUSIC_STATE", tabId: 1, playing: false });
state = result.state;
assert.deepStrictEqual(result.actions, []);

result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: false });
state = result.state;
assert.deepStrictEqual(result.actions, [{ type: "RESUME_MUSIC_DEBOUNCED", tabId: 1 }]);
assert.strictEqual(state.takeover.resumePending, true);

result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: true });
state = result.state;
assert.deepStrictEqual(result.actions, [{ type: "CANCEL_RESUME" }]);
assert.strictEqual(state.takeover.shouldResume, true);

result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: false });
state = result.state;
assert.deepStrictEqual(result.actions, [{ type: "RESUME_MUSIC_DEBOUNCED", tabId: 1 }]);

result = apply(state, { type: "MUSIC_STATE", tabId: 1, playing: true });
state = result.state;
assert.strictEqual(state.takeover.active, false);

state = createInitialRuleState();
result = apply(state, { type: "MUSIC_STATE", tabId: 1, playing: false });
state = result.state;
result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: true });
state = result.state;
assert.deepStrictEqual(result.actions, []);
result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: false });
assert.deepStrictEqual(result.actions, []);

state = createInitialRuleState();
result = apply(state, { type: "SET_ENABLED", enabled: false });
state = result.state;
result = apply(state, { type: "MUSIC_STATE", tabId: 1, playing: true });
state = result.state;
result = apply(state, { type: "TUTORIAL_STATE", tabId: 2, playing: true });
assert.deepStrictEqual(result.actions, []);

console.log("All playback-rule tests passed.");

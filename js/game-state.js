// Brick: game-state | Stud: localStorage["confidencequest.v1"] | Socket: js/game-state.js
// The GameState singleton — single shared source of truth for ConfidenceQuest.
// Manages event name, archetype, companion config, level, badges, unlocks,
// per-node clear flags, and the derived Confidence Stat. Serialises to localStorage.

window.CQ = window.CQ || {};

(function () {
  'use strict';

  // ─── Schema ───────────────────────────────────────────────────────────────
  var STORAGE_KEY    = 'confidencequest.v1';
  var SCHEMA_VERSION = 1;

  // The five game nodes. The four training nodes each contribute 20% to stat;
  // boss-battle contributes the final 20% (total 100% at full clear).
  var TRAINING_NODES = ['breathe-runner', 'thought-buster', 'power-up-lab', 'star-forge'];
  var ALL_NODE_IDS   = TRAINING_NODES.concat(['boss-battle']);

  // ─── Default state factory ─────────────────────────────────────────────────
  function makeDefaults() {
    var nodes = {};
    ALL_NODE_IDS.forEach(function (id) { nodes[id] = false; });
    return {
      schemaVersion : SCHEMA_VERSION,
      eventName     : '',
      archetype     : 'unknown',          // "interrogator"|"critic"|"gatekeeper"|"unknown"
      companion     : { body: 'round', color: 'teal', expression: 'neutral' },
      level         : 0,                  // 0..6
      badges        : [],
      unlocks       : { bodies: [], colors: [], accessories: [] },
      nodes         : nodes,
      stat          : 0                   // 0..100, derived — see computeStat()
    };
  }

  // ─── Stat derivation ──────────────────────────────────────────────────────
  // Each training node = 20%, boss-battle = 20%, capped at 100.
  function computeStat(nodes) {
    var count = 0;
    ALL_NODE_IDS.forEach(function (id) {
      if (nodes[id]) { count += 20; }
    });
    return Math.min(count, 100);
  }

  // ─── localStorage helpers (private-mode safe) ─────────────────────────────
  function lsWrite(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CQ.state] localStorage write failed (private mode?):', e);
    }
  }

  function lsRead() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { return null; }
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[CQ.state] localStorage read/parse failed, falling back to defaults:', e);
      return null;
    }
  }

  function lsClear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[CQ.state] localStorage clear failed:', e);
    }
  }

  // ─── Schema-version guard ─────────────────────────────────────────────────
  // If the blob is absent, malformed, or from a different schema version,
  // return null so the caller falls back to defaults.
  function validateBlob(blob) {
    if (!blob || typeof blob !== 'object') { return null; }
    if (blob.schemaVersion !== SCHEMA_VERSION) { return null; }
    // Minimal structural check — must have nodes object
    if (!blob.nodes || typeof blob.nodes !== 'object') { return null; }
    return blob;
  }

  // Deep-merge a persisted blob onto defaults so new fields are always present
  // even when loading an older (same-version) save that pre-dates a new field.
  function mergeOntoDefaults(blob) {
    var defaults = makeDefaults();
    // Scalar fields
    var scalars = ['eventName', 'archetype', 'level', 'stat'];
    scalars.forEach(function (k) {
      if (blob[k] !== undefined) { defaults[k] = blob[k]; }
    });
    // companion (shallow merge of sub-object)
    if (blob.companion && typeof blob.companion === 'object') {
      defaults.companion = {
        body       : blob.companion.body       || defaults.companion.body,
        color      : blob.companion.color      || defaults.companion.color,
        expression : blob.companion.expression || defaults.companion.expression
      };
    }
    // badges (array)
    if (Array.isArray(blob.badges)) { defaults.badges = blob.badges; }
    // unlocks (sub-object with three arrays)
    if (blob.unlocks && typeof blob.unlocks === 'object') {
      defaults.unlocks = {
        bodies      : Array.isArray(blob.unlocks.bodies)      ? blob.unlocks.bodies      : [],
        colors      : Array.isArray(blob.unlocks.colors)      ? blob.unlocks.colors      : [],
        accessories : Array.isArray(blob.unlocks.accessories) ? blob.unlocks.accessories : []
      };
    }
    // nodes — only copy known ids; unknown keys are ignored
    ALL_NODE_IDS.forEach(function (id) {
      if (typeof blob.nodes[id] === 'boolean') {
        defaults.nodes[id] = blob.nodes[id];
      }
    });
    // Re-derive stat from persisted node flags (source of truth)
    defaults.stat = computeStat(defaults.nodes);
    return defaults;
  }

  // ─── Pub/sub ──────────────────────────────────────────────────────────────
  var _listeners = [];

  // ─── Internal mutable state ───────────────────────────────────────────────
  // Starts as defaults; overwritten by load().
  var _data = makeDefaults();

  // ─── Public API ───────────────────────────────────────────────────────────
  var state = {

    // Read-only projections — always reflect current _data.
    // Consumers should use subscribe() to be notified of changes.
    get eventName()  { return _data.eventName;  },
    get archetype()  { return _data.archetype;  },
    get companion()  { return _data.companion;  },
    get level()      { return _data.level;      },
    get badges()     { return _data.badges;     },
    get unlocks()    { return _data.unlocks;    },
    get nodes()      { return _data.nodes;      },
    get stat()       { return _data.stat;       },

    // load() — hydrate from localStorage on boot. Called once by app.js.
    load: function () {
      var blob = lsRead();
      var valid = validateBlob(blob);
      if (valid) {
        _data = mergeOntoDefaults(valid);
      } else {
        // Corrupted / old schema / absent — start fresh; remove bad blob.
        if (blob !== null) {
          console.warn('[CQ.state] Bad or stale save detected — resetting to defaults.');
          lsClear();
        }
        _data = makeDefaults();
      }
      // Do NOT notify here — app.js reads state synchronously after load().
    },

    // save() — persist _data now. Called automatically after every mutation.
    save: function () {
      lsWrite(_data);
    },

    // reset() — wipe to defaults (for testing / "start over").
    reset: function () {
      lsClear();
      _data = makeDefaults();
      state.notify();
    },

    // set(patch) — shallow-merge patch into _data, then save() + notify().
    // Handles nested companion and unlocks via one level of merging.
    set: function (patch) {
      if (!patch || typeof patch !== 'object') {
        console.error('[CQ.state] set() requires a plain object patch.');
        return;
      }
      Object.keys(patch).forEach(function (key) {
        var val = patch[key];
        if (key === 'companion' && val && typeof val === 'object') {
          _data.companion = {
            body       : val.body       !== undefined ? val.body       : _data.companion.body,
            color      : val.color      !== undefined ? val.color      : _data.companion.color,
            expression : val.expression !== undefined ? val.expression : _data.companion.expression
          };
        } else if (key === 'unlocks' && val && typeof val === 'object') {
          _data.unlocks = {
            bodies      : Array.isArray(val.bodies)      ? val.bodies      : _data.unlocks.bodies,
            colors      : Array.isArray(val.colors)      ? val.colors      : _data.unlocks.colors,
            accessories : Array.isArray(val.accessories) ? val.accessories : _data.unlocks.accessories
          };
        } else if (key === 'nodes') {
          // Merge individual node flags rather than replacing the whole object
          if (val && typeof val === 'object') {
            ALL_NODE_IDS.forEach(function (id) {
              if (typeof val[id] === 'boolean') { _data.nodes[id] = val[id]; }
            });
            _data.stat = computeStat(_data.nodes);
          }
        } else if (key === 'stat') {
          // stat is derived — silently ignore direct writes via set()
          console.warn('[CQ.state] set(): "stat" is derived and cannot be set directly; use clearNode().');
        } else {
          _data[key] = val;
        }
      });
      state.save();
      state.notify();
    },

    // clearNode(id) — mark a node cleared, recompute stat, save(), notify().
    clearNode: function (id) {
      if (ALL_NODE_IDS.indexOf(id) === -1) {
        console.error('[CQ.state] clearNode(): unknown node id "' + id + '".');
        return;
      }
      _data.nodes[id] = true;
      _data.stat = computeStat(_data.nodes);
      state.save();
      state.notify();
    },

    // subscribe(fn) — register a change listener; returns an unsubscribe fn.
    subscribe: function (fn) {
      if (typeof fn !== 'function') {
        console.error('[CQ.state] subscribe() requires a function.');
        return function () {};
      }
      _listeners.push(fn);
      return function unsubscribe() {
        var idx = _listeners.indexOf(fn);
        if (idx !== -1) { _listeners.splice(idx, 1); }
      };
    },

    // notify() — call all registered listeners (screens re-render on change).
    notify: function () {
      // Snapshot the list in case a listener unsubscribes itself mid-iteration.
      var snapshot = _listeners.slice();
      snapshot.forEach(function (fn) {
        try {
          fn(_data);
        } catch (e) {
          console.error('[CQ.state] Listener threw:', e);
        }
      });
    }
  };

  // Expose on the global namespace
  CQ.state = state;

}());

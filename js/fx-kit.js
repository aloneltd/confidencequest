// fx-kit.js — Canvas FX & Juice Library for ConfidenceQuest
// stud: css/theme.css (palette reference only, no runtime dependency)
// socket: window.CQ.fx (particleBurst, rafLoop, tween, shake, playCue)

window.CQ = window.CQ || {};

(function () {
  'use strict';

  // ── Palette ──────────────────────────────────────────────────────────────
  // Matches theme-kit tokens: amber, teal, gold, coral, indigo
  var DEFAULT_COLORS = ['#F5A623', '#00C9B1', '#FFD700', '#FF6B6B', '#7B68EE'];

  // ── WebAudio state ────────────────────────────────────────────────────────
  var _audioCtx = null;

  function _getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
    } catch (e) {
      _audioCtx = null;
    }
    return _audioCtx;
  }

  // Resume a suspended context (browsers suspend until a user gesture)
  function _resumeCtx(ctx) {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
  }

  // ── Easing ────────────────────────────────────────────────────────────────
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ── particleBurst ─────────────────────────────────────────────────────────
  /**
   * Spawns a short-lived particle burst drawn on `ctx`.
   * Manages its own rAF loop; stops automatically when all particles die.
   *
   * @param {CanvasRenderingContext2D} ctx  - Canvas 2D context to draw on.
   * @param {number} x                      - Burst origin X (canvas coords).
   * @param {number} y                      - Burst origin Y (canvas coords).
   * @param {object} [opts]
   *   @param {number}   [opts.count=24]    - Number of particles.
   *   @param {string[]} [opts.colors]      - Particle colors (defaults to palette).
   *   @param {number}   [opts.spread=120]  - Max initial speed in px/s.
   *   @param {number}   [opts.life=800]    - Particle lifespan in ms.
   *   @param {number}   [opts.radius=4]    - Particle start radius in px.
   */
  function particleBurst(ctx, x, y, opts) {
    if (!ctx) return;
    opts = opts || {};

    var count   = opts.count   !== undefined ? opts.count   : 24;
    var colors  = opts.colors  && opts.colors.length ? opts.colors : DEFAULT_COLORS;
    var spread  = opts.spread  !== undefined ? opts.spread  : 120;
    var life    = opts.life    !== undefined ? opts.life    : 800;
    var radius  = opts.radius  !== undefined ? opts.radius  : 4;

    var particles = [];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      var speed = spread * (0.4 + Math.random() * 0.6);
      particles.push({
        x:      x,
        y:      y,
        vx:     Math.cos(angle) * speed,
        vy:     Math.sin(angle) * speed - spread * 0.3, // upward bias
        color:  colors[Math.floor(Math.random() * colors.length)],
        born:   null,         // set on first frame
        life:   life * (0.7 + Math.random() * 0.3),
        r:      radius * (0.6 + Math.random() * 0.8),
        rot:    Math.random() * Math.PI * 2,
        rotV:   (Math.random() - 0.5) * 8
      });
    }

    var lastTime = null;

    function frame(ts) {
      if (lastTime === null) {
        lastTime = ts;
        // stamp born on first frame
        for (var j = 0; j < particles.length; j++) {
          particles[j].born = ts;
        }
      }
      var dt = ts - lastTime;
      lastTime = ts;

      var alive = 0;
      for (var k = 0; k < particles.length; k++) {
        var p = particles[k];
        var age = ts - p.born;
        if (age >= p.life) continue;
        alive++;

        var progress = age / p.life;
        var alpha = 1 - easeOutCubic(progress);

        // Physics: simple gravity
        p.vy += 200 * (dt / 1000);
        p.x  += p.vx * (dt / 1000);
        p.y  += p.vy * (dt / 1000);
        p.rot += p.rotV * (dt / 1000);

        var drawR = p.r * (1 - progress * 0.5);

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // Draw as a small rounded square for visual variety
        ctx.beginPath();
        ctx.rect(-drawR, -drawR, drawR * 2, drawR * 2);
        ctx.fill();
        ctx.restore();
      }

      if (alive > 0) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }

  // ── rafLoop ───────────────────────────────────────────────────────────────
  /**
   * Wraps requestAnimationFrame into a managed loop.
   * Passes delta-time (ms) to updateFn each frame.
   * The loop stops when updateFn returns false (strictly).
   *
   * @param {function(dt: number): boolean|undefined} updateFn
   * @returns {{ stop: function }}  handle with a .stop() method
   */
  function rafLoop(updateFn) {
    var running  = true;
    var lastTime = null;
    var rafId    = null;

    function tick(ts) {
      if (!running) return;
      if (lastTime === null) lastTime = ts;
      var dt = ts - lastTime;
      lastTime = ts;

      var result = updateFn(dt);
      if (result === false) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return {
      stop: function () {
        running = false;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };
  }

  // ── tween ─────────────────────────────────────────────────────────────────
  /**
   * Animates a numeric value from `from` to `to` over `ms` milliseconds.
   *
   * Signature:
   *   CQ.fx.tween(from, to, ms, ease, onUpdate, onDone)
   *
   * @param {number}   from       - Start value.
   * @param {number}   to         - End value.
   * @param {number}   ms         - Duration in milliseconds.
   * @param {function} [ease]     - Easing fn t→[0,1]; defaults to easeOutCubic.
   * @param {function} [onUpdate] - Called each frame with current value: onUpdate(value, t).
   * @param {function} [onDone]   - Called once when animation completes: onDone(to).
   *
   * Returns a Promise that resolves with the final value when the tween completes.
   * The tween also accepts a callback style via onUpdate/onDone for environments
   * where Promises aren't needed inline.
   *
   * Callers may also ignore the return value and rely solely on callbacks.
   *
   * @returns {Promise<number>}
   */
  function tween(from, to, ms, ease, onUpdate, onDone) {
    ease = typeof ease === 'function' ? ease : easeOutCubic;
    ms   = ms > 0 ? ms : 0;

    return new Promise(function (resolve) {
      if (ms === 0) {
        if (typeof onUpdate === 'function') onUpdate(to, 1);
        if (typeof onDone   === 'function') onDone(to);
        resolve(to);
        return;
      }

      var startTime = null;

      function step(ts) {
        if (startTime === null) startTime = ts;
        var elapsed = ts - startTime;
        var t       = Math.min(elapsed / ms, 1);
        var eased   = ease(t);
        var value   = from + (to - from) * eased;

        if (typeof onUpdate === 'function') {
          try { onUpdate(value, t); } catch (e) { console.error('[CQ.fx.tween] onUpdate error', e); }
        }

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          if (typeof onDone === 'function') {
            try { onDone(to); } catch (e) { console.error('[CQ.fx.tween] onDone error', e); }
          }
          resolve(to);
        }
      }

      requestAnimationFrame(step);
    });
  }

  // Also expose easing functions for consumers
  tween.easeOutCubic  = easeOutCubic;
  tween.easeInOutQuad = easeInOutQuad;

  // ── shake ─────────────────────────────────────────────────────────────────
  /**
   * Applies a brief CSS-transform screen-shake to `el`, then auto-resets.
   *
   * @param {Element} el          - DOM element to shake.
   * @param {number}  [intensity] - Max displacement in px (default 8).
   */
  function shake(el, intensity) {
    if (!el) return;
    intensity = intensity !== undefined ? intensity : 8;

    // Preserve any existing transform so we compose correctly
    var origTransform = el.style.transform || '';
    var frames        = 10;     // number of shake steps
    var duration      = 300;    // total duration ms
    var interval      = duration / frames;
    var count         = 0;

    // Store previous inline transform to restore (only inline; does not
    // clobber class-driven transforms because we restore after completion)
    var prevTransform = el.style.transform;

    var timerId = setInterval(function () {
      count++;
      if (count >= frames) {
        clearInterval(timerId);
        el.style.transform = prevTransform;
        return;
      }
      var decay = 1 - count / frames;
      var dx    = (Math.random() - 0.5) * 2 * intensity * decay;
      var dy    = (Math.random() - 0.5) * 2 * intensity * decay * 0.5;
      el.style.transform = origTransform
        ? origTransform + ' translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)'
        : 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    }, interval);
  }

  // ── playCue ───────────────────────────────────────────────────────────────
  /**
   * Plays a short WebAudio oscillator cue.
   * Lazily creates the AudioContext on first call (must be in a user-gesture
   * callstack on iOS/Safari; callers should invoke from click/pointer handlers).
   *
   * Supported names: "level" | "win" | "zap" | "collect" | "click"
   *
   * No-ops gracefully (never throws) if WebAudio is unavailable or blocked.
   *
   * @param {string} name - Cue name.
   */
  function playCue(name) {
    try {
      var ctx = _getAudioCtx();
      if (!ctx) return;
      _resumeCtx(ctx);

      // Each cue: array of { freq, type, start, dur, gainStart, gainEnd }
      var cues = {
        // Ascending major-third fanfare — reward sound
        level: [
          { freq: 523.25, type: 'sine', start: 0.00, dur: 0.12, gainStart: 0.35, gainEnd: 0.0 },
          { freq: 659.25, type: 'sine', start: 0.08, dur: 0.12, gainStart: 0.35, gainEnd: 0.0 },
          { freq: 783.99, type: 'sine', start: 0.16, dur: 0.18, gainStart: 0.4,  gainEnd: 0.0 }
        ],
        // Big win: full chord bloom
        win: [
          { freq: 261.63, type: 'sine',     start: 0.00, dur: 0.6,  gainStart: 0.3,  gainEnd: 0.0 },
          { freq: 329.63, type: 'sine',     start: 0.05, dur: 0.6,  gainStart: 0.3,  gainEnd: 0.0 },
          { freq: 392.00, type: 'sine',     start: 0.10, dur: 0.6,  gainStart: 0.3,  gainEnd: 0.0 },
          { freq: 523.25, type: 'sine',     start: 0.15, dur: 0.6,  gainStart: 0.35, gainEnd: 0.0 }
        ],
        // Quick descending zap — enemy hit
        zap: [
          { freq: 880,   type: 'sawtooth', start: 0.00, dur: 0.07, gainStart: 0.4, gainEnd: 0.0 },
          { freq: 440,   type: 'sawtooth', start: 0.04, dur: 0.07, gainStart: 0.3, gainEnd: 0.0 },
          { freq: 220,   type: 'sawtooth', start: 0.08, dur: 0.07, gainStart: 0.2, gainEnd: 0.0 }
        ],
        // Bright sparkle ping — collect item
        collect: [
          { freq: 1046.5, type: 'sine', start: 0.00, dur: 0.08, gainStart: 0.3,  gainEnd: 0.0 },
          { freq: 1318.5, type: 'sine', start: 0.06, dur: 0.12, gainStart: 0.35, gainEnd: 0.0 }
        ],
        // Short click confirm
        click: [
          { freq: 600, type: 'square', start: 0.00, dur: 0.05, gainStart: 0.15, gainEnd: 0.0 }
        ]
      };

      var steps = cues[name];
      if (!steps) {
        console.warn('[CQ.fx.playCue] Unknown cue name:', name);
        return;
      }

      var now = ctx.currentTime;

      steps.forEach(function (s) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.type            = s.type;
        osc.frequency.value = s.freq;

        gain.gain.setValueAtTime(s.gainStart, now + s.start);
        gain.gain.linearRampToValueAtTime(s.gainEnd, now + s.start + s.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + s.start);
        osc.stop(now  + s.start + s.dur + 0.01);

        // Cleanup after sound ends
        osc.onended = function () {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        };
      });
    } catch (e) {
      // Never propagate — audio failure must be silent
      console.warn('[CQ.fx.playCue] Audio error (suppressed):', e && e.message);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.CQ.fx = {
    particleBurst: particleBurst,
    rafLoop:       rafLoop,
    tween:         tween,
    shake:         shake,
    playCue:       playCue,
    // Expose easings for consumers who want them
    easeOutCubic:  easeOutCubic,
    easeInOutQuad: easeInOutQuad
  };

}());

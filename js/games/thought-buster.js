// Brick: thought-buster | Stud: CQ.fx, CQ.state, CQ.content.thoughtBuster | Socket: CQ.screens["thought-buster"]
// Wave-shooter mini-game: anxious-thought gremlins drift down the canvas; player taps/clicks to zap them.
// On hit: particleBurst + playCue("zap") + reframe text pops. Clear 9 gremlins across ~3 waves to win.

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ── Inline fallback content if CQ.content not yet available ──────────────
  var FALLBACK_PAIRS = [
    { anxious: "I'll freeze up completely",      reframe: "A slow breath buys your memory time" },
    { anxious: "Everyone can tell I'm nervous",   reframe: "People underestimate others' anxiety" },
    { anxious: "I'll say something stupid",       reframe: "People remember the impression, not slip-ups" },
    { anxious: "I'm not ready for this",          reframe: "Ready is a decision, not a feeling" },
    { anxious: "This will ruin everything",       reframe: "One moment is one data point, not your story" },
    { anxious: "I have to be perfect",            reframe: "Authentic beats polished-but-hollow every time" },
    { anxious: "They'll judge me harshly",        reframe: "Most people want the interaction to go well" },
    { anxious: "I'll run out of things to say",   reframe: "Curiosity about others is inexhaustible" },
    { anxious: "My hands are shaking visibly",    reframe: "You almost certainly look calmer than you feel" }
  ];

  // ── Game palette (vibrant, on-brand) ─────────────────────────────────────
  var PALETTE = {
    bg:          '#1A1040',
    bgMid:       '#231657',
    gremlinBody: '#FF6B6B',       // coral — anxious/threat
    gremlinEye:  '#FFFFFF',
    gremlinText: '#1A1040',
    reframeText: '#00C9B1',       // teal — calm/reframe
    reframeBg:   'rgba(0,201,177,0.18)',
    comboText:   '#FFD700',       // gold
    hud:         '#B8A9D9',
    waveText:    '#F5A623',       // amber
    zapRing:     '#F5A623',
    progressFill:'#00C9B1',
    progressBg:  'rgba(255,255,255,0.1)',
    stars:       '#7B68EE',
    btnBg:       'rgba(45,30,110,0.85)',
    btnBorder:   '#A855F7'
  };

  // ── Game constants ────────────────────────────────────────────────────────
  var TARGET_KILLS      = 9;   // kill this many gremlins to win
  var COMBO_WINDOW_MS   = 2200; // ms between zaps that counts as a combo
  var GREMLIN_RADIUS    = 34;   // px hit-circle radius
  var SPAWN_COLS        = 3;    // grid columns for spawn positioning
  var WAVE_SIZES        = [3, 3, 3]; // gremlins per wave (total = TARGET_KILLS)
  var GREMLIN_SPEED_BASE= 48;   // px/s base drift speed
  var REFRAME_TTL       = 2600; // ms a reframe popup lives
  var ZAP_TTL           = 320;  // ms the zap ring lives

  // ── Module-level state (reset on each mount) ──────────────────────────────
  var _rafHandle   = null;
  var _canvas      = null;
  var _ctx         = null;
  var _rootEl      = null;
  var _running     = false;

  // Game state
  var _gremlins    = [];
  var _reframes    = [];    // { x, y, text, born, ttl }
  var _zaps        = [];    // { x, y, born, ttl, r }
  var _stars       = [];    // background parallax stars
  var _kills       = 0;
  var _wave        = 0;     // 0-indexed wave
  var _waveActive  = false;
  var _waveKills   = 0;     // kills in current wave
  var _combo       = 0;
  var _lastZapMs   = 0;
  var _showWaveMsg = false;
  var _waveMsgTtl  = 0;
  var _pairs       = [];    // shuffled thought pairs
  var _pairIdx     = 0;     // next pair to use
  var _winTriggered= false;
  var _encourageMsg= '';
  var _encourageTtl= 0;

  // Encouragement messages shown mid-game
  var ENCOURAGE = [
    "You've got this!", "Keep zapping!", "Thoughts can't hold you!",
    "Unstoppable!", "That's the spirit!", "Every zap builds courage!"
  ];

  // ── Utility: shuffle array in-place (Fisher-Yates) ────────────────────────
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ── Utility: short anxious label for the gremlin bubble ──────────────────
  function shortLabel(text, maxLen) {
    maxLen = maxLen || 22;
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1) + '…';
  }

  // ── Utility: DPI-aware canvas resize ─────────────────────────────────────
  function resizeCanvas() {
    if (!_canvas || !_rootEl) return;
    var dpr = window.devicePixelRatio || 1;
    var w = _rootEl.clientWidth  || 360;
    var h = _rootEl.clientHeight || 500;
    _canvas.width  = w * dpr;
    _canvas.height = h * dpr;
    _canvas.style.width  = w + 'px';
    _canvas.style.height = h + 'px';
    _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _stars = makeStars(w, h, 55);
  }

  // ── Stars background ──────────────────────────────────────────────────────
  function makeStars(w, h, count) {
    var s = [];
    for (var i = 0; i < count; i++) {
      s.push({
        x:  Math.random() * w,
        y:  Math.random() * h,
        r:  Math.random() * 1.8 + 0.4,
        a:  Math.random() * 0.6 + 0.2,
        sp: Math.random() * 12 + 4   // drift speed px/s (parallax)
      });
    }
    return s;
  }

  // ── Gremlin factory ───────────────────────────────────────────────────────
  function makeGremlin(pair, col, totalCols, canvasW, canvasH, waveIndex, posInWave) {
    var lane = (col + 0.5) / totalCols;
    // Stagger start Y so they don't all appear at once
    var startY = -(GREMLIN_RADIUS * 2) - posInWave * 80;
    // Lateral drift: slight sine wobble amplitude grows with wave
    var wobbleAmp = 18 + waveIndex * 6;
    var wobbleFreq = 0.6 + Math.random() * 0.5;
    var wobblePhase = Math.random() * Math.PI * 2;
    // Speed increases slightly each wave
    var speed = GREMLIN_SPEED_BASE + waveIndex * 12 + Math.random() * 10;
    return {
      x:     lane * canvasW,
      y:     startY,
      baseX: lane * canvasW,
      vy:    speed,
      wobbleAmp:   wobbleAmp,
      wobbleFreq:  wobbleFreq,
      wobblePhase: wobblePhase,
      age:   0,           // seconds alive
      pair:  pair,
      alive: true,
      hitFlash: 0         // >0 = flashing white on hit (ms)
    };
  }

  // ── Spawn a wave ──────────────────────────────────────────────────────────
  function spawnWave(waveIdx, canvasW, canvasH) {
    var count = WAVE_SIZES[waveIdx] || 3;
    for (var i = 0; i < count; i++) {
      var pair;
      if (_pairIdx >= _pairs.length) {
        // Re-shuffle and start over if we run out
        _pairs = shuffle(_pairs.slice());
        _pairIdx = 0;
      }
      pair = _pairs[_pairIdx++];
      var col = i % SPAWN_COLS;
      _gremlins.push(makeGremlin(pair, col, SPAWN_COLS, canvasW, canvasH, waveIdx, i));
    }
    _waveKills  = 0;
    _waveActive = true;
    _showWaveMsg = true;
    _waveMsgTtl  = 1500;
  }

  // ── Hit detection ─────────────────────────────────────────────────────────
  function getCanvasXY(e) {
    var rect = _canvas.getBoundingClientRect();
    var clientX, clientY;
    if (e.changedTouches && e.changedTouches.length) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function onPointerDown(e) {
    if (!_running || _winTriggered) return;
    e.preventDefault();
    var pos = getCanvasXY(e);
    var hit = false;

    for (var i = _gremlins.length - 1; i >= 0; i--) {
      var g = _gremlins[i];
      if (!g.alive) continue;
      var dx = pos.x - g.x;
      var dy = pos.y - g.y;
      if (Math.sqrt(dx * dx + dy * dy) <= GREMLIN_RADIUS + 8) {
        zapGremlin(g, pos.x, pos.y);
        hit = true;
        break; // only zap one per tap
      }
    }

    if (!hit) {
      // Near-miss zap spark (smaller, no reframe)
      _zaps.push({ x: pos.x, y: pos.y, born: Date.now(), ttl: ZAP_TTL * 0.5, r: 18 });
    }
  }

  function zapGremlin(g, px, py) {
    g.alive = false;
    _kills++;
    _waveKills++;

    // Combo logic
    var now = Date.now();
    if (now - _lastZapMs < COMBO_WINDOW_MS) {
      _combo++;
    } else {
      _combo = 1;
    }
    _lastZapMs = now;

    // Zap ring
    _zaps.push({ x: g.x, y: g.y, born: now, ttl: ZAP_TTL, r: GREMLIN_RADIUS });

    // Particle burst via CQ.fx
    if (CQ.fx && CQ.fx.particleBurst && _ctx) {
      CQ.fx.particleBurst(_ctx, g.x, g.y, {
        count:  20,
        colors: ['#F5A623', '#00C9B1', '#FFD700', '#FF6B6B', '#A855F7'],
        spread: 100,
        life:   700
      });
    }

    // Sound
    if (CQ.fx && CQ.fx.playCue) {
      CQ.fx.playCue('zap');
    }

    // Reframe popup
    var reframeText = g.pair.reframe;
    _reframes.push({
      x:    g.x,
      y:    g.y - GREMLIN_RADIUS,
      text: reframeText,
      born: Date.now(),
      ttl:  REFRAME_TTL
    });

    // Combo encouragement
    if (_combo >= 3) {
      _encourageMsg = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
      _encourageTtl = 1200;
    }

    // Check wave completion
    var waveSize = WAVE_SIZES[_wave] || 3;
    if (_waveKills >= waveSize) {
      _waveActive = false;
      // Check overall win
      if (_kills >= TARGET_KILLS) {
        _winTriggered = true;
        setTimeout(triggerWin, 800);
      } else {
        // Advance to next wave after a brief pause
        var nextWave = _wave + 1;
        _wave = nextWave;
        setTimeout(function () {
          if (!_running || _winTriggered) return;
          var w = cssWidth();
          var h = cssHeight();
          spawnWave(_wave, w, h);
        }, 1400);
      }
    }
  }

  function cssWidth()  { return _canvas ? parseInt(_canvas.style.width, 10)  || 360 : 360; }
  function cssHeight() { return _canvas ? parseInt(_canvas.style.height, 10) || 500 : 500; }

  // ── Win sequence ──────────────────────────────────────────────────────────
  function triggerWin() {
    if (!_running) return;
    // Multiple bursts for celebration
    if (CQ.fx && CQ.fx.particleBurst && _ctx) {
      var w = cssWidth(), h = cssHeight();
      var points = [
        { x: w * 0.2, y: h * 0.3 },
        { x: w * 0.8, y: h * 0.25 },
        { x: w * 0.5, y: h * 0.5 },
        { x: w * 0.1, y: h * 0.6 },
        { x: w * 0.9, y: h * 0.55 }
      ];
      points.forEach(function (pt, idx) {
        setTimeout(function () {
          if (_ctx) {
            CQ.fx.particleBurst(_ctx, pt.x, pt.y, {
              count:  32,
              colors: ['#FFD700', '#F5A623', '#00C9B1', '#FF6B6B', '#A855F7'],
              spread: 140,
              life:   1000
            });
          }
        }, idx * 120);
      });
    }

    if (CQ.fx && CQ.fx.playCue) {
      CQ.fx.playCue('win');
    }

    // Call game-completion chain after a short visual pause
    setTimeout(function () {
      if (!_running) return;
      try {
        if (CQ.state && CQ.state.clearNode) {
          var _firstClear = CQ.state && CQ.state.nodes && !CQ.state.nodes['thought-buster'];
          CQ.state.clearNode('thought-buster');
          if (_firstClear && CQ.companion && CQ.companion.levelUp) {
            CQ.companion.levelUp();
          }
        }
      } catch (e) {
        console.error('[thought-buster] Completion callbacks failed:', e);
      }
      // Navigate away
      setTimeout(function () {
        if (CQ.app && CQ.app.showScreen) {
          CQ.app.showScreen('world-map');
        }
      }, 600);
    }, 1200);
  }

  // ── DRAW helpers ──────────────────────────────────────────────────────────

  function drawBackground(w, h, dt) {
    var ctx = _ctx;
    // Deep indigo gradient
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1A1040');
    grad.addColorStop(1, '#0D0826');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars(dt) {
    var ctx = _ctx;
    var h = cssHeight();
    ctx.save();
    _stars.forEach(function (s) {
      s.y += s.sp * (dt / 1000);
      if (s.y > h + 4) { s.y = -4; s.x = Math.random() * cssWidth(); }
      ctx.globalAlpha = s.a;
      ctx.fillStyle = PALETTE.stars;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawGremlin(g, now) {
    var ctx = _ctx;
    if (!g.alive) return;
    ctx.save();

    // Wobble shadow / glow
    ctx.shadowColor = 'rgba(255,107,107,0.5)';
    ctx.shadowBlur  = 16;

    // Body circle
    ctx.beginPath();
    ctx.arc(g.x, g.y, GREMLIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = g.hitFlash > 0 ? '#FFFFFF' : PALETTE.gremlinBody;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Dark outline
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Eyes (two white ovals)
    var eyeY = g.y - 8;
    ctx.fillStyle = PALETTE.gremlinEye;
    // left eye
    ctx.beginPath();
    ctx.ellipse(g.x - 9, eyeY, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // right eye
    ctx.beginPath();
    ctx.ellipse(g.x + 9, eyeY, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // pupils
    ctx.fillStyle = '#1A1040';
    ctx.beginPath();
    ctx.ellipse(g.x - 8, eyeY + 1, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(g.x + 10, eyeY + 1, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Worried mouth
    ctx.strokeStyle = '#1A1040';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(g.x, g.y + 10, 8, 0.15 * Math.PI, 0.85 * Math.PI, true);
    ctx.stroke();

    // Anxious text label in a speech bubble above the gremlin
    var label     = shortLabel(g.pair.anxious, 24);
    var fontSize  = 10;
    ctx.font      = 'bold ' + fontSize + 'px "Trebuchet MS", sans-serif';
    var textW     = ctx.measureText(label).width;
    var bubbleW   = textW + 14;
    var bubbleH   = 20;
    var bubbleX   = g.x - bubbleW / 2;
    var bubbleY   = g.y - GREMLIN_RADIUS - bubbleH - 6;

    // Bubble background
    ctx.fillStyle   = 'rgba(255,107,107,0.92)';
    roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 6);
    ctx.fill();

    // Bubble pointer
    ctx.beginPath();
    ctx.moveTo(g.x - 5, bubbleY + bubbleH);
    ctx.lineTo(g.x + 5, bubbleY + bubbleH);
    ctx.lineTo(g.x, bubbleY + bubbleH + 6);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,107,107,0.92)';
    ctx.fill();

    // Label text
    ctx.fillStyle  = PALETTE.gremlinText;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, g.x, bubbleY + bubbleH / 2);

    ctx.restore();
  }

  function drawReframes(now) {
    var ctx = _ctx;
    var toRemove = [];
    _reframes.forEach(function (rf, idx) {
      var age     = now - rf.born;
      var t       = Math.min(age / rf.ttl, 1);
      if (t >= 1) { toRemove.push(idx); return; }

      // Rise slowly upward
      var yOff = -t * 40;
      var alpha = t < 0.15 ? t / 0.15 : t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      alpha = Math.max(0, Math.min(1, alpha));

      ctx.save();
      ctx.globalAlpha = alpha;

      // Word-wrap at ~240px
      var maxW  = 240;
      var fontSize = 12;
      ctx.font = 'bold ' + fontSize + 'px "Trebuchet MS", sans-serif';
      var words = rf.text.split(' ');
      var lines = [];
      var line  = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);

      var lineH    = fontSize + 4;
      var padX     = 12, padY = 8;
      var boxW     = maxW + padX * 2;
      var boxH     = lines.length * lineH + padY * 2;
      var bx       = rf.x - boxW / 2;
      var by       = rf.y + yOff - boxH / 2;

      // Bubble
      ctx.fillStyle = PALETTE.reframeBg;
      roundRect(ctx, bx, by, boxW, boxH, 10);
      ctx.fill();

      // Border
      ctx.strokeStyle = PALETTE.reframeText;
      ctx.lineWidth   = 1.5;
      roundRect(ctx, bx, by, boxW, boxH, 10);
      ctx.stroke();

      // Text
      ctx.fillStyle   = PALETTE.reframeText;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'top';
      lines.forEach(function (ln, li) {
        ctx.fillText(ln, rf.x, by + padY + li * lineH);
      });

      ctx.restore();
    });
    // Remove expired in reverse order
    for (var i = toRemove.length - 1; i >= 0; i--) {
      _reframes.splice(toRemove[i], 1);
    }
  }

  function drawZaps(now) {
    var ctx = _ctx;
    var toRemove = [];
    _zaps.forEach(function (z, idx) {
      var age  = now - z.born;
      var t    = Math.min(age / z.ttl, 1);
      if (t >= 1) { toRemove.push(idx); return; }
      var alpha = 1 - t;
      var r     = z.r + t * z.r * 1.6;
      ctx.save();
      ctx.globalAlpha  = alpha * 0.8;
      ctx.strokeStyle  = PALETTE.zapRing;
      ctx.lineWidth    = 3;
      ctx.shadowColor  = PALETTE.zapRing;
      ctx.shadowBlur   = 14;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    for (var i = toRemove.length - 1; i >= 0; i--) {
      _zaps.splice(toRemove[i], 1);
    }
  }

  function drawHUD(w, h, now) {
    var ctx = _ctx;
    ctx.save();

    // Progress bar: kills / TARGET_KILLS
    var barW    = Math.min(w - 32, 280);
    var barH    = 10;
    var barX    = (w - barW) / 2;
    var barY    = 14;
    var fill    = Math.min(_kills / TARGET_KILLS, 1);

    ctx.fillStyle = PALETTE.progressBg;
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    if (fill > 0) {
      ctx.fillStyle = PALETTE.progressFill;
      ctx.shadowColor = PALETTE.progressFill;
      ctx.shadowBlur  = 8;
      roundRect(ctx, barX, barY, barW * fill, barH, barH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Kill count
    ctx.fillStyle   = PALETTE.hud;
    ctx.font        = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'top';
    ctx.fillText(_kills + ' / ' + TARGET_KILLS + ' thoughts zapped', w / 2, barY + barH + 5);

    // Wave label
    ctx.fillStyle   = PALETTE.waveText;
    ctx.font        = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign   = 'left';
    ctx.textBaseline= 'top';
    ctx.fillText('Wave ' + (_wave + 1), 16, barY);

    // Combo indicator
    if (_combo >= 2) {
      var comboAlpha = Math.min(1, (_combo - 1) / 3);
      ctx.globalAlpha  = 0.7 + comboAlpha * 0.3;
      ctx.fillStyle    = PALETTE.comboText;
      ctx.font         = 'bold ' + (13 + _combo) + 'px "Trebuchet MS", sans-serif';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('x' + _combo + ' COMBO!', w - 16, barY);
    }

    ctx.restore();
  }

  function drawWaveMessage(w, h, dt) {
    if (!_showWaveMsg) return;
    _waveMsgTtl -= dt;
    if (_waveMsgTtl <= 0) { _showWaveMsg = false; return; }
    var alpha = Math.min(1, _waveMsgTtl / 400);
    var ctx   = _ctx;
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = PALETTE.waveText;
    ctx.font         = 'bold 28px "Trebuchet MS", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = PALETTE.waveText;
    ctx.shadowBlur   = 20;
    ctx.fillText('Wave ' + (_wave + 1) + '!', w / 2, h / 2 - 30);
    ctx.restore();
  }

  function drawEncouragement(w, h, dt) {
    if (!_encourageTtl || !_encourageMsg) return;
    _encourageTtl -= dt;
    if (_encourageTtl <= 0) { _encourageTtl = 0; return; }
    var alpha = Math.min(1, _encourageTtl / 300);
    var ctx   = _ctx;
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = PALETTE.comboText;
    ctx.font         = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = PALETTE.comboText;
    ctx.shadowBlur   = 12;
    ctx.fillText(_encourageMsg, w / 2, h / 2 + 20);
    ctx.restore();
  }

  function drawWinOverlay(w, h) {
    var ctx = _ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(26,16,64,0.72)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle   = '#FFD700';
    ctx.font        = 'bold 32px "Trebuchet MS", sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 30;
    ctx.fillText('THOUGHTS BUSTED!', w / 2, h / 2 - 30);

    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#00C9B1';
    ctx.font        = '16px "Trebuchet MS", sans-serif';
    ctx.fillText('You rewrote every anxious thought.', w / 2, h / 2 + 14);
    ctx.fillStyle   = '#B8A9D9';
    ctx.font        = '13px "Trebuchet MS", sans-serif';
    ctx.fillText('Leveling up your companion...', w / 2, h / 2 + 40);
    ctx.restore();
  }

  // ── Canvas helper: roundRect polyfill ─────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // ── Main game loop ────────────────────────────────────────────────────────
  function gameLoop(dt) {
    if (!_running) return false;
    dt = Math.min(dt, 80); // clamp large dt (tab out etc.)

    var w = cssWidth();
    var h = cssHeight();
    var now = Date.now();

    // Update gremlins
    _gremlins.forEach(function (g) {
      if (!g.alive) return;
      g.age += dt / 1000;
      g.y   += g.vy * (dt / 1000);
      g.x    = g.baseX + Math.sin(g.age * g.wobbleFreq * Math.PI * 2 + g.wobblePhase) * g.wobbleAmp;

      // Clamp X to canvas
      var pad = GREMLIN_RADIUS + 8;
      g.x = Math.max(pad, Math.min(w - pad, g.x));

      if (g.hitFlash > 0) g.hitFlash -= dt;

      // If gremlin exits bottom without being zapped — gentle: just remove it
      // (no penalty / game-over; the game is encouraging, not punishing)
      if (g.y > h + GREMLIN_RADIUS * 2) {
        g.alive = false;
        // Count as a partial kill (keeps game moving)
        _kills++;
        _waveKills++;
        // Check wave completion (same as zapGremlin)
        var waveSize = WAVE_SIZES[_wave] || 3;
        if (_waveKills >= waveSize && _waveActive) {
          _waveActive = false;
          if (_kills >= TARGET_KILLS) {
            if (!_winTriggered) { _winTriggered = true; setTimeout(triggerWin, 800); }
          } else {
            var nextWaveIdx = _wave + 1;
            _wave = nextWaveIdx;
            setTimeout(function () {
              if (!_running || _winTriggered) return;
              spawnWave(_wave, cssWidth(), cssHeight());
            }, 1000);
          }
        }
      }
    });

    // Draw
    drawBackground(w, h, dt);
    drawStars(dt);
    drawZaps(now);
    _gremlins.forEach(function (g) { drawGremlin(g, now); });
    drawReframes(now);
    drawHUD(w, h, now);
    drawWaveMessage(w, h, dt);
    drawEncouragement(w, h, dt);
    if (_winTriggered) drawWinOverlay(w, h);

    return true; // keep loop running
  }

  // ── Build DOM shell ───────────────────────────────────────────────────────
  function buildShell(rootEl) {
    // Wrapper fills the section
    var wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:relative',
      'width:100%',
      'height:calc(100dvh - 56px)',
      'min-height:380px',
      'overflow:hidden',
      'background:#1A1040',
      'display:flex',
      'flex-direction:column'
    ].join(';');

    // Canvas
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'flex:1;display:block;touch-action:none;cursor:crosshair;';
    canvas.setAttribute('aria-label', 'Thought Buster game canvas');
    wrap.appendChild(canvas);

    // Back button overlay (top-left corner, above canvas)
    var backBtn = document.createElement('button');
    backBtn.textContent = '< Back';
    backBtn.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'z-index:10',
      'background:rgba(45,30,110,0.85)',
      'color:#B8A9D9',
      'border:1.5px solid rgba(168,85,247,0.4)',
      'border-radius:999px',
      'padding:4px 14px',
      'font:bold 12px "Trebuchet MS",sans-serif',
      'cursor:pointer',
      'min-height:34px',
      '-webkit-tap-highlight-color:transparent'
    ].join(';');
    backBtn.addEventListener('pointerdown', function () {
      if (CQ.app && CQ.app.showScreen) {
        CQ.app.showScreen('world-map');
      }
    });
    wrap.appendChild(backBtn);

    // Instruction tooltip (fades after first tap)
    var tip = document.createElement('div');
    tip.id  = 'tb-tip';
    tip.style.cssText = [
      'position:absolute',
      'bottom:18px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(45,30,110,0.82)',
      'color:#B8A9D9',
      'border:1px solid rgba(168,85,247,0.35)',
      'border-radius:999px',
      'padding:6px 18px',
      'font:13px "Trebuchet MS",sans-serif',
      'pointer-events:none',
      'white-space:nowrap',
      'transition:opacity 0.6s',
      'z-index:5'
    ].join(';');
    tip.textContent = 'Tap a thought to zap it!';
    wrap.appendChild(tip);

    // Hide tip on first interaction
    function hideTip() {
      tip.style.opacity = '0';
      canvas.removeEventListener('pointerdown', hideTip);
    }
    canvas.addEventListener('pointerdown', hideTip);

    rootEl.appendChild(wrap);
    return { wrap: wrap, canvas: canvas };
  }

  // ── Screen registration ───────────────────────────────────────────────────
  CQ.screens['thought-buster'] = {

    mount: function (rootEl) {
      _rootEl      = rootEl;
      _running     = false;
      _gremlins    = [];
      _reframes    = [];
      _zaps        = [];
      _stars       = [];
      _kills       = 0;
      _wave        = 0;
      _waveActive  = false;
      _waveKills   = 0;
      _combo       = 0;
      _lastZapMs   = 0;
      _showWaveMsg = false;
      _waveMsgTtl  = 0;
      _winTriggered= false;
      _encourageMsg= '';
      _encourageTtl= 0;
      _pairIdx     = 0;

      // Source content pairs (with fallback)
      var rawPairs = (CQ.content && Array.isArray(CQ.content.thoughtBuster) && CQ.content.thoughtBuster.length >= 8)
        ? CQ.content.thoughtBuster
        : FALLBACK_PAIRS;
      _pairs = shuffle(rawPairs.slice());

      // Build DOM
      var els = buildShell(rootEl);
      _canvas  = els.canvas;
      _ctx     = _canvas.getContext('2d');

      // Size canvas
      resizeCanvas();

      // Pointer listener on canvas
      _canvas.addEventListener('pointerdown', onPointerDown, { passive: false });

      // Resize handler
      var _resizeHandler = function () { resizeCanvas(); };
      window.addEventListener('resize', _resizeHandler);
      _canvas._resizeHandler = _resizeHandler; // store for unmount

      // Start game
      _running = true;
      spawnWave(0, cssWidth(), cssHeight());

      // RAF loop via CQ.fx.rafLoop
      _rafHandle = CQ.fx.rafLoop(gameLoop);
    },

    unmount: function () {
      _running = false;
      if (_rafHandle) {
        _rafHandle.stop();
        _rafHandle = null;
      }
      if (_canvas) {
        _canvas.removeEventListener('pointerdown', onPointerDown);
        if (_canvas._resizeHandler) {
          window.removeEventListener('resize', _canvas._resizeHandler);
          _canvas._resizeHandler = null;
        }
        _canvas = null;
      }
      _ctx    = null;
      _rootEl = null;
      // Clear arrays to release memory
      _gremlins = [];
      _reframes = [];
      _zaps     = [];
      _stars    = [];
    }
  };

}());

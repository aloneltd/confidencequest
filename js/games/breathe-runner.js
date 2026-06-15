// Brick: breathe-runner | Stud: js/game-state.js, js/fx-kit.js | Socket: js/games/breathe-runner.js
// Side-scrolling breath-rhythm mini-game. Avatar auto-runs; player taps/space on
// inhale peaks to jump. 4 full breath cycles = level clear → clearNode + levelUp + world-map.

window.CQ = window.CQ || {};
window.CQ.screens = window.CQ.screens || {};

(function () {
  'use strict';

  // ── Palette (mirrors theme-kit tokens) ───────────────────────────────────
  var C = {
    bg:         '#1A1040',
    ground:     '#2A1F60',
    groundLine: '#3D2E8A',
    teal:       '#00C9B1',
    tealDim:    '#006B5F',
    amber:      '#F5A623',
    gold:       '#FFD700',
    coral:      '#FF6B6B',
    indigo:     '#7B68EE',
    white:      '#FFFFFF',
    textDim:    'rgba(255,255,255,0.55)',
    orbIn:      '#00E5C8',   // inhale orb colour
    orbHold:    '#FFD700',   // hold orb colour
    orbEx:      '#7B68EE',   // exhale orb colour
    star:       '#FFD700'
  };

  // ── Breath-cycle config ───────────────────────────────────────────────────
  // Phase durations in ms. Forgiving & calming.
  var PHASES = [
    { name: 'inhale', label: 'Breathe in…',   ms: 4000, color: C.orbIn   },
    { name: 'hold',   label: 'Hold…',          ms: 2000, color: C.orbHold },
    { name: 'exhale', label: 'Breathe out…',  ms: 6000, color: C.orbEx   }
  ];
  var TOTAL_CYCLES = 4;         // complete cycles to win
  var CYCLE_MS = PHASES.reduce(function (s, p) { return s + p.ms; }, 0); // 12 000ms

  // Jump window: centre is the inhale peak (end of inhale phase).
  // Accept input ±800ms around that moment.
  var JUMP_WINDOW_MS = 800;

  // ── Avatar physics ────────────────────────────────────────────────────────
  var GRAVITY      = 1800;   // px/s²
  var JUMP_V       = -560;   // px/s  (upward)
  var GROUND_Y     = 0;      // set in mount after we know canvas size
  var AVATAR_SIZE  = 36;     // radius of the round avatar
  var RUN_SPEED    = 180;    // px/s — visual scroll speed

  // ── Background parallax layers ─────────────────────────────────────────────
  // Each layer: { x, speed } offset, drawn as repeating dots/shapes
  function makeBgLayers() {
    return [
      { x: 0, speed: 0.15, shapes: makeBgShapes(12, 600,  260, 2,  'rgba(123,104,238,0.18)') },
      { x: 0, speed: 0.30, shapes: makeBgShapes(8,  600,  200, 3,  'rgba(0,201,177,0.12)')  },
      { x: 0, speed: 0.60, shapes: makeBgShapes(6,  600,  140, 4,  'rgba(245,166,35,0.10)') }
    ];
  }

  function makeBgShapes(count, W, maxY, r, fill) {
    var arr = [];
    for (var i = 0; i < count; i++) {
      arr.push({ ox: Math.random() * W, y: 40 + Math.random() * maxY, r: r + Math.random() * 2, fill: fill });
    }
    return arr;
  }

  // ── Collectible stars (reward for on-beat jumps) ──────────────────────────
  function makeStarRow(W, groundY) {
    // Spawn a row of stars slightly above ground at random x for each cycle
    var stars = [];
    var baseX = W + 100 + Math.random() * 200;
    var count = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i++) {
      stars.push({ x: baseX + i * 60, y: groundY - 80, collected: false, r: 10, spin: Math.random() * Math.PI * 2 });
    }
    return stars;
  }

  // ── Mount ─────────────────────────────────────────────────────────────────
  function mount(rootEl) {
    // ── Build DOM ──────────────────────────────────────────────────────────
    rootEl.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:relative',
      'width:100%',
      'height:100%',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'background:' + C.bg,
      'overflow:hidden',
      'user-select:none',
      '-webkit-user-select:none'
    ].join(';');
    rootEl.appendChild(wrapper);

    // Back button
    var backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.style.cssText = [
      'position:absolute',
      'top:14px',
      'left:16px',
      'z-index:20',
      'background:rgba(255,255,255,0.08)',
      'color:#fff',
      'border:1px solid rgba(255,255,255,0.2)',
      'border-radius:8px',
      'padding:6px 14px',
      'font-size:14px',
      'cursor:pointer',
      'font-family:inherit'
    ].join(';');
    wrapper.appendChild(backBtn);

    // Canvas
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
    wrapper.appendChild(canvas);

    var ctx = canvas.getContext('2d');

    // Resize helper
    function resize() {
      var r = wrapper.getBoundingClientRect();
      canvas.width  = Math.floor(r.width)  || 600;
      canvas.height = Math.floor(r.height) || 400;
    }
    resize();
    var resizeObs = window.ResizeObserver
      ? new ResizeObserver(resize)
      : null;
    if (resizeObs) { resizeObs.observe(wrapper); }

    // ── Game state ─────────────────────────────────────────────────────────
    var W = function () { return canvas.width;  };
    var H = function () { return canvas.height; };

    var cyclesDone  = 0;
    var cycleTime   = 0;   // ms elapsed in current cycle
    var phaseIdx    = 0;
    var phaseTime   = 0;   // ms elapsed in current phase
    var score       = 0;
    var hitCount    = 0;   // on-beat hits this cycle
    var jumpPending = false; // did the player tap since last jump?
    var finished    = false;

    // Background
    var bgLayers = makeBgLayers();

    // Stars
    var stars = [];
    function spawnStars() {
      stars = stars.concat(makeStarRow(W(), groundY()));
    }

    function groundY() { return H() - 70; }

    // Avatar
    var avatar = {
      x:  0,         // set in first frame
      y:  0,
      vy: 0,
      onGround: true,
      expression: 0, // 0..1 breathing expression
      jumpFlash: 0   // 0..1 flash on jump
    };

    function resetAvatar() {
      avatar.x  = W() * 0.22;
      avatar.y  = groundY();
      avatar.vy = 0;
      avatar.onGround = true;
    }
    resetAvatar();

    // Orb state
    var orbScale   = 0.5;  // 0..1
    var orbOpacity = 1.0;

    // Prompt toast
    var promptAlpha = 0;
    var promptText  = '';

    // Beat-hit flash
    var beatFlash = 0;  // 0..1

    // Cycle complete flash
    var cycleFlash = 0;

    // ── Input ──────────────────────────────────────────────────────────────
    function onInput(e) {
      if (finished) return;
      if (e && typeof e.preventDefault === 'function') { e.preventDefault(); }
      jumpPending = true;
    }

    canvas.addEventListener('pointerdown', onInput);

    function onKey(e) {
      if (e.code === 'Space' || e.key === ' ') { onInput(null); }
    }
    document.addEventListener('keydown', onKey);

    backBtn.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      cleanup();
      CQ.app.showScreen('world-map');
    });

    // ── Breath phase helpers ───────────────────────────────────────────────
    function currentPhase() { return PHASES[phaseIdx]; }

    // Returns true if we are currently in the jump window.
    // The jump window is centred on the END of the inhale phase (the peak).
    function inJumpWindow() {
      if (currentPhase().name !== 'inhale') { return false; }
      var timeLeft = currentPhase().ms - phaseTime;
      return timeLeft <= JUMP_WINDOW_MS;
    }

    // Orb target scale: grows during inhale, holds at 1 during hold, shrinks during exhale
    function targetOrbScale() {
      var ph = currentPhase();
      if (ph.name === 'inhale')  { return 0.35 + 0.65 * (phaseTime / ph.ms); }
      if (ph.name === 'hold')    { return 1.0; }
      /* exhale */               return 1.0 - 0.65 * (phaseTime / ph.ms);
    }

    // ── Jump ──────────────────────────────────────────────────────────────
    function doJump(onBeat) {
      if (!avatar.onGround) return;
      avatar.vy = JUMP_V;
      avatar.onGround = false;
      avatar.jumpFlash = 1.0;
      if (onBeat) {
        score     += 10;
        hitCount  += 1;
        beatFlash  = 1.0;
        CQ.fx.playCue('collect');
        CQ.fx.particleBurst(ctx, avatar.x, avatar.y - AVATAR_SIZE, {
          count: 14, colors: [C.teal, C.gold, C.orbIn], spread: 80, life: 600
        });
      } else {
        CQ.fx.playCue('click');
      }
    }

    // ── Update ─────────────────────────────────────────────────────────────
    function update(dt) {
      if (finished) { return false; }

      var gY = groundY();
      var cW = W();

      // Avatar not yet positioned? (e.g. first frame after resize)
      if (avatar.x === 0) { resetAvatar(); }

      // ── Breath cycle clock ──────────────────────────────────────────────
      cycleTime  += dt;
      phaseTime  += dt;

      // Advance phase
      while (phaseTime >= currentPhase().ms) {
        phaseTime -= currentPhase().ms;
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        promptAlpha = 1.0;
        promptText  = PHASES[phaseIdx].label;
      }

      // Check for cycle completion (after exhale ends → inhale starts)
      if (cycleTime >= CYCLE_MS) {
        cycleTime -= CYCLE_MS;
        cyclesDone += 1;
        cycleFlash  = 1.0;
        hitCount    = 0;
        spawnStars();
        CQ.fx.playCue('level');
        if (cyclesDone >= TOTAL_CYCLES) {
          finished = true;
          handleWin();
          return; // update fn will not be called again
        }
      }

      // Orb smooth approach
      var tScale = targetOrbScale();
      orbScale += (tScale - orbScale) * Math.min(1, dt * 0.004);

      // ── Jump input window check ─────────────────────────────────────────
      if (jumpPending) {
        jumpPending = false;
        doJump(inJumpWindow());
      }

      // ── Avatar physics ──────────────────────────────────────────────────
      if (!avatar.onGround) {
        avatar.vy += GRAVITY * (dt / 1000);
        avatar.y  += avatar.vy * (dt / 1000);
        if (avatar.y >= gY) {
          avatar.y  = gY;
          avatar.vy = 0;
          avatar.onGround = true;
        }
      }

      // Breathing expression: pulse with orbScale
      avatar.expression = orbScale;

      // Decay flashes
      avatar.jumpFlash = Math.max(0, avatar.jumpFlash - dt * 0.004);
      beatFlash        = Math.max(0, beatFlash  - dt * 0.002);
      cycleFlash       = Math.max(0, cycleFlash - dt * 0.001);
      promptAlpha      = Math.max(0, promptAlpha - dt * 0.0008);

      // ── Background scroll ───────────────────────────────────────────────
      bgLayers.forEach(function (layer) {
        layer.x -= RUN_SPEED * layer.speed * (dt / 1000);
      });

      // ── Stars ───────────────────────────────────────────────────────────
      stars.forEach(function (s) {
        s.x    -= RUN_SPEED * (dt / 1000);
        s.spin += dt * 0.003;
        if (!s.collected) {
          var dx = s.x - avatar.x;
          var dy = s.y - avatar.y;
          if (Math.sqrt(dx * dx + dy * dy) < AVATAR_SIZE + s.r) {
            s.collected = true;
            score += 5;
            CQ.fx.particleBurst(ctx, s.x, s.y, {
              count: 8, colors: [C.gold, C.amber], spread: 60, life: 400
            });
          }
        }
      });
      // Cull off-screen stars
      stars = stars.filter(function (s) { return s.x > -50; });

      // ── Draw ────────────────────────────────────────────────────────────
      draw(ctx, cW, H(), gY);
    }

    // ── Draw ───────────────────────────────────────────────────────────────
    function draw(ctx, cW, cH, gY) {
      // Clear
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, cW, cH);

      // Background parallax
      drawBg(ctx, cW, cH, gY);

      // Ground
      ctx.fillStyle = C.ground;
      ctx.fillRect(0, gY + AVATAR_SIZE * 0.6, cW, cH - gY);
      ctx.strokeStyle = C.groundLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, gY + AVATAR_SIZE * 0.6);
      ctx.lineTo(cW, gY + AVATAR_SIZE * 0.6);
      ctx.stroke();

      // Stars (collectibles)
      drawStars(ctx);

      // Beat-flash overlay (soft, calming pulse)
      if (beatFlash > 0) {
        ctx.globalAlpha = beatFlash * 0.12;
        ctx.fillStyle = C.teal;
        ctx.fillRect(0, 0, cW, cH);
        ctx.globalAlpha = 1;
      }

      // Cycle flash
      if (cycleFlash > 0) {
        ctx.globalAlpha = cycleFlash * 0.18;
        ctx.fillStyle = C.gold;
        ctx.fillRect(0, 0, cW, cH);
        ctx.globalAlpha = 1;
      }

      // Orb (breath pacer) — centred top area
      drawOrb(ctx, cW, cH);

      // Avatar
      drawAvatar(ctx, avatar, gY);

      // HUD
      drawHUD(ctx, cW, cH);

      // Prompt toast
      if (promptAlpha > 0) {
        drawPrompt(ctx, cW, cH);
      }
    }

    function drawBg(ctx, cW, cH, gY) {
      bgLayers.forEach(function (layer) {
        layer.shapes.forEach(function (sh) {
          var ox = ((sh.ox + layer.x * -1 + cW * 4) % (cW + 100)) - 50;
          ctx.globalAlpha = 1;
          ctx.fillStyle = sh.fill;
          ctx.beginPath();
          ctx.arc(ox, sh.y, sh.r, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    function drawOrb(ctx, cW, cH) {
      var ph     = currentPhase();
      var cx     = cW / 2;
      var cy     = cH * 0.30;
      var maxR   = Math.min(cW, cH) * 0.18;
      var r      = maxR * (0.35 + 0.65 * orbScale);
      var color  = ph.color;

      // Outer glow
      var grd = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.6);
      grd.addColorStop(0, color.replace(')', ',0.22)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', 'rgba('));
      // Simpler: just use rgba strings
      grd.addColorStop(0, hexAlpha(color, 0.22));
      grd.addColorStop(1, hexAlpha(color, 0.00));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Core orb
      var orbGrd = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
      orbGrd.addColorStop(0, hexAlpha(color, 0.95));
      orbGrd.addColorStop(0.6, hexAlpha(color, 0.7));
      orbGrd.addColorStop(1, hexAlpha(color, 0.3));
      ctx.fillStyle = orbGrd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner shimmer
      ctx.fillStyle = hexAlpha('#ffffff', 0.18);
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.28, cy - r * 0.28, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // Phase label below orb
      ctx.font = 'bold ' + Math.round(r * 0.45) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = hexAlpha(color, 0.9);
      ctx.fillText(ph.label, cx, cy + r + 10);

      // Progress arc around orb
      var progress = phaseTime / ph.ms;
      ctx.strokeStyle = hexAlpha(color, 0.55);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
    }

    function drawAvatar(ctx, av, gY) {
      var x = av.x;
      var y = av.y;
      var r = AVATAR_SIZE;
      var breathe = av.expression; // 0..1
      var scaleX = 1 + breathe * 0.08;
      var scaleY = 1 - breathe * 0.05;

      // Shadow
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x, gY + r * 0.6 + 4, r * scaleX * 0.85, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scaleX, scaleY);

      // Jump flash aura
      if (av.jumpFlash > 0) {
        ctx.globalAlpha = av.jumpFlash * 0.4;
        ctx.fillStyle = C.teal;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Body gradient
      var bodyGrd = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      bodyGrd.addColorStop(0, C.teal);
      bodyGrd.addColorStop(0.6, '#00A090');
      bodyGrd.addColorStop(1, '#005F56');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Cheeks
      ctx.globalAlpha = 0.30;
      ctx.fillStyle = C.coral;
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, r * 0.18, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse( r * 0.38, r * 0.18, r * 0.18, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eyes
      var eyeY = -r * 0.12;
      var eyeR = r * 0.14;
      // pupils
      [[-r * 0.28, eyeY], [r * 0.28, eyeY]].forEach(function (pos) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1A1040';
        ctx.beginPath();
        ctx.arc(pos[0] + eyeR * 0.15, pos[1] + eyeR * 0.1, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();
        // eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos[0] - eyeR * 0.1, pos[1] - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2);
        ctx.fill();
      });

      // Mouth — smile more when on ground / at rest
      ctx.strokeStyle = '#1A1040';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      var mouthW = r * 0.35;
      var mouthY = r * 0.28;
      var curve  = av.onGround ? r * 0.18 : r * 0.08;
      ctx.moveTo(-mouthW, mouthY);
      ctx.quadraticCurveTo(0, mouthY + curve, mouthW, mouthY);
      ctx.stroke();

      // Shimmer
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.2, r * 0.12, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Running legs (simple arc)
      if (av.onGround) {
        var legPhase = Date.now() * 0.006;
        ctx.strokeStyle = '#00A090';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        // left leg
        ctx.beginPath();
        ctx.moveTo(-r * 0.25, r * 0.7);
        ctx.lineTo(-r * 0.38 + Math.sin(legPhase) * r * 0.22, r + r * 0.25 + Math.cos(legPhase) * r * 0.12);
        ctx.stroke();
        // right leg
        ctx.beginPath();
        ctx.moveTo( r * 0.25, r * 0.7);
        ctx.lineTo( r * 0.38 + Math.sin(legPhase + Math.PI) * r * 0.22, r + r * 0.25 + Math.cos(legPhase + Math.PI) * r * 0.12);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawStars(ctx) {
      stars.forEach(function (s) {
        if (s.collected) return;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.spin);
        ctx.fillStyle = C.star;
        ctx.shadowColor = C.gold;
        ctx.shadowBlur  = 8;
        drawStar5(ctx, 0, 0, s.r * 0.45, s.r);
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    }

    function drawStar5(ctx, cx, cy, innerR, outerR) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var angle = (i * Math.PI) / 5 - Math.PI / 2;
        var radius = i % 2 === 0 ? outerR : innerR;
        if (i === 0) {
          ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        } else {
          ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawHUD(ctx, cW, cH) {
      var fs = Math.max(12, Math.round(cW * 0.028));

      // Score
      ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = C.gold;
      ctx.fillText('★ ' + score, cW - 16, 14);

      // Cycle count bubbles
      var bubbleR  = Math.max(8, Math.round(cW * 0.018));
      var startX   = 16 + bubbleR;
      var bubbleY  = 16 + bubbleR;
      var spacing  = bubbleR * 2.6;
      for (var i = 0; i < TOTAL_CYCLES; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * spacing, bubbleY, bubbleR, 0, Math.PI * 2);
        ctx.fillStyle = i < cyclesDone ? C.teal : hexAlpha(C.teal, 0.2);
        ctx.fill();
        ctx.strokeStyle = i < cyclesDone ? C.gold : hexAlpha(C.white, 0.2);
        ctx.lineWidth = 2;
        ctx.stroke();
        if (i < cyclesDone) {
          ctx.fillStyle = C.gold;
          ctx.font = 'bold ' + Math.round(bubbleR * 1.1) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✓', startX + i * spacing, bubbleY);
        }
      }

      // Tap hint (shown in first cycle only)
      if (cyclesDone === 0) {
        ctx.font = Math.round(fs * 0.82) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = hexAlpha(C.white, 0.40);
        ctx.fillText('Tap or Space to jump on inhale peak', cW / 2, cH - 12);
      }
    }

    function drawPrompt(ctx, cW, cH) {
      var fs = Math.max(18, Math.round(cW * 0.042));
      ctx.save();
      ctx.globalAlpha = Math.min(1, promptAlpha);
      ctx.font = 'bold ' + fs + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Soft pill background
      var tw = ctx.measureText(promptText).width;
      var pad = 18;
      var px = cW / 2;
      var py = cH * 0.72;
      ctx.fillStyle = hexAlpha('#000', 0.38);
      roundRect(ctx, px - tw / 2 - pad, py - fs / 2 - 8, tw + pad * 2, fs + 16, 12);
      ctx.fill();
      ctx.fillStyle = C.white;
      ctx.fillText(promptText, px, py);
      ctx.restore();
    }

    // ── Win sequence ─────────────────────────────────────────────────────────
    function handleWin() {
      try {
        // Big particle burst at avatar position
        CQ.fx.particleBurst(ctx, avatar.x, avatar.y - AVATAR_SIZE, {
          count:  40,
          colors: [C.teal, C.gold, C.coral, C.indigo, C.amber],
          spread: 180,
          life:   1200
        });
        // Centre-screen burst
        CQ.fx.particleBurst(ctx, W() / 2, H() / 2, {
          count:  50,
          colors: [C.gold, C.white, C.teal],
          spread: 200,
          life:   1400
        });
        CQ.fx.playCue('win');
      } catch (e) {
        console.warn('[breathe-runner] Win FX error (suppressed):', e);
      }

      // Short delay so particles are visible before screen swap
      setTimeout(function () {
        try {
          var _firstClear = CQ.state && CQ.state.nodes && !CQ.state.nodes['breathe-runner'];
          CQ.state.clearNode('breathe-runner');
          if (_firstClear) { CQ.companion.levelUp(); }
        } catch (e) {
          console.error('[breathe-runner] clearNode/levelUp error:', e);
        }
        try {
          CQ.app.showScreen('world-map');
        } catch (e) {
          console.error('[breathe-runner] showScreen error:', e);
        }
      }, 1600);
    }

    // ── Cleanup ────────────────────────────────────────────────────────────
    var _loop = null;

    function cleanup() {
      if (_loop) { _loop.stop(); _loop = null; }
      canvas.removeEventListener('pointerdown', onInput);
      document.removeEventListener('keydown', onKey);
      if (resizeObs) { resizeObs.disconnect(); }
    }

    // ── Kick off rafLoop ───────────────────────────────────────────────────
    // Prime the game — first frame needs a valid canvas size
    resize();
    resetAvatar();
    promptText  = PHASES[0].label;
    promptAlpha = 1.0;
    spawnStars();

    _loop = CQ.fx.rafLoop(function (dt) {
      // Cap dt to prevent spiral-of-death on tab resume
      var cappedDt = Math.min(dt, 80);
      update(cappedDt);
    });

    // Expose cleanup as the unmount handle (set on screens object after)
    _activeCleanup = cleanup;
  }

  // ── Module-level unmount reference (set by mount) ─────────────────────────
  var _activeCleanup = null;

  function unmount() {
    if (typeof _activeCleanup === 'function') {
      _activeCleanup();
      _activeCleanup = null;
    }
  }

  // ── Utility: hex colour + alpha → rgba string ─────────────────────────────
  function hexAlpha(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ── Utility: rounded rectangle ────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // ── Register ──────────────────────────────────────────────────────────────
  CQ.screens['breathe-runner'] = {
    mount:   mount,
    unmount: unmount
  };

}());

// Brick: power-up-lab | Stud: CQ.content.strengths (prompts), CQ.state, CQ.fx, CQ.companion | Socket: CQ.screens["power-up-lab"]
// Strengths mini-game: player names 3 real strengths/past wins → each spawns a glowing Courage Crystal
// that flies into the companion. After 3 crystals: clearNode, levelUp, showScreen("world-map").

window.CQ = window.CQ || {};

(function () {
  'use strict';

  // ── Inline content fallback (guards against CQ.content not yet loaded) ──────
  var FALLBACK_STRENGTHS = [
    'Think of a moment when someone came to you for help — what did you do for them that they couldn\'t easily do for themselves?',
    'Name a skill or quality you use so naturally it barely feels like a skill. (The things we\'re best at often feel obvious to us but rare to others.)',
    'Recall a time you were proud of how you handled something difficult. What quality did that moment reveal about you?',
    'What\'s something you\'ve figured out the hard way that most people around you still haven\'t learned? That hard-won knowledge is a real strength.',
    'Think of work or a moment you felt genuinely good about. What did it take from you to make it happen?',
    'Who has thanked you or described you in a way that felt accurate and warm? What words did they use?',
    'What\'s a challenge you\'ve already survived that you didn\'t think you\'d get through? What does that tell you about your resilience?',
    'If your best friend were answering "What is great about this person?" about you right now, what would they say without hesitation?'
  ];

  function getStrengthPrompts() {
    try {
      if (window.CQ && window.CQ.content && Array.isArray(window.CQ.content.strengths) && window.CQ.content.strengths.length > 0) {
        return window.CQ.content.strengths;
      }
    } catch (e) {
      console.warn('[power-up-lab] CQ.content.strengths unavailable, using fallback:', e);
    }
    return FALLBACK_STRENGTHS;
  }

  // ── Palette (matches theme-kit tokens) ──────────────────────────────────────
  var CRYSTAL_COLORS  = ['#00C9B1', '#7B68EE', '#F5A623', '#FFD700', '#FF6B6B'];
  var GLOW_SHADOW     = '0 0 18px 4px rgba(0,201,177,0.65)';
  var ACCENT_TEAL     = '#00C9B1';
  var ACCENT_INDIGO   = '#7B68EE';
  var ACCENT_GOLD     = '#FFD700';
  var TEXT_WARM       = '#3D2B1F';
  var BG_SOFT         = '#FFF8F0';
  var BG_PANEL        = '#FFFFFF';

  // ── Module-level cleanup handle ──────────────────────────────────────────────
  var _rafHandle   = null;   // rafLoop stop handle for the canvas animation
  var _rootEl      = null;
  var _canvas      = null;
  var _ctx         = null;
  var _crystals    = [];     // active flying crystals
  var _collected   = 0;     // count of crystals collected so far
  var _prompts     = [];     // three prompts selected for this session
  var _done        = false;  // guard: prevent double-completion

  // ── Crystal data ─────────────────────────────────────────────────────────────
  // Each crystal: { x, y, tx, ty, color, size, phase, alpha, glowR, done }
  // phase: "idle" | "flying" | "burst"

  function _makeIdleCrystal(slotIndex) {
    // Orbiting position around the center-left of canvas (companion zone)
    var angle = (Math.PI * 2 / 3) * slotIndex - Math.PI / 2;
    var r     = 48;
    var cx    = 80;
    var cy    = 90;
    return {
      index:   slotIndex,
      angle:   angle,
      r:       r,
      cx:      cx,
      cy:      cy,
      x:       cx + Math.cos(angle) * r,
      y:       cy + Math.sin(angle) * r,
      tx:      0,
      ty:      0,
      color:   CRYSTAL_COLORS[slotIndex % CRYSTAL_COLORS.length],
      size:    18,
      phase:   'idle',
      alpha:   1,
      glowR:   0,
      orbitT:  Math.random() * Math.PI * 2,
      done:    false
    };
  }

  // ── Canvas draw ──────────────────────────────────────────────────────────────
  function _drawDiamond(ctx, x, y, size, color, alpha, glowR) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Glow
    if (glowR > 0) {
      var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR * 2.5);
      grad.addColorStop(0, color.replace(')', ', 0.45)').replace('rgb', 'rgba').replace('#', 'rgba(').replace('rgba(', ''));
      // fallback safe glow
      ctx.shadowColor = color;
      ctx.shadowBlur  = glowR * 2;
    }

    // Diamond shape
    ctx.beginPath();
    ctx.moveTo(x,          y - size);       // top
    ctx.lineTo(x + size * 0.65, y);          // right
    ctx.lineTo(x,          y + size * 0.8);  // bottom
    ctx.lineTo(x - size * 0.65, y);          // left
    ctx.closePath();

    // Gradient fill
    var fillGrad = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
    fillGrad.addColorStop(0, '#FFFFFF');
    fillGrad.addColorStop(0.3, color);
    fillGrad.addColorStop(1, color);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Shine facet
    ctx.beginPath();
    ctx.moveTo(x,              y - size);
    ctx.lineTo(x + size * 0.35, y - size * 0.1);
    ctx.lineTo(x,              y + size * 0.15);
    ctx.lineTo(x - size * 0.25, y - size * 0.1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.shadowBlur  = 0;
    ctx.fill();

    ctx.restore();
  }

  function _canvasFrame(dt) {
    if (!_canvas || !_ctx) { return false; }

    var W = _canvas.width;
    var H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);

    var now       = Date.now();
    var allDone   = true;

    for (var i = 0; i < _crystals.length; i++) {
      var c = _crystals[i];
      if (c.done) { continue; }
      allDone = false;

      if (c.phase === 'idle') {
        // Gentle float + glow pulse
        c.orbitT += dt * 0.001;
        c.x       = c.cx + Math.cos(c.angle + Math.sin(c.orbitT * 0.7) * 0.25) * c.r;
        c.y       = c.cy + Math.sin(c.angle + c.orbitT * 0.4) * (c.r * 0.3) + Math.sin(c.orbitT * 0.9) * 6;
        var glowPulse = 8 + 6 * Math.sin(c.orbitT * 1.5);
        _drawDiamond(_ctx, c.x, c.y, c.size, c.color, 1, glowPulse);

      } else if (c.phase === 'flying') {
        // Tween toward companion center (hardcoded to canvas coords ~companion zone)
        c.flyT = (c.flyT || 0) + dt / 500; // 500ms flight
        var t  = Math.min(1, c.flyT);
        // ease out cubic
        var te = 1 - Math.pow(1 - t, 3);
        c.x  = c.startX + (c.tx - c.startX) * te;
        c.y  = c.startY + (c.ty - c.startY) * te;
        c.alpha = 1 - t * 0.3;
        c.size  = 18 * (1 - t * 0.4);
        _drawDiamond(_ctx, c.x, c.y, c.size, c.color, c.alpha, 16 * (1 - t));

        if (t >= 1) {
          // Trigger burst at companion
          _triggerBurst(c);
          c.done  = true;
          c.phase = 'burst';
        }
      }
    }

    return true; // keep running until unmount
  }

  function _triggerBurst(crystal) {
    if (!_canvas || !_ctx) { return; }
    try {
      CQ.fx.particleBurst(_ctx, crystal.tx, crystal.ty, {
        count:  28,
        colors: [crystal.color, ACCENT_GOLD, '#FFFFFF'],
        spread: 100,
        life:   700,
        radius: 5
      });
    } catch (e) {
      console.warn('[power-up-lab] particleBurst error:', e);
    }
  }

  // ── Launch crystal flight animation ──────────────────────────────────────────
  function _launchCrystal(index) {
    var c = _crystals[index];
    if (!c || c.phase !== 'idle') { return; }
    c.phase  = 'flying';
    c.startX = c.x;
    c.startY = c.y;
    // Target: companion area in canvas (~companion center)
    c.tx     = 80;
    c.ty     = 80;
    c.flyT   = 0;
    try { CQ.fx.playCue('collect'); } catch (e) {}
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────────
  function _el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'style' && typeof attrs[k] === 'object') {
          Object.assign(node.style, attrs[k]);
        } else if (k === 'className') {
          node.className = attrs[k];
        } else if (k === 'textContent') {
          node.textContent = attrs[k];
        } else if (k === 'htmlFor') {
          node.htmlFor = attrs[k];
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (Array.isArray(children)) {
      children.forEach(function (ch) {
        if (ch) { node.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch); }
      });
    }
    return node;
  }

  function _css(node, styles) {
    Object.assign(node.style, styles);
    return node;
  }

  // ── Build the DOM ────────────────────────────────────────────────────────────
  function _buildUI(root) {
    // Reset module state
    _crystals  = [];
    _collected = 0;
    _done      = false;
    _prompts   = _selectPrompts(3);

    // Wrapper
    var wrapper = _el('div', {
      style: {
        minHeight:      '100vh',
        background:     BG_SOFT,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        '0 0 40px',
        fontFamily:     'system-ui, -apple-system, sans-serif',
        color:          TEXT_WARM,
        boxSizing:      'border-box'
      }
    });

    // Header bar
    var header = _el('div', {
      style: {
        width:          '100%',
        background:     ACCENT_TEAL,
        color:          '#FFFFFF',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '14px 20px',
        boxSizing:      'border-box',
        boxShadow:      '0 2px 8px rgba(0,201,177,0.3)'
      }
    });

    var backBtn = _el('button', {
      style: {
        background:   'rgba(255,255,255,0.25)',
        border:       '1.5px solid rgba(255,255,255,0.6)',
        borderRadius: '8px',
        color:        '#FFFFFF',
        fontSize:     '14px',
        fontWeight:   '600',
        padding:      '6px 14px',
        cursor:       'pointer',
        transition:   'background 0.15s'
      },
      textContent: '← Back'
    });
    backBtn.addEventListener('pointerdown', function () {
      try { CQ.fx.playCue('click'); } catch (e) {}
      try { CQ.app.showScreen('world-map'); } catch (e) {
        console.warn('[power-up-lab] showScreen world-map failed:', e);
      }
    });

    var titleSpan = _el('span', {
      style: { fontSize: '17px', fontWeight: '700', letterSpacing: '0.3px' },
      textContent: 'Power-Up Lab'
    });

    var crystalCountEl = _el('span', {
      style: {
        background:   'rgba(255,255,255,0.25)',
        borderRadius: '20px',
        padding:      '4px 12px',
        fontSize:     '14px',
        fontWeight:   '600',
        minWidth:     '60px',
        textAlign:    'center'
      },
      textContent: '0 / 3'
    });

    header.appendChild(backBtn);
    header.appendChild(titleSpan);
    header.appendChild(crystalCountEl);
    wrapper.appendChild(header);

    // Companion + canvas zone
    var heroZone = _el('div', {
      style: {
        width:          '100%',
        maxWidth:       '480px',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        padding:        '24px 20px 0',
        boxSizing:      'border-box'
      }
    });

    // Intro text
    var introText = _el('p', {
      style: {
        textAlign:    'center',
        fontSize:     '15px',
        lineHeight:   '1.6',
        color:        '#5C4033',
        margin:       '0 0 16px',
        maxWidth:     '380px'
      },
      textContent: 'You already carry more than you think. Name three real strengths or moments you\'re proud of — and watch them become Courage Crystals that power up your companion.'
    });
    heroZone.appendChild(introText);

    // Canvas for crystals (companion silhouette)
    _canvas = _el('canvas', {
      width:  '160',
      height: '160',
      style:  {
        display:      'block',
        borderRadius: '50%',
        background:   'radial-gradient(circle at 40% 40%, #E8F9F7 0%, #C5EFF2 100%)',
        boxShadow:    '0 4px 24px rgba(0,201,177,0.18)',
        margin:       '0 auto 8px'
      }
    });
    heroZone.appendChild(_canvas);
    _ctx = _canvas.getContext('2d');

    // Companion label
    var companionLabel = _el('p', {
      style: {
        textAlign:  'center',
        fontSize:   '12px',
        color:      ACCENT_TEAL,
        fontWeight: '600',
        margin:     '0 0 20px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      },
      textContent: 'Your Companion'
    });
    heroZone.appendChild(companionLabel);

    // Draw companion silhouette on canvas
    _drawCompanionSilhouette();

    // Initialize idle crystal slots (one per strength, appear as empty slots initially)
    for (var i = 0; i < 3; i++) {
      _crystals.push(_makeIdleCrystal(i));
    }

    wrapper.appendChild(heroZone);

    // Strength input cards
    var cardsContainer = _el('div', {
      style: {
        width:     '100%',
        maxWidth:  '480px',
        padding:   '0 20px',
        boxSizing: 'border-box'
      }
    });

    for (var j = 0; j < 3; j++) {
      cardsContainer.appendChild(_buildStrengthCard(j, crystalCountEl));
    }
    wrapper.appendChild(cardsContainer);

    root.appendChild(wrapper);

    // Start canvas animation loop
    _rafHandle = CQ.fx.rafLoop(_canvasFrame);
  }

  function _drawCompanionSilhouette() {
    if (!_ctx || !_canvas) { return; }
    var W = _canvas.width;
    var H = _canvas.height;
    _ctx.clearRect(0, 0, W, H);

    // Body
    var bodyColor = '#00C9B1';
    try {
      if (window.CQ && CQ.state && CQ.state.companion && CQ.state.companion.color) {
        var colorMap = {
          teal:   '#00C9B1',
          indigo: '#7B68EE',
          coral:  '#FF6B6B',
          amber:  '#F5A623',
          gold:   '#FFD700'
        };
        bodyColor = colorMap[CQ.state.companion.color] || bodyColor;
      }
    } catch (e) {}

    // Round companion body
    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(W * 0.5, H * 0.52, 38, 0, Math.PI * 2);
    var bodyGrad = _ctx.createRadialGradient(W * 0.42, H * 0.42, 4, W * 0.5, H * 0.5, 42);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.35, bodyColor);
    bodyGrad.addColorStop(1, bodyColor);
    _ctx.fillStyle = bodyGrad;
    _ctx.shadowColor = bodyColor;
    _ctx.shadowBlur  = 12;
    _ctx.fill();
    _ctx.restore();

    // Eyes
    _ctx.save();
    _ctx.fillStyle = '#FFFFFF';
    _ctx.beginPath(); _ctx.arc(W * 0.42, H * 0.46, 7, 0, Math.PI * 2); _ctx.fill();
    _ctx.beginPath(); _ctx.arc(W * 0.58, H * 0.46, 7, 0, Math.PI * 2); _ctx.fill();
    _ctx.fillStyle = '#2D2D2D';
    _ctx.beginPath(); _ctx.arc(W * 0.43, H * 0.465, 3.5, 0, Math.PI * 2); _ctx.fill();
    _ctx.beginPath(); _ctx.arc(W * 0.59, H * 0.465, 3.5, 0, Math.PI * 2); _ctx.fill();
    // Shine in eyes
    _ctx.fillStyle = '#FFFFFF';
    _ctx.beginPath(); _ctx.arc(W * 0.445, H * 0.455, 1.2, 0, Math.PI * 2); _ctx.fill();
    _ctx.beginPath(); _ctx.arc(W * 0.605, H * 0.455, 1.2, 0, Math.PI * 2); _ctx.fill();
    _ctx.restore();

    // Smile
    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(W * 0.5, H * 0.53, 12, 0.2, Math.PI - 0.2);
    _ctx.strokeStyle = '#FFFFFF';
    _ctx.lineWidth   = 2.5;
    _ctx.lineCap     = 'round';
    _ctx.stroke();
    _ctx.restore();
  }

  function _buildStrengthCard(index, crystalCountEl) {
    var promptText = _prompts[index];
    var color      = CRYSTAL_COLORS[index % CRYSTAL_COLORS.length];

    var card = _el('div', {
      style: {
        background:   BG_PANEL,
        borderRadius: '16px',
        border:       '2px solid #E8E0D8',
        padding:      '20px',
        marginBottom: '16px',
        boxShadow:    '0 2px 12px rgba(0,0,0,0.06)',
        transition:   'border-color 0.2s, box-shadow 0.2s'
      }
    });

    // Crystal badge
    var badgeRow = _el('div', {
      style: {
        display:       'flex',
        alignItems:    'center',
        gap:           '10px',
        marginBottom:  '12px'
      }
    });

    var badge = _el('div', {
      style: {
        width:       '28px',
        height:      '28px',
        borderRadius:'50%',
        background:  color,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        color:       '#FFFFFF',
        fontSize:    '13px',
        fontWeight:  '700',
        flexShrink:  '0',
        boxShadow:   '0 0 8px rgba(0,0,0,0.12)'
      },
      textContent: String(index + 1)
    });

    var crystalLabel = _el('span', {
      style: {
        fontSize:   '13px',
        fontWeight: '600',
        color:      color,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      },
      textContent: 'Courage Crystal ' + (index + 1)
    });

    badgeRow.appendChild(badge);
    badgeRow.appendChild(crystalLabel);
    card.appendChild(badgeRow);

    // Prompt
    var prompt = _el('p', {
      style: {
        fontSize:   '14px',
        lineHeight: '1.6',
        color:      TEXT_WARM,
        margin:     '0 0 14px',
        fontStyle:  'italic'
      },
      textContent: promptText
    });
    card.appendChild(prompt);

    // Textarea
    var textarea = _el('textarea', {
      placeholder: 'Your reflection goes here... (anything real counts)',
      style: {
        width:       '100%',
        minHeight:   '80px',
        borderRadius:'10px',
        border:      '1.5px solid #D5CCC4',
        padding:     '10px 12px',
        fontSize:    '14px',
        lineHeight:  '1.5',
        color:       TEXT_WARM,
        background:  '#FAFAF8',
        boxSizing:   'border-box',
        resize:      'vertical',
        fontFamily:  'inherit',
        outline:     'none',
        transition:  'border-color 0.2s, box-shadow 0.2s'
      }
    });
    textarea.addEventListener('focus', function () {
      textarea.style.borderColor = color;
      textarea.style.boxShadow   = '0 0 0 3px ' + color + '28';
      card.style.borderColor     = color;
      card.style.boxShadow       = '0 4px 20px rgba(0,0,0,0.10)';
    });
    textarea.addEventListener('blur', function () {
      textarea.style.borderColor = '#D5CCC4';
      textarea.style.boxShadow   = 'none';
      card.style.borderColor     = '#E8E0D8';
      card.style.boxShadow       = '0 2px 12px rgba(0,0,0,0.06)';
    });
    card.appendChild(textarea);

    // Validation hint (hidden until needed)
    var hint = _el('p', {
      style: {
        fontSize:   '12px',
        color:      '#B06040',
        margin:     '6px 0 0',
        minHeight:  '16px',
        transition: 'opacity 0.2s'
      },
      textContent: ''
    });
    card.appendChild(hint);

    // Submit button
    var btn = _el('button', {
      style: {
        marginTop:    '14px',
        width:        '100%',
        padding:      '12px',
        borderRadius: '12px',
        border:       'none',
        background:   color,
        color:        '#FFFFFF',
        fontSize:     '15px',
        fontWeight:   '700',
        cursor:       'pointer',
        boxShadow:    '0 3px 10px ' + color + '55',
        transition:   'transform 0.12s, box-shadow 0.12s, opacity 0.2s',
        letterSpacing: '0.3px'
      },
      textContent: 'Collect Crystal'
    });

    // State: locked after collected
    var collected = false;

    btn.addEventListener('pointerdown', function () {
      if (collected) { return; }
      var value = textarea.value.trim();
      if (!value) {
        // Gentle validation
        hint.textContent = 'Just a few words is all you need — any real reflection counts.';
        textarea.focus();
        try { CQ.fx.shake(card, 5); } catch (e) {}
        return;
      }
      hint.textContent = '';
      collected = true;
      _onStrengthCollected(index, card, btn, textarea, crystalCountEl, color);
    });

    btn.addEventListener('mouseenter', function () {
      if (!collected) {
        btn.style.transform  = 'translateY(-2px)';
        btn.style.boxShadow  = '0 6px 16px ' + color + '66';
      }
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform  = '';
      btn.style.boxShadow  = '0 3px 10px ' + color + '55';
    });

    card.appendChild(btn);
    return card;
  }

  function _onStrengthCollected(index, card, btn, textarea, crystalCountEl, color) {
    // Disable the card
    textarea.disabled         = true;
    textarea.style.opacity    = '0.65';
    btn.disabled              = true;
    btn.style.opacity         = '0.55';
    btn.textContent           = 'Crystal Collected!';
    card.style.borderColor    = color;
    card.style.background     = color + '10';
    card.style.boxShadow      = '0 4px 20px ' + color + '33';

    // Glow the badge
    var badge = card.querySelector('div');
    if (badge) {
      badge.style.boxShadow = GLOW_SHADOW;
      badge.style.transform = 'scale(1.2)';
    }

    // Launch the crystal FX
    _launchCrystal(index);

    // Increment collected
    _collected += 1;
    crystalCountEl.textContent = _collected + ' / 3';

    // Affirm
    var affirmations = [
      'Yes! That\'s a real strength. Own it.',
      'Beautiful. You just proved something to yourself.',
      'That matters. Keep going — you\'re building something real.'
    ];
    var affirmEl = card.querySelector('p:last-of-type');
    if (affirmEl) {
      affirmEl.style.color       = color;
      affirmEl.style.fontStyle   = 'normal';
      affirmEl.style.fontWeight  = '600';
      affirmEl.textContent       = affirmations[Math.min(index, affirmations.length - 1)];
    }

    // Check completion after burst lands (~550ms)
    if (_collected >= 3) {
      setTimeout(_completeGame, 650);
    }
  }

  function _completeGame() {
    if (_done) { return; }
    _done = true;

    // Show celebration overlay
    _showCompletionOverlay();

    // Play win cue
    try { CQ.fx.playCue('win'); } catch (e) {}

    // State updates
    try {
      var _firstClear = CQ.state && CQ.state.nodes && !CQ.state.nodes['power-up-lab'];
      CQ.state.clearNode('power-up-lab');
      if (_firstClear) { CQ.companion.levelUp(); }
    } catch (e) {
      console.error('[power-up-lab] clearNode/levelUp failed:', e);
    }

    // Navigate after the celebration overlay has a moment to breathe
    setTimeout(function () {
      try {
        CQ.app.showScreen('world-map');
      } catch (e) {
        console.error('[power-up-lab] showScreen world-map failed:', e);
      }
    }, 2200);
  }

  function _showCompletionOverlay() {
    if (!_rootEl) { return; }

    var overlay = _el('div', {
      style: {
        position:       'fixed',
        inset:          '0',
        background:     'rgba(0,201,177,0.88)',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         '9999',
        opacity:        '0',
        transition:     'opacity 0.4s'
      }
    });

    var celebCanvas = _el('canvas', {
      width:  String(Math.min(window.innerWidth, 480)),
      height: String(Math.min(window.innerHeight, 600)),
      style: {
        position: 'absolute',
        top:      '0',
        left:     '50%',
        transform:'translateX(-50%)',
        pointerEvents: 'none'
      }
    });
    overlay.appendChild(celebCanvas);

    var msg = _el('div', {
      style: {
        textAlign:   'center',
        color:       '#FFFFFF',
        position:    'relative',
        zIndex:      '1',
        padding:     '0 24px'
      }
    });
    msg.appendChild(_el('div', {
      style: { fontSize: '52px', marginBottom: '12px' },
      textContent: '★'
    }));
    msg.appendChild(_el('h2', {
      style: {
        fontSize:     '26px',
        fontWeight:   '800',
        margin:       '0 0 12px',
        letterSpacing:'-0.3px'
      },
      textContent: 'Power-Up Complete!'
    }));
    msg.appendChild(_el('p', {
      style: {
        fontSize:   '17px',
        lineHeight: '1.6',
        margin:     '0',
        opacity:    '0.92'
      },
      textContent: 'Three Courage Crystals collected. Your companion is stronger — and so are you. Heading back to the map...'
    }));
    overlay.appendChild(msg);
    _rootEl.appendChild(overlay);

    // Fade in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
      });
    });

    // Fire celebration particles on the overlay canvas
    var celebCtx = celebCanvas.getContext('2d');
    if (celebCtx) {
      var cW = celebCanvas.width;
      var cH = celebCanvas.height;
      for (var i = 0; i < 5; i++) {
        (function (delay, x) {
          setTimeout(function () {
            try {
              CQ.fx.particleBurst(celebCtx, x, cH * 0.4, {
                count:  32,
                colors: ['#FFD700', '#FFFFFF', '#7B68EE', '#F5A623'],
                spread: 140,
                life:   1000,
                radius: 6
              });
            } catch (e) {}
          }, delay);
        })(i * 150, cW * (0.1 + i * 0.2));
      }
    }
  }

  // ── Prompt selection ─────────────────────────────────────────────────────────
  function _selectPrompts(count) {
    var pool    = getStrengthPrompts().slice();
    var result  = [];
    // Shuffle and pick first `count`
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    for (var k = 0; k < count && k < pool.length; k++) {
      result.push(pool[k]);
    }
    // Pad with fallbacks if pool was too small
    while (result.length < count) {
      result.push('Share a strength or win you\'re proud of.');
    }
    return result;
  }

  // ── Screen registration ──────────────────────────────────────────────────────
  CQ.screens = CQ.screens || {};

  CQ.screens['power-up-lab'] = {
    mount: function (rootEl) {
      _rootEl = rootEl;
      try {
        _buildUI(rootEl);
      } catch (e) {
        console.error('[power-up-lab] mount error:', e);
        rootEl.textContent = 'Power-Up Lab failed to load. Please refresh and try again.';
      }
    },

    unmount: function () {
      // Stop the canvas animation loop
      if (_rafHandle) {
        try { _rafHandle.stop(); } catch (e) {}
        _rafHandle = null;
      }
      // Clear refs
      _canvas    = null;
      _ctx       = null;
      _crystals  = [];
      _rootEl    = null;
      _done      = false;
    }
  };

}());

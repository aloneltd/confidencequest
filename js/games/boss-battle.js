// Brick: boss-battle | Stud: js/game-state.js, js/fx-kit.js, data/content.json
// Socket: js/games/boss-battle.js — registers CQ.screens["boss-battle"]
// Pokémon-style turn-based climax: archetype boss attacks with doubt lines;
// player chooses courage responses to fill the Courage Meter and defeat the boss.

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ─── SVG Boss definitions (one clearly distinct creature per archetype) ────
  // Each returns an inline SVG string. Shapes/colors/faces differ enough that
  // a colorblind player can still distinguish by shape alone.

  var BOSS_SVGS = {

    // Interrogator: sharp angular form, cold blue-grey, narrowed eye slits —
    // looks like a predatory bureaucratic machine
    interrogator: function () {
      return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-label="The Interrogator boss">'
        // Body — angular trapezoid
        + '<polygon points="40,180 160,180 145,80 55,80" fill="#2A3B5E" stroke="#4A6FA5" stroke-width="2"/>'
        // Neck
        + '<rect x="85" y="60" width="30" height="25" rx="4" fill="#2A3B5E" stroke="#4A6FA5" stroke-width="2"/>'
        // Head — rectangular, authoritative
        + '<rect x="50" y="20" width="100" height="45" rx="6" fill="#1E2D4A" stroke="#4A6FA5" stroke-width="2.5"/>'
        // Eyes — narrow hostile slits
        + '<rect x="65" y="33" width="25" height="8" rx="4" fill="#FF4136"/>'
        + '<rect x="110" y="33" width="25" height="8" rx="4" fill="#FF4136"/>'
        // Pupil dots
        + '<circle cx="77" cy="37" r="3" fill="#8B0000"/>'
        + '<circle cx="122" cy="37" r="3" fill="#8B0000"/>'
        // Mouth — thin straight line (no warmth)
        + '<line x1="75" y1="52" x2="125" y2="52" stroke="#4A6FA5" stroke-width="2" stroke-linecap="round"/>'
        // Collar / badge chevrons
        + '<polygon points="80,80 100,95 120,80" fill="#4A6FA5"/>'
        + '<polygon points="85,80 100,91 115,80" fill="#3A5A8A"/>'
        // Arms — rigid, pointing downward
        + '<line x1="40" y1="110" x2="10" y2="150" stroke="#2A3B5E" stroke-width="10" stroke-linecap="round"/>'
        + '<line x1="160" y1="110" x2="190" y2="150" stroke="#2A3B5E" stroke-width="10" stroke-linecap="round"/>'
        // Glow aura
        + '<ellipse cx="100" cy="185" rx="65" ry="12" fill="#4A6FA5" opacity="0.35"/>'
        // Red forehead stripe — authority mark
        + '<rect x="75" y="20" width="50" height="8" rx="3" fill="#CC0000"/>'
        + '</svg>';
    },

    // Critic: tall oval form, sickly yellow-green, oversized frowning mouth —
    // looks like a judgmental blob that cannot stop talking
    critic: function () {
      return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-label="The Critic boss">'
        // Body — large round teardrop, asymmetric (tilted like it's mid-lecture)
        + '<ellipse cx="100" cy="145" rx="65" ry="70" fill="#4B5A1A" stroke="#8AAB24" stroke-width="2"/>'
        // Head merges with body — bulging forehead
        + '<ellipse cx="100" cy="75" rx="55" ry="60" fill="#5C6E20" stroke="#8AAB24" stroke-width="2.5"/>'
        // Big judging eyes — wide, superior tilt
        + '<ellipse cx="78" cy="62" rx="14" ry="11" fill="#C8FF00" stroke="#8AAB24" stroke-width="1.5"/>'
        + '<ellipse cx="122" cy="62" rx="14" ry="11" fill="#C8FF00" stroke="#8AAB24" stroke-width="1.5"/>'
        // Pupils — looking slightly downward (dismissive)
        + '<circle cx="80" cy="65" r="6" fill="#1A2600"/>'
        + '<circle cx="124" cy="65" r="6" fill="#1A2600"/>'
        // Eye-shine
        + '<circle cx="83" cy="62" r="2" fill="white" opacity="0.7"/>'
        + '<circle cx="127" cy="62" r="2" fill="white" opacity="0.7"/>'
        // Exaggerated frowning mouth
        + '<path d="M 68 95 Q 100 82 132 95" stroke="#8AAB24" stroke-width="2.5" fill="none"/>'
        + '<path d="M 68 95 Q 100 108 132 95" fill="#2A3500" stroke="#8AAB24" stroke-width="1.5"/>'
        // Tiny pointed critic finger-arms
        + '<line x1="36" y1="140" x2="10" y2="115" stroke="#4B5A1A" stroke-width="9" stroke-linecap="round"/>'
        + '<line x1="164" y1="140" x2="190" y2="115" stroke="#4B5A1A" stroke-width="9" stroke-linecap="round"/>'
        // Pointing finger on right arm (the lecture gesture)
        + '<circle cx="190" cy="110" r="7" fill="#4B5A1A" stroke="#8AAB24" stroke-width="1.5"/>'
        // Wrinkle lines (stress emanating upward from head)
        + '<line x1="95" y1="17" x2="90" y2="5" stroke="#8AAB24" stroke-width="1.5" stroke-linecap="round"/>'
        + '<line x1="105" y1="16" x2="110" y2="4" stroke="#8AAB24" stroke-width="1.5" stroke-linecap="round"/>'
        + '<line x1="115" y1="19" x2="123" y2="8" stroke="#8AAB24" stroke-width="1.5" stroke-linecap="round"/>'
        // Ground shadow
        + '<ellipse cx="100" cy="213" rx="60" ry="8" fill="#8AAB24" opacity="0.28"/>'
        + '</svg>';
    },

    // Gatekeeper: squat heavy fortress shape, dark purple/stone, chained door motif —
    // looks like an immovable wall with eyes
    gatekeeper: function () {
      return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-label="The Gatekeeper boss">'
        // Massive body — wide, squat rectangle like a wall segment
        + '<rect x="20" y="90" width="160" height="120" rx="8" fill="#3B1F5E" stroke="#7B4FAA" stroke-width="2.5"/>'
        // Crenellations on top (castle battlement silhouette)
        + '<rect x="20" y="72" width="28" height="22" rx="3" fill="#3B1F5E" stroke="#7B4FAA" stroke-width="2"/>'
        + '<rect x="60" y="72" width="28" height="22" rx="3" fill="#3B1F5E" stroke="#7B4FAA" stroke-width="2"/>'
        + '<rect x="100" y="72" width="28" height="22" rx="3" fill="#3B1F5E" stroke="#7B4FAA" stroke-width="2"/>'
        + '<rect x="140" y="72" width="28" height="22" rx="3" fill="#3B1F5E" stroke="#7B4FAA" stroke-width="2"/>'
        // Face embedded in wall — head IS the wall
        + '<rect x="55" y="95" width="90" height="70" rx="6" fill="#2D1650" stroke="#7B4FAA" stroke-width="2"/>'
        // Heavy browed eyes
        + '<rect x="62" y="105" width="28" height="6" rx="3" fill="#7B4FAA"/>'
        + '<rect x="110" y="105" width="28" height="6" rx="3" fill="#7B4FAA"/>'
        + '<ellipse cx="76" cy="118" rx="12" ry="10" fill="#1A0030" stroke="#7B4FAA" stroke-width="1.5"/>'
        + '<ellipse cx="124" cy="118" rx="12" ry="10" fill="#1A0030" stroke="#7B4FAA" stroke-width="1.5"/>'
        // Eye glow — eerie purple
        + '<circle cx="76" cy="118" r="6" fill="#A855F7" opacity="0.8"/>'
        + '<circle cx="124" cy="118" r="6" fill="#A855F7" opacity="0.8"/>'
        + '<circle cx="78" cy="116" r="2" fill="white" opacity="0.5"/>'
        + '<circle cx="126" cy="116" r="2" fill="white" opacity="0.5"/>'
        // Grimace / sealed gate mouth with chain bars
        + '<rect x="70" y="148" width="60" height="14" rx="4" fill="#1A0030" stroke="#7B4FAA" stroke-width="1.5"/>'
        + '<line x1="83" y1="148" x2="83" y2="162" stroke="#7B4FAA" stroke-width="2"/>'
        + '<line x1="96" y1="148" x2="96" y2="162" stroke="#7B4FAA" stroke-width="2"/>'
        + '<line x1="109" y1="148" x2="109" y2="162" stroke="#7B4FAA" stroke-width="2"/>'
        + '<line x1="122" y1="148" x2="122" y2="162" stroke="#7B4FAA" stroke-width="2"/>'
        // Chain links hanging from corners
        + '<circle cx="32" cy="170" r="7" fill="none" stroke="#7B4FAA" stroke-width="2.5"/>'
        + '<circle cx="32" cy="185" r="7" fill="none" stroke="#7B4FAA" stroke-width="2.5"/>'
        + '<circle cx="168" cy="170" r="7" fill="none" stroke="#7B4FAA" stroke-width="2.5"/>'
        + '<circle cx="168" cy="185" r="7" fill="none" stroke="#7B4FAA" stroke-width="2.5"/>'
        // Ground shadow
        + '<ellipse cx="100" cy="213" rx="72" ry="8" fill="#7B4FAA" opacity="0.3"/>'
        + '</svg>';
    },

    // Unknown: shifting fog-like amoeba, teal/black with multiple half-formed eyes —
    // no fixed shape, represents undefined dread
    unknown: function () {
      return '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" aria-label="The Unknown boss">'
        // Amorphous body using path — irregular blob
        + '<path d="M 100 30 C 145 15, 185 55, 175 100 C 168 135, 190 165, 160 185 '
        +    'C 130 205, 70 210, 45 190 C 18 170, 10 140, 20 105 '
        +    'C 28 75, 45 35, 100 30 Z" fill="#0D2B2B" stroke="#00C9B1" stroke-width="2"/>'
        // Misty secondary layer (slightly offset, creates fog depth)
        + '<path d="M 100 40 C 140 28, 172 62, 165 100 C 160 128, 178 155, 152 172 '
        +    'C 125 188, 78 195, 55 178 C 30 160, 24 132, 32 100 '
        +    'C 40 68, 58 50, 100 40 Z" fill="#0F3535" opacity="0.6"/>'
        // Many eyes — scattered, half-formed
        + '<ellipse cx="75" cy="80" rx="11" ry="14" fill="#001A1A" stroke="#00C9B1" stroke-width="1.5"/>'
        + '<ellipse cx="125" cy="75" rx="9" ry="12" fill="#001A1A" stroke="#00C9B1" stroke-width="1.5"/>'
        + '<ellipse cx="100" cy="110" rx="8" ry="10" fill="#001A1A" stroke="#00C9B1" stroke-width="1.5"/>'
        + '<ellipse cx="60" cy="115" rx="5" ry="7" fill="#001A1A" stroke="#00C9B1" stroke-width="1" opacity="0.7"/>'
        // Glowing pupils — teal
        + '<circle cx="75" cy="82" r="6" fill="#00C9B1" opacity="0.9"/>'
        + '<circle cx="125" cy="77" r="5" fill="#00C9B1" opacity="0.9"/>'
        + '<circle cx="100" cy="112" r="4" fill="#00C9B1" opacity="0.85"/>'
        + '<circle cx="60" cy="116" r="3" fill="#00C9B1" opacity="0.5"/>'
        // Shine
        + '<circle cx="77" cy="80" r="2" fill="white" opacity="0.5"/>'
        + '<circle cx="127" cy="75" r="1.5" fill="white" opacity="0.5"/>'
        // Vague mouth — a smear, not a clear shape
        + '<path d="M 78 145 Q 100 138 122 145" stroke="#00C9B1" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
        // Tendrils floating off the form
        + '<path d="M 30 90 Q 15 75, 8 60" stroke="#00C9B1" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>'
        + '<path d="M 170 85 Q 188 72, 195 58" stroke="#00C9B1" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.6"/>'
        + '<path d="M 55 175 Q 35 192, 28 210" stroke="#00C9B1" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>'
        // Fog ground
        + '<ellipse cx="100" cy="213" rx="65" ry="9" fill="#00C9B1" opacity="0.2"/>'
        + '</svg>';
    }
  };

  // Fallback for an unrecognised archetype key
  function getBossSVG(archetype) {
    var fn = BOSS_SVGS[archetype] || BOSS_SVGS['unknown'];
    return fn();
  }

  // ─── Boss display names (label) ───────────────────────────────────────────
  var FALLBACK_LABELS = {
    interrogator: 'The Interrogator',
    critic:       'The Critic',
    gatekeeper:   'The Gatekeeper',
    unknown:      'The Unknown'
  };

  // ─── Fallback content (used if CQ.content is absent / malformed) ─────────
  var FALLBACK_BOSS_LINES = {
    interrogator: [
      'Do you really think you can handle this {event}? I doubt it.',
      'Everyone who walks in here stumbles. Why would you be different?'
    ],
    critic: [
      'They\'ll see right through you the moment this {event} starts.',
      'One stumble and the room is lost. You know that, right?'
    ],
    gatekeeper: [
      'You\'ve been avoiding this {event}. The weight only grows.',
      'Say the wrong thing and you can\'t take it back.'
    ],
    unknown: [
      'This {event} could expose you. Are you ready for that?',
      'What if there\'s nothing interesting to say? Then what?'
    ]
  };

  var FALLBACK_RESPONSES = [
    { text: 'I\'ve prepared for this — I can handle it.', courage: 30 },
    { text: 'My anxiety is normal; I\'ll breathe and keep going.', courage: 30 },
    { text: 'I\'ve overcome hard moments before. I can do it again.', courage: 40 }
  ];

  // ─── Token substitution ───────────────────────────────────────────────────
  function subToken(str, eventName) {
    var safe = (typeof eventName === 'string' && eventName.trim()) ? eventName : 'your event';
    return str.replace(/\{event\}/g, safe);
  }

  // ─── Safe content accessors ───────────────────────────────────────────────
  function getArchetypeData(archetype) {
    try {
      if (CQ.content && CQ.content.archetypes && CQ.content.archetypes[archetype]) {
        return CQ.content.archetypes[archetype];
      }
    } catch (e) {
      console.warn('[boss-battle] CQ.content not available, using fallbacks:', e);
    }
    return null;
  }

  function getBossLines(archetypeData, archetype, eventName) {
    var lines;
    if (archetypeData && Array.isArray(archetypeData.bossLines) && archetypeData.bossLines.length) {
      lines = archetypeData.bossLines;
    } else {
      lines = FALLBACK_BOSS_LINES[archetype] || FALLBACK_BOSS_LINES['unknown'];
    }
    return lines.map(function (l) { return subToken(l, eventName); });
  }

  function getResponses(archetypeData) {
    if (archetypeData && Array.isArray(archetypeData.responses) && archetypeData.responses.length >= 3) {
      return archetypeData.responses;
    }
    return FALLBACK_RESPONSES;
  }

  function getBossLabel(archetypeData, archetype) {
    if (archetypeData && archetypeData.label) { return archetypeData.label; }
    return FALLBACK_LABELS[archetype] || 'The Doubt';
  }

  function getBossTaunt(archetypeData, archetype) {
    if (archetypeData && archetypeData.taunt) { return archetypeData.taunt; }
    return 'Face me if you dare.';
  }

  // ─── Courage meter target (always 100, hit by summing response courage values)
  // 4 turns × average ~25 = 100. Responses are balanced in content.json.
  var COURAGE_TARGET = 100;

  // ─── Module state (reset on each mount) ──────────────────────────────────
  var _active        = false;  // true while screen is mounted
  var _bossLineIndex = 0;      // which boss line we're on
  var _courageFill   = 0;      // 0..100
  var _meterEl       = null;   // DOM reference
  var _bossLines     = [];
  var _responses     = [];
  var _bossDefeated  = false;
  var _rootEl        = null;
  var _canvasEl      = null;
  var _canvasCtx     = null;
  var _obs           = null;   // MutationObserver for meter pct label (disconnected on unmount)

  // ─── DOM builder (no innerHTML on critical nodes; safety via textContent) ─
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') { node.className = attrs[k]; }
        else if (k === 'style') { node.style.cssText = attrs[k]; }
        else { node.setAttribute(k, attrs[k]); }
      });
    }
    if (children) {
      children.forEach(function (c) {
        if (!c) { return; }
        if (typeof c === 'string') { node.appendChild(document.createTextNode(c)); }
        else { node.appendChild(c); }
      });
    }
    return node;
  }

  function setHTML(node, htmlStr) {
    // Used only for known-safe SVG strings we construct internally
    node.innerHTML = htmlStr;
  }

  // ─── Courage meter animation ───────────────────────────────────────────────
  function animateMeter(fromVal, toVal, onComplete) {
    if (!_meterEl) { if (onComplete) { onComplete(); } return; }
    CQ.fx.tween(fromVal, toVal, 600, null, function (v) {
      if (_meterEl) {
        var pct = Math.min(Math.round(v), 100);
        _meterEl.style.width = pct + '%';
        _meterEl.setAttribute('aria-valuenow', pct);
        // Color shift: teal → gold as meter fills
        var hue = Math.round(170 - pct * 0.8); // 170 → ~90
        _meterEl.style.background = 'hsl(' + hue + ',80%,55%)';
      }
    }, onComplete);
  }

  // ─── Boss shake animation ─────────────────────────────────────────────────
  function shakeBoss() {
    var bossEl = _rootEl && _rootEl.querySelector('.bb-boss-figure');
    if (bossEl) { CQ.fx.shake(bossEl, 10); }
  }

  // ─── Particle burst on canvas ─────────────────────────────────────────────
  function burstOnCanvas(opts) {
    if (!_canvasCtx || !_canvasEl) { return; }
    var cx = _canvasEl.width / 2;
    var cy = _canvasEl.height / 3;
    CQ.fx.particleBurst(_canvasCtx, cx, cy, opts || {});
  }

  // ─── Render boss "attack" line ─────────────────────────────────────────────
  function renderBossAttack() {
    if (!_active || !_rootEl) { return; }
    var speechEl = _rootEl.querySelector('.bb-speech');
    if (!speechEl) { return; }

    var line = _bossLines[_bossLineIndex % _bossLines.length];

    // Animate text in (simple wipe effect via opacity transition)
    speechEl.style.opacity = '0';
    speechEl.textContent   = '';
    speechEl.style.transition = 'opacity 0.35s ease';

    setTimeout(function () {
      if (!_active) { return; }
      speechEl.textContent = '“' + line + '”';  // curly open/close quotes
      speechEl.style.opacity = '1';
      CQ.fx.playCue('zap');
      // Shake the whole battle area
      var arenaEl = _rootEl.querySelector('.bb-arena');
      if (arenaEl) { CQ.fx.shake(arenaEl, 5); }
    }, 200);
  }

  // ─── Lock / unlock response buttons ───────────────────────────────────────
  function setResponsesEnabled(enabled) {
    if (!_rootEl) { return; }
    var btns = _rootEl.querySelectorAll('.bb-response-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = !enabled;
      btns[i].style.opacity = enabled ? '1' : '0.45';
    }
  }

  // ─── Turn result message ──────────────────────────────────────────────────
  function showTurnFeedback(responseText, onDone) {
    if (!_rootEl) { if (onDone) { onDone(); } return; }
    var feedbackEl = _rootEl.querySelector('.bb-feedback');
    if (!feedbackEl) { if (onDone) { onDone(); } return; }

    feedbackEl.textContent = responseText;
    feedbackEl.style.opacity = '1';
    feedbackEl.style.transform = 'translateY(0)';

    setTimeout(function () {
      if (!_active) { return; }
      feedbackEl.style.opacity = '0';
      feedbackEl.style.transform = 'translateY(-8px)';
      if (onDone) { setTimeout(onDone, 350); }
    }, 1600);
  }

  // ─── Victory sequence ─────────────────────────────────────────────────────
  function runVictory() {
    _bossDefeated = true;
    setResponsesEnabled(false);

    // Hide speech / response panels; show victory overlay
    var speechEl   = _rootEl && _rootEl.querySelector('.bb-speech');
    var responsesEl = _rootEl && _rootEl.querySelector('.bb-responses');
    if (speechEl)    { speechEl.style.opacity = '0'; }
    if (responsesEl) { responsesEl.style.opacity = '0'; }

    // Fade boss out
    var bossEl = _rootEl && _rootEl.querySelector('.bb-boss-figure');
    if (bossEl) {
      bossEl.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      bossEl.style.transform  = 'scale(0.2) translateY(-40px)';
      bossEl.style.opacity    = '0';
    }

    // Big particle finale
    burstOnCanvas({ count: 60, spread: 200, life: 1400, colors: ['#FFD700', '#00C9B1', '#F5A623', '#A855F7', '#FF6B6B'] });
    CQ.fx.playCue('win');

    // Capture first-clear flag before any clearNode call
    var _firstClear = CQ.state && CQ.state.nodes && !CQ.state.nodes['boss-battle'];

    // Level-up companion with a small delay for drama
    setTimeout(function () {
      if (!_active) { return; }
      try { if (_firstClear) { CQ.companion.levelUp(); } } catch (e) { console.warn('[boss-battle] companion.levelUp error:', e); }
    }, 400);

    // Clear the node (sets stat to 100%)
    setTimeout(function () {
      if (!_active) { return; }
      try { CQ.state.clearNode('boss-battle'); } catch (e) { console.warn('[boss-battle] clearNode error:', e); }
    }, 600);

    // Second burst
    setTimeout(function () {
      if (!_active) { return; }
      burstOnCanvas({ count: 50, spread: 180, life: 1200, colors: ['#FFD700', '#FF6B6B', '#A855F7'] });
    }, 900);

    // Show victory overlay
    setTimeout(function () {
      if (!_active) { return; }
      showVictoryOverlay();
    }, 1200);
  }

  function showVictoryOverlay() {
    if (!_rootEl) { return; }
    var overlay = el('div', {
      class: 'bb-victory-overlay',
      style: [
        'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'background:rgba(26,16,64,0.92);z-index:20;opacity:0;transition:opacity 0.5s ease;',
        'border-radius:var(--r-lg,1.25rem);text-align:center;padding:var(--sp-8,2rem);'
      ].join('')
    }, [
      el('div', { style: 'font-size:3.5rem;margin-bottom:0.5rem;' }, ['✨']),
      el('h2', {
        style: [
          'font-family:var(--font-display);color:var(--gold,#FFD700);',
          'font-size:var(--text-3xl,1.875rem);margin:0 0 0.5rem;line-height:1.2;'
        ].join('')
      }, ['Doubt Defeated!']),
      el('p', {
        style: 'color:var(--text-primary,#F0EAF8);font-size:var(--text-lg,1.125rem);margin:0 0 2rem;max-width:36ch;'
      }, ['Your courage shattered the ' + (_rootEl._bossLabel || 'doubt') + '. You’re ready.']),
      el('button', {
        class: 'bb-continue-btn',
        style: [
          'background:var(--gold,#FFD700);color:var(--text-on-gold,#1A1040);',
          'border:none;border-radius:var(--r-full,9999px);padding:0.875rem 2.5rem;',
          'font-size:var(--text-lg,1.125rem);font-family:var(--font-display);font-weight:700;',
          'cursor:pointer;box-shadow:var(--shadow-gold,0 0 24px rgba(255,215,0,0.7));',
          'transition:transform 0.15s ease,box-shadow 0.15s ease;'
        ].join('')
      }, ['See Your Results →'])
    ]);

    _rootEl.style.position = 'relative';
    _rootEl.appendChild(overlay);

    // Fade overlay in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.style.opacity = '1';
      });
    });

    // Continue button handler
    var continueBtn = overlay.querySelector('.bb-continue-btn');
    if (continueBtn) {
      continueBtn.addEventListener('pointerdown', function () {
        CQ.fx.playCue('click');
        continueBtn.style.transform = 'scale(0.96)';
      });
      continueBtn.addEventListener('pointerup', function () {
        continueBtn.style.transform = 'scale(1)';
      });
      continueBtn.addEventListener('click', function () {
        try { CQ.app.showScreen('dashboard'); }
        catch (e) { console.error('[boss-battle] showScreen(dashboard) failed:', e); }
      });
    }
  }

  // ─── Player response handler ───────────────────────────────────────────────
  function handleResponse(response) {
    if (!_active || _bossDefeated) { return; }

    setResponsesEnabled(false);
    CQ.fx.playCue('collect');

    // Companion strikes back — particle burst on canvas
    burstOnCanvas({ count: 20, spread: 100, life: 700, colors: ['#00C9B1', '#FFD700', '#F5A623'] });

    // Shake the boss
    shakeBoss();

    // Advance courage
    var oldFill = _courageFill;
    _courageFill = Math.min(_courageFill + (response.courage || 25), COURAGE_TARGET);

    // Show what the player chose in a feedback strip
    showTurnFeedback(response.text, function () {
      if (!_active) { return; }

      // Animate meter fill
      animateMeter(oldFill, _courageFill, function () {
        if (!_active) { return; }

        if (_courageFill >= COURAGE_TARGET) {
          // Final meter fill → run victory
          runVictory();
        } else {
          // Next boss attack
          _bossLineIndex++;
          renderBossAttack();
          setResponsesEnabled(true);
        }
      });
    });
  }

  // ─── Screen mount ─────────────────────────────────────────────────────────
  function mount(rootEl) {
    _active       = true;
    _rootEl       = rootEl;
    _bossLineIndex = 0;
    _courageFill   = 0;
    _bossDefeated  = false;
    _meterEl       = null;
    _canvasEl      = null;
    _canvasCtx     = null;

    // Read state safely
    var archetype = 'unknown';
    var eventName = '';
    try {
      archetype = CQ.state.archetype || 'unknown';
      eventName = CQ.state.eventName || '';
    } catch (e) {
      console.warn('[boss-battle] CQ.state read error:', e);
    }

    // Validate archetype
    var validArchetypes = ['interrogator', 'critic', 'gatekeeper', 'unknown'];
    if (validArchetypes.indexOf(archetype) === -1) { archetype = 'unknown'; }

    // Load content
    var archetypeData = getArchetypeData(archetype);
    _bossLines        = getBossLines(archetypeData, archetype, eventName);
    _responses        = getResponses(archetypeData);
    var bossLabel     = getBossLabel(archetypeData, archetype);
    var bossTaunt     = getBossTaunt(archetypeData, archetype);

    // Stash boss label for use in victory overlay
    rootEl._bossLabel = bossLabel;

    // ── Check if boss is enterable (all training nodes cleared) ──────────────
    // World-map enforces the gate; here we show a soft warning if not cleared
    // so a direct-navigation user sees something helpful.
    var allTraining = false;
    try {
      var n = CQ.state.nodes;
      allTraining = n['breathe-runner'] && n['thought-buster'] && n['power-up-lab'] && n['star-forge'];
    } catch (e) { allTraining = true; } // if we can't read, let them through

    if (!allTraining) {
      _renderNotReady(rootEl, archetype);
      return;
    }

    // ── Build the battle UI ───────────────────────────────────────────────────
    rootEl.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;',
      'min-height:100vh;padding:var(--sp-6,1.5rem) var(--sp-4,1rem);',
      'background:var(--bg,#1A1040);box-sizing:border-box;position:relative;'
    ].join('');

    // Canvas for particle FX (absolute, pointer-events:none)
    _canvasEl = el('canvas', {
      width: '400',
      height: '320',
      style: [
        'position:absolute;top:0;left:50%;transform:translateX(-50%);',
        'pointer-events:none;z-index:10;max-width:100%;'
      ].join(''),
      'aria-hidden': 'true'
    });
    try { _canvasCtx = _canvasEl.getContext('2d'); } catch (e) { _canvasCtx = null; }

    // Header
    var header = el('div', {
      style: 'width:100%;max-width:520px;text-align:center;margin-bottom:var(--sp-4,1rem);'
    }, [
      el('p', {
        style: 'color:var(--text-secondary,#B8A9D9);font-size:var(--text-sm,0.875rem);letter-spacing:var(--tracking-wider,0.08em);text-transform:uppercase;margin:0 0 0.25rem;'
      }, ['FINAL BOSS']),
      el('h1', {
        style: [
          'font-family:var(--font-display);color:var(--coral,#FF6B6B);',
          'font-size:var(--text-3xl,1.875rem);margin:0;line-height:var(--leading-tight,1.2);'
        ].join('')
      }, [bossLabel])
    ]);

    // Courage meter row
    var meterWrapOuter = el('div', {
      style: 'width:100%;max-width:520px;margin-bottom:var(--sp-4,1rem);'
    }, [
      el('div', {
        style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.35rem;'
      }, [
        el('span', { style: 'font-size:var(--text-xs,0.75rem);color:var(--text-secondary,#B8A9D9);text-transform:uppercase;letter-spacing:var(--tracking-wider,0.08em);' }, ['Courage Meter']),
        el('span', {
          class: 'bb-meter-pct',
          style: 'font-size:var(--text-xs,0.75rem);color:var(--teal,#00C9B1);font-family:var(--font-display);'
        }, ['0%'])
      ]),
      el('div', {
        role: 'progressbar',
        'aria-label': 'Courage Meter',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        style: [
          'width:100%;height:16px;background:var(--bg-surface,#2D1E6E);',
          'border-radius:var(--r-full,9999px);overflow:hidden;',
          'border:1px solid var(--bg-surface2,#3A2685);'
        ].join('')
      }, [
        (function () {
          _meterEl = el('div', {
            style: [
              'height:100%;width:0%;background:var(--teal,#00C9B1);',
              'border-radius:var(--r-full,9999px);transition:width 0.1s linear;'
            ].join(''),
            'aria-hidden': 'true'
          });
          return _meterEl;
        })()
      ])
    ]);

    // Keep pct label in sync with meter
    var pctLabel = meterWrapOuter.querySelector('.bb-meter-pct');
    if (_meterEl && pctLabel) {
      var _origAnimate = animateMeter;
      // Patch in the pct label update via a MutationObserver on aria-valuenow
      _obs = new MutationObserver(function () {
        var val = _meterEl ? _meterEl.getAttribute('aria-valuenow') : '0';
        pctLabel.textContent = (val || '0') + '%';
      });
      _obs.observe(_meterEl, { attributes: true, attributeFilter: ['aria-valuenow'] });
    }

    // Arena: boss figure + speech bubble
    var bossFigureWrap = el('div', {
      class: 'bb-boss-figure',
      style: [
        'width:160px;height:200px;flex-shrink:0;',
        'transition:transform 0.3s ease,opacity 0.6s ease;',
        'filter:drop-shadow(0 0 16px rgba(168,85,247,0.4));'
      ].join('')
    });
    setHTML(bossFigureWrap, getBossSVG(archetype));

    var speechBubble = el('div', {
      class: 'bb-speech',
      style: [
        'flex:1;min-width:0;background:var(--bg-surface,#2D1E6E);',
        'border:1.5px solid var(--bg-surface2,#3A2685);border-radius:var(--r-lg,1.25rem);',
        'padding:var(--sp-5,1.25rem);font-size:var(--text-base,1rem);',
        'color:var(--text-primary,#F0EAF8);line-height:var(--leading-normal,1.55);',
        'font-style:italic;transition:opacity 0.35s ease;min-height:80px;',
        'display:flex;align-items:center;'
      ].join('')
    }, [bossTaunt]);  // taunt shown at open; overwritten each turn

    var arena = el('div', {
      class: 'bb-arena',
      style: [
        'width:100%;max-width:520px;display:flex;flex-direction:row;gap:var(--sp-5,1.25rem);',
        'align-items:center;margin-bottom:var(--sp-5,1.25rem);'
      ].join('')
    }, [bossFigureWrap, speechBubble]);

    // Feedback strip (player's chosen line, briefly shown)
    var feedbackEl = el('div', {
      class: 'bb-feedback',
      style: [
        'width:100%;max-width:520px;',
        'background:linear-gradient(135deg,rgba(0,201,177,0.15),rgba(245,166,35,0.1));',
        'border:1px solid var(--teal-dark,#009E8C);border-radius:var(--r-md,0.75rem);',
        'padding:var(--sp-4,1rem);color:var(--teal-light,#33D6C4);',
        'font-size:var(--text-sm,0.875rem);line-height:var(--leading-normal,1.55);',
        'min-height:48px;opacity:0;transition:opacity 0.3s ease,transform 0.3s ease;',
        'margin-bottom:var(--sp-4,1rem);font-style:italic;'
      ].join('')
    });

    // Response button grid
    var responseBtns = _responses.map(function (r, idx) {
      var btn = el('button', {
        class: 'bb-response-btn',
        'data-idx': String(idx),
        style: [
          'display:block;width:100%;text-align:left;',
          'background:var(--bg-surface,#2D1E6E);',
          'border:1.5px solid var(--bg-surface2,#3A2685);border-radius:var(--r-md,0.75rem);',
          'padding:var(--sp-4,1rem) var(--sp-5,1.25rem);',
          'color:var(--text-primary,#F0EAF8);font-size:var(--text-sm,0.875rem);',
          'line-height:var(--leading-normal,1.55);cursor:pointer;',
          'transition:background 0.15s ease,border-color 0.15s ease,transform 0.1s ease;'
        ].join('')
      }, [r.text]);

      // Pointer events: visual feedback + action
      btn.addEventListener('pointerdown', function () {
        if (!btn.disabled) {
          btn.style.background   = 'rgba(0,201,177,0.15)';
          btn.style.borderColor  = 'var(--teal,#00C9B1)';
          btn.style.transform    = 'scale(0.98)';
        }
      });
      btn.addEventListener('pointerup', function () {
        btn.style.transform = 'scale(1)';
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.transform    = 'scale(1)';
        if (!btn.disabled) {
          btn.style.background  = 'var(--bg-surface,#2D1E6E)';
          btn.style.borderColor = 'var(--bg-surface2,#3A2685)';
        }
      });
      btn.addEventListener('click', function () {
        if (btn.disabled || _bossDefeated || !_active) { return; }
        handleResponse(r);
      });

      return btn;
    });

    var responsesEl = el('div', {
      class: 'bb-responses',
      style: [
        'width:100%;max-width:520px;display:flex;flex-direction:column;',
        'gap:var(--sp-3,0.75rem);transition:opacity 0.3s ease;'
      ].join('')
    });
    responseBtns.forEach(function (b) { responsesEl.appendChild(b); });

    var responsesLabel = el('p', {
      style: 'width:100%;max-width:520px;color:var(--text-secondary,#B8A9D9);font-size:var(--text-xs,0.75rem);text-transform:uppercase;letter-spacing:var(--tracking-wider,0.08em);margin:0 0 var(--sp-2,0.5rem);'
    }, ['Choose your courage:']);

    // Assemble the screen
    rootEl.innerHTML = '';
    rootEl.appendChild(_canvasEl);
    rootEl.appendChild(header);
    rootEl.appendChild(meterWrapOuter);
    rootEl.appendChild(arena);
    rootEl.appendChild(feedbackEl);
    rootEl.appendChild(responsesLabel);
    rootEl.appendChild(responsesEl);

    // Sync canvas size to actual rendered width
    try {
      var rect = rootEl.getBoundingClientRect();
      if (rect.width > 0) { _canvasEl.width = Math.min(rect.width, 520); }
    } catch (e) {}

    // Start the battle: boss speaks first on a small delay
    setTimeout(function () {
      if (!_active) { return; }
      renderBossAttack();
    }, 600);
  }

  // ─── "Not ready" state (training nodes not all cleared) ───────────────────
  function _renderNotReady(rootEl, archetype) {
    rootEl.innerHTML = '';
    rootEl.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;justify-content:center;',
      'min-height:100vh;padding:var(--sp-8,2rem);text-align:center;',
      'background:var(--bg,#1A1040);box-sizing:border-box;'
    ].join('');

    var backBtn = el('button', {
      style: [
        'background:var(--amber,#F5A623);color:var(--text-on-amber,#1A1040);',
        'border:none;border-radius:var(--r-full,9999px);padding:0.875rem 2.5rem;',
        'font-size:var(--text-base,1rem);font-family:var(--font-display);font-weight:700;',
        'cursor:pointer;margin-top:var(--sp-8,2rem);'
      ].join('')
    }, ['Back to Map']);

    backBtn.addEventListener('click', function () {
      try { CQ.app.showScreen('world-map'); } catch (e) {}
    });

    rootEl.appendChild(el('div', { style: 'font-size:3rem;margin-bottom:1rem;' }, ['🔒']));
    rootEl.appendChild(el('h2', {
      style: 'font-family:var(--font-display);color:var(--amber,#F5A623);font-size:var(--text-2xl,1.5rem);margin:0 0 0.75rem;'
    }, ['The Boss Awaits']));
    rootEl.appendChild(el('p', {
      style: 'color:var(--text-secondary,#B8A9D9);max-width:32ch;margin:0;font-size:var(--text-base,1rem);line-height:var(--leading-normal,1.55);'
    }, ['Complete all four training nodes first. Return when you\'re forged and ready.']));
    rootEl.appendChild(backBtn);
  }

  // ─── Screen unmount ────────────────────────────────────────────────────────
  function unmount() {
    _active      = false;
    _meterEl     = null;
    _canvasEl    = null;
    _canvasCtx   = null;
    _bossLines   = [];
    _responses   = [];
    _bossDefeated = false;
    try { if (_obs) { _obs.disconnect(); _obs = null; } } catch (e) {}
    if (_rootEl) {
      // Clear any inline style overrides set during mount
      _rootEl._bossLabel = undefined;
    }
    _rootEl = null;
  }

  // ─── Register the screen ──────────────────────────────────────────────────
  CQ.screens['boss-battle'] = {
    mount:   mount,
    unmount: unmount
  };

}());

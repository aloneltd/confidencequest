// Brick: world-map | Stud: js/game-state.js + js/companion.js + css/theme.css
// Socket: js/world-map.js — registers CQ.screens["world-map"] with mount/unmount.
// Renders an RPG-style winding-path level map with 5 nodes (breathe-runner →
// thought-buster → power-up-lab → star-forge → boss-battle). Reads CQ.state.nodes
// to paint cleared (gold glow) / available / locked states. Boss is locked until all
// 4 training nodes are cleared. Shows event banner, companion portrait, customizer
// button, and dashboard button. Restores state on every reopen (DoD-3).

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ─── Node definitions (winding-path order) ───────────────────────────────────
  var TRAINING_NODES = ['breathe-runner', 'thought-buster', 'power-up-lab', 'star-forge'];
  var ALL_NODES = TRAINING_NODES.concat(['boss-battle']);

  var NODE_META = {
    'breathe-runner': {
      label:   'Breathe Runner',
      emoji:   '🌬️',
      color:   '#00C9B1',   // teal
      glowVar: 'var(--shadow-teal)',
      desc:    'Calm your nerves with rhythm'
    },
    'thought-buster': {
      label:   'Thought Buster',
      emoji:   '⚡',
      color:   '#F5A623',   // amber
      glowVar: 'var(--shadow-amber)',
      desc:    'Zap anxious thoughts away'
    },
    'power-up-lab': {
      label:   'Power-Up Lab',
      emoji:   '💎',
      color:   '#A855F7',   // purple
      glowVar: 'var(--shadow-purple)',
      desc:    'Collect your strengths'
    },
    'star-forge': {
      label:   'Star Forge',
      emoji:   '⭐',
      color:   '#FFD700',   // gold
      glowVar: 'var(--shadow-gold)',
      desc:    'Forge your story'
    },
    'boss-battle': {
      label:   'Boss Battle',
      emoji:   '🔥',
      color:   '#FF6B6B',   // coral
      glowVar: 'var(--shadow-coral)',
      desc:    'Face your Doubt Boss'
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function isBossUnlocked() {
    var nodes = CQ.state.nodes;
    return TRAINING_NODES.every(function (id) { return nodes[id] === true; });
  }

  function getNodeState(id) {
    if (id === 'boss-battle') {
      if (!isBossUnlocked()) { return 'locked'; }
      return CQ.state.nodes[id] ? 'cleared' : 'available';
    }
    return CQ.state.nodes[id] ? 'cleared' : 'available';
  }

  // Build the SVG winding path that connects the 5 nodes.
  // Returns { svgEl, nodePositions } — nodePositions is an array of {x, y} in
  // SVG coordinate space (viewBox 0 0 340 560).
  function buildPathSVG() {
    var VW = 340;
    var VH = 560;

    // Node positions from bottom (node 0) to top (node 4) — winding S-curve
    var positions = [
      { x: 170, y: 500 },  // breathe-runner (bottom center)
      { x:  80, y: 400 },  // thought-buster (left)
      { x: 260, y: 300 },  // power-up-lab   (right)
      { x:  80, y: 190 },  // star-forge      (left)
      { x: 170, y:  80 }   // boss-battle    (top center)
    ];

    // Build a smooth cubic-bezier path through all 5 points
    function curvePath(pts) {
      if (pts.length < 2) { return ''; }
      var d = 'M ' + pts[0].x + ' ' + pts[0].y;
      for (var i = 1; i < pts.length; i++) {
        var prev = pts[i - 1];
        var curr = pts[i];
        var cpx1 = prev.x;
        var cpy1 = (prev.y + curr.y) / 2;
        var cpx2 = curr.x;
        var cpy2 = (prev.y + curr.y) / 2;
        d += ' C ' + cpx1 + ' ' + cpy1 + ', ' + cpx2 + ' ' + cpy2 + ', ' + curr.x + ' ' + curr.y;
      }
      return d;
    }

    var pathD = curvePath(positions);

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

    // Subtle starfield dots
    var starCount = 28;
    for (var s = 0; s < starCount; s++) {
      var cx = Math.round(10 + Math.random() * (VW - 20));
      var cy = Math.round(10 + Math.random() * (VH - 20));
      var r  = Math.random() > 0.7 ? 1.5 : 0.8;
      var star = document.createElementNS(svgNS, 'circle');
      star.setAttribute('cx', cx);
      star.setAttribute('cy', cy);
      star.setAttribute('r', r);
      star.setAttribute('fill', 'rgba(255,255,255,' + (0.2 + Math.random() * 0.4).toFixed(2) + ')');
      svg.appendChild(star);
    }

    // Glow-path (thick, blurred duplicate)
    var glowPath = document.createElementNS(svgNS, 'path');
    glowPath.setAttribute('d', pathD);
    glowPath.setAttribute('fill', 'none');
    glowPath.setAttribute('stroke', 'rgba(168,85,247,0.22)');
    glowPath.setAttribute('stroke-width', '22');
    glowPath.setAttribute('stroke-linecap', 'round');
    glowPath.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(glowPath);

    // Main trail
    var trail = document.createElementNS(svgNS, 'path');
    trail.setAttribute('d', pathD);
    trail.setAttribute('fill', 'none');
    trail.setAttribute('stroke', 'rgba(168,85,247,0.55)');
    trail.setAttribute('stroke-width', '5');
    trail.setAttribute('stroke-linecap', 'round');
    trail.setAttribute('stroke-linejoin', 'round');
    trail.setAttribute('stroke-dasharray', '10 7');
    svg.appendChild(trail);

    return { svgEl: svg, positions: positions };
  }

  // Build one node button element
  function buildNodeEl(id, pos, svgW, svgH, rootW, rootH) {
    var meta      = NODE_META[id];
    var nodeState = getNodeState(id);
    var isBoss    = id === 'boss-battle';
    var isLocked  = nodeState === 'locked';
    var isCleared = nodeState === 'cleared';

    // Convert SVG coordinate → percentage of the container
    var leftPct = (pos.x / svgW * 100).toFixed(2) + '%';
    var topPct  = (pos.y / svgH * 100).toFixed(2) + '%';

    var wrap = document.createElement('div');
    wrap.className = 'map-node' +
      (isBoss    ? ' map-node--boss'    : '') +
      (isLocked  ? ' map-node--locked'  : '') +
      (isCleared ? ' map-node--cleared' : '');
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', isLocked ? '-1' : '0');
    wrap.setAttribute('aria-label', meta.label + (isLocked ? ' (locked)' : isCleared ? ' (cleared)' : ''));
    wrap.setAttribute('aria-disabled', isLocked ? 'true' : 'false');
    wrap.setAttribute('data-node-id', id);
    wrap.style.cssText = [
      'position:absolute',
      'left:' + leftPct,
      'top:' + topPct,
      'transform:translate(-50%,-50%)',
      'z-index:2',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:6px'
    ].join(';');

    // Icon circle
    var icon = document.createElement('div');
    icon.className = 'map-node__icon';

    // Boss icon is SVG-drawn flame; others use emoji
    icon.style.cssText = buildNodeIconStyle(meta, nodeState, isBoss);

    if (isLocked) {
      // Lock overlay
      var lockSpan = document.createElement('span');
      lockSpan.setAttribute('aria-hidden', 'true');
      lockSpan.style.cssText = 'font-size:2rem;filter:grayscale(1) brightness(0.5);';
      lockSpan.textContent = '🔒';
      icon.appendChild(lockSpan);
    } else {
      var emojiSpan = document.createElement('span');
      emojiSpan.setAttribute('aria-hidden', 'true');
      emojiSpan.textContent = meta.emoji;
      icon.appendChild(emojiSpan);

      if (isCleared) {
        // Gold checkmark badge
        var check = document.createElement('span');
        check.setAttribute('aria-hidden', 'true');
        check.style.cssText = [
          'position:absolute',
          'top:-6px',
          'right:-6px',
          'width:20px',
          'height:20px',
          'border-radius:50%',
          'background:var(--gold)',
          'color:#1A1040',
          'font-size:11px',
          'font-weight:900',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'box-shadow:0 0 8px rgba(255,215,0,0.8)'
        ].join(';');
        check.textContent = '✓';
        icon.style.position = 'relative';
        icon.appendChild(check);
      }
    }
    wrap.appendChild(icon);

    // Label
    var label = document.createElement('span');
    label.className = 'map-node__label';
    label.textContent = meta.label;
    wrap.appendChild(label);

    // Lock hint for boss
    if (isLocked && isBoss) {
      var hint = document.createElement('span');
      hint.style.cssText = [
        'font-size:9px',
        'color:var(--text-dim)',
        'text-align:center',
        'max-width:80px',
        'line-height:1.3',
        'letter-spacing:0.04em',
        'text-transform:uppercase'
      ].join(';');
      hint.textContent = 'Clear all 4 stages';
      wrap.appendChild(hint);
    }

    return wrap;
  }

  function buildNodeIconStyle(meta, nodeState, isBoss) {
    var base = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:' + (isBoss ? '20px' : '14px'),
      'font-size:' + (isBoss ? '2.2rem' : '1.9rem'),
      'transition:transform 140ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 240ms ease',
      'cursor:' + (nodeState === 'locked' ? 'not-allowed' : 'pointer'),
      'width:' + (isBoss ? '88px' : '72px'),
      'height:' + (isBoss ? '88px' : '72px'),
      'user-select:none',
      '-webkit-tap-highlight-color:transparent'
    ];

    if (nodeState === 'cleared') {
      base.push(
        'background:rgba(255,215,0,0.12)',
        'border:2px solid var(--gold)',
        'box-shadow:var(--shadow-gold),inset 0 0 12px rgba(255,215,0,0.15)'
      );
    } else if (nodeState === 'locked') {
      base.push(
        'background:var(--bg-surface2)',
        'border:2px solid rgba(168,85,247,0.15)',
        'filter:grayscale(70%) brightness(0.55)'
      );
    } else if (isBoss) {
      base.push(
        'background:rgba(255,107,107,0.14)',
        'border:2px solid var(--coral)',
        'box-shadow:var(--shadow-coral),inset 0 0 16px rgba(255,107,107,0.2)',
        'animation:boss-node-pulse 2.5s ease-in-out infinite'
      );
    } else {
      base.push(
        'background:var(--bg-surface2)',
        'border:2px solid ' + meta.color,
        'box-shadow:0 0 12px ' + meta.color + '55'
      );
    }

    return base.join(';');
  }

  // ─── Customizer panel / modal ──────────────────────────────────────────────

  function openCustomizerPanel(rootEl) {
    // Guard: close any existing panel
    var existing = rootEl.querySelector('.wm-customizer-overlay');
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.className = 'wm-customizer-overlay overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Companion Customizer');
    overlay.style.cssText = 'z-index:300;';

    var card = document.createElement('div');
    card.className = 'overlay__card';
    card.style.cssText = 'max-width:360px;width:100%;';

    var header = document.createElement('h2');
    header.className = 'heading-gradient text-2xl text-center mb-4';
    header.textContent = 'Customize Companion';
    card.appendChild(header);

    var custEl = document.createElement('div');
    custEl.style.cssText = 'min-height:120px;';
    card.appendChild(custEl);

    // Let companion-system render the customizer into custEl
    if (CQ.companion && typeof CQ.companion.openCustomizer === 'function') {
      try {
        CQ.companion.openCustomizer(custEl);
      } catch (e) {
        console.error('[world-map] companion.openCustomizer threw:', e);
        custEl.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px;">Customizer unavailable</p>';
      }
    } else {
      custEl.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px;">Companion system loading...</p>';
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--ghost btn--block mt-4';
    closeBtn.textContent = 'Done';
    closeBtn.addEventListener('pointerdown', function () { overlay.remove(); });
    card.appendChild(closeBtn);

    overlay.appendChild(card);

    // Close on backdrop click (not on card itself)
    overlay.addEventListener('pointerdown', function (e) {
      if (e.target === overlay) { overlay.remove(); }
    });

    rootEl.appendChild(overlay);

    // Focus the close button for keyboard accessibility
    setTimeout(function () { closeBtn.focus(); }, 50);
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  var _unsubscribe = null;

  function render(rootEl) {
    rootEl.innerHTML = '';
    rootEl.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;padding:0 0 var(--sp-12);';

    var inner = document.createElement('div');
    inner.className = 'screen__inner';
    inner.style.cssText = 'display:flex;flex-direction:column;gap:var(--sp-4);';

    // ── Top bar: event banner + companion strip ──────────────────────────────
    var topBar = document.createElement('div');
    topBar.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:var(--sp-3)',
      'flex-wrap:wrap'
    ].join(';');

    // Event banner
    var eventName = CQ.state.eventName || 'Your Event';
    var banner = document.createElement('div');
    banner.style.cssText = [
      'flex:1',
      'min-width:0',
      'background:var(--bg-surface)',
      'border:1px solid rgba(168,85,247,0.25)',
      'border-radius:var(--r-md)',
      'padding:var(--sp-2) var(--sp-4)',
      'display:flex',
      'flex-direction:column',
      'gap:2px'
    ].join(';');

    var bannerLabel = document.createElement('span');
    bannerLabel.style.cssText = 'font-size:var(--text-xs);color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;';
    bannerLabel.textContent = 'Training for';
    banner.appendChild(bannerLabel);

    var bannerEvent = document.createElement('span');
    bannerEvent.className = 'font-display font-bold text-amber';
    bannerEvent.style.cssText = 'font-size:var(--text-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    bannerEvent.textContent = eventName;
    bannerEvent.title = eventName;
    banner.appendChild(bannerEvent);

    topBar.appendChild(banner);

    // Companion portrait + customizer button
    var companionStrip = document.createElement('div');
    companionStrip.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'gap:var(--sp-1)',
      'flex-shrink:0'
    ].join(';');

    var companionEl = document.createElement('div');
    companionEl.className = 'companion';
    companionEl.setAttribute('aria-label', 'Companion');
    companionEl.style.cssText = 'width:56px;height:56px;';

    if (CQ.companion && typeof CQ.companion.render === 'function') {
      try {
        CQ.companion.render(companionEl);
      } catch (e) {
        console.error('[world-map] companion.render threw:', e);
        companionEl.textContent = '🤖';
        companionEl.style.fontSize = '2rem';
      }
    } else {
      companionEl.textContent = '🤖';
      companionEl.style.cssText += 'font-size:2rem;display:flex;align-items:center;justify-content:center;';
    }
    companionStrip.appendChild(companionEl);

    var custBtn = document.createElement('button');
    custBtn.className = 'btn btn--ghost btn--sm';
    custBtn.setAttribute('aria-label', 'Customize companion');
    custBtn.style.cssText = 'font-size:var(--text-xs);padding:4px 10px;min-height:28px;';
    custBtn.textContent = 'Customize';
    custBtn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      openCustomizerPanel(rootEl);
    });
    companionStrip.appendChild(custBtn);

    topBar.appendChild(companionStrip);
    inner.appendChild(topBar);

    // ── Map title ────────────────────────────────────────────────────────────
    var mapTitle = document.createElement('h1');
    mapTitle.className = 'heading-gradient text-2xl text-center';
    mapTitle.textContent = 'Confidence Quest Map';
    inner.appendChild(mapTitle);

    // ── Progress indicator (X / 4 training stages cleared) ──────────────────
    var clearedCount = TRAINING_NODES.filter(function (id) {
      return CQ.state.nodes[id] === true;
    }).length;
    var bossCleared  = CQ.state.nodes['boss-battle'] === true;

    var progressRow = document.createElement('div');
    progressRow.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:var(--sp-3);flex-wrap:wrap;';

    var pip = function (filled, color, label) {
      var d = document.createElement('div');
      d.setAttribute('aria-label', label);
      d.style.cssText = [
        'width:12px',
        'height:12px',
        'border-radius:50%',
        'background:' + (filled ? color : 'rgba(255,255,255,0.12)'),
        'box-shadow:' + (filled ? '0 0 8px ' + color : 'none'),
        'transition:background 0.3s,box-shadow 0.3s'
      ].join(';');
      return d;
    };

    var pipColors = ['#00C9B1', '#F5A623', '#A855F7', '#FFD700'];
    TRAINING_NODES.forEach(function (id, i) {
      progressRow.appendChild(pip(CQ.state.nodes[id], pipColors[i], NODE_META[id].label));
    });

    var pipSep = document.createElement('span');
    pipSep.style.cssText = 'color:var(--text-dim);font-size:var(--text-xs);';
    pipSep.textContent = '→';
    progressRow.appendChild(pipSep);

    progressRow.appendChild(pip(bossCleared, '#FF6B6B', 'Boss Battle'));

    var pipLabel = document.createElement('span');
    pipLabel.style.cssText = 'font-size:var(--text-xs);color:var(--text-secondary);letter-spacing:0.06em;';
    pipLabel.textContent = clearedCount + ' / 4 stages cleared';
    progressRow.appendChild(pipLabel);

    inner.appendChild(progressRow);

    // ── Level map canvas ─────────────────────────────────────────────────────
    var mapWrap = document.createElement('div');
    mapWrap.style.cssText = [
      'position:relative',
      'width:100%',
      'max-width:340px',
      'margin:0 auto',
      // Maintain a 340:560 aspect ratio (the SVG viewBox)
      'aspect-ratio:340/560',
      'background:linear-gradient(170deg,rgba(45,30,110,0.7) 0%,rgba(26,16,64,0.9) 100%)',
      'border-radius:var(--r-xl)',
      'border:1px solid rgba(168,85,247,0.22)',
      'box-shadow:var(--shadow-card)',
      'overflow:hidden'
    ].join(';');

    // SVG background path
    var pathResult = buildPathSVG();
    mapWrap.appendChild(pathResult.svgEl);

    // Node buttons
    var SVG_W = 340;
    var SVG_H = 560;

    ALL_NODES.forEach(function (id, idx) {
      var pos    = pathResult.positions[idx];
      var nodeEl = buildNodeEl(id, pos, SVG_W, SVG_H);

      if (getNodeState(id) !== 'locked') {
        nodeEl.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          if (CQ.fx && typeof CQ.fx.playCue === 'function') {
            try { CQ.fx.playCue('click'); } catch (_) {}
          }
          nodeEl.querySelector('.map-node__icon').style.transform = 'scale(0.92)';
          setTimeout(function () {
            nodeEl.querySelector('.map-node__icon').style.transform = '';
            if (CQ.app && typeof CQ.app.showScreen === 'function') {
              CQ.app.showScreen(id);
            } else {
              console.error('[world-map] CQ.app.showScreen is not available.');
            }
          }, 130);
        });

        nodeEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (CQ.app && typeof CQ.app.showScreen === 'function') {
              CQ.app.showScreen(id);
            }
          }
        });
      }

      mapWrap.appendChild(nodeEl);
    });

    inner.appendChild(mapWrap);

    // ── Bottom actions ────────────────────────────────────────────────────────
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:var(--sp-3);justify-content:center;flex-wrap:wrap;';

    var dashBtn = document.createElement('button');
    dashBtn.className = 'btn btn--secondary';
    dashBtn.setAttribute('aria-label', 'View dashboard');
    dashBtn.innerHTML = '<span aria-hidden="true">📊</span> Dashboard';
    dashBtn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (CQ.app && typeof CQ.app.showScreen === 'function') {
        CQ.app.showScreen('dashboard');
      } else {
        console.error('[world-map] CQ.app.showScreen is not available.');
      }
    });
    actions.appendChild(dashBtn);

    // Show confidence stat badge
    var stat = typeof CQ.state.stat === 'number' ? CQ.state.stat : 0;
    var statBadge = document.createElement('div');
    statBadge.className = 'badge badge--gold';
    statBadge.setAttribute('aria-label', 'Confidence stat: ' + stat + ' percent');
    statBadge.innerHTML = '<span aria-hidden="true">⭐</span> ' + stat + '% Confidence';
    actions.appendChild(statBadge);

    inner.appendChild(actions);

    rootEl.appendChild(inner);
  }

  // ─── Screen registration ───────────────────────────────────────────────────

  CQ.screens['world-map'] = {
    mount: function (rootEl) {
      render(rootEl);

      // Re-render on any state change (cleared nodes, level-up, companion change)
      _unsubscribe = CQ.state.subscribe(function () {
        render(rootEl);
      });
    },

    unmount: function () {
      if (typeof _unsubscribe === 'function') {
        _unsubscribe();
        _unsubscribe = null;
      }
    }
  };

}());

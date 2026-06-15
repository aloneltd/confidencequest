// Brick: dashboard | Stud: CQ.state (nodes, stat, eventName, badges, archetype) + CQ.companion.render | Socket: js/dashboard.js — defines CQ.dashboard + registers CQ.screens["dashboard"]

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ─── Node metadata ────────────────────────────────────────────────────────
  var NODE_META = [
    { id: 'breathe-runner',  label: 'Breathe Runner',  icon: '🌬️', desc: 'Calm your nervous system' },
    { id: 'thought-buster',  label: 'Thought Buster',  icon: '💭', desc: 'Reframe anxious thoughts'   },
    { id: 'power-up-lab',    label: 'Power-Up Lab',    icon: '⚡', desc: 'Name your strengths'        },
    { id: 'star-forge',      label: 'Star Forge',      icon: '⭐', desc: 'Craft your STAR story'      },
    { id: 'boss-battle',     label: 'Boss Battle',     icon: '⚔️', desc: 'Face your inner critic'     }
  ];

  // Archetype → warm readiness takeaways (shown when stat === 100)
  var READY_TAKEAWAYS = {
    interrogator: [
      'You have a real STAR story ready — lead with evidence, not vague claims.',
      'Pause and breathe before each answer; confidence lives in the pause.',
      'You know your strengths. Name them without apology.',
      'A gap in your resume is part of your story, not a verdict.',
      'Treat every question as a conversation, not a test.'
    ],
    critic: [
      'Open with a hook, not a disclaimer — you earned this room.',
      'Nervous energy is excitement. Channel it into presence.',
      'Silence is a tool. A two-second pause signals control.',
      'The audience is rooting for you — they want this to go well.',
      'You know your material. Trust the preparation you did here.'
    ],
    gatekeeper: [
      'Lead with "I feel" and "I notice" — stay in your own experience.',
      'You can listen fully without agreeing. Understanding is not surrender.',
      'A pause mid-conversation is maturity, not weakness.',
      'You are not responsible for their reaction, only for how you show up.',
      'Honest and kind can live in the same sentence — you proved that here.'
    ],
    unknown: [
      'Your job is to be curious about them, not to perform perfection.',
      'Silence is space. Comfortable pauses are a good sign.',
      'Being genuinely yourself gives this the best possible chance.',
      'Ask one real question you actually want the answer to.',
      'Lighten up and let yourself enjoy this — that is attractive.'
    ]
  };

  // ─── computeStat ─────────────────────────────────────────────────────────
  // Returns 0..100 mirroring CQ.state.stat (derived from cleared nodes).
  function computeStat() {
    return (CQ.state && typeof CQ.state.stat === 'number') ? CQ.state.stat : 0;
  }

  // ─── renderBar ────────────────────────────────────────────────────────────
  // Render / update the compact Confidence Stat bar into headerEl.
  // Safe to call multiple times — idem-potent, updates in place.
  var _headerEl  = null;
  var _barWrap   = null;
  var _barFill   = null;
  var _pctSpan   = null;
  var _barUnsub  = null;

  function renderBar(headerEl) {
    if (!headerEl) { return; }

    // Build the DOM once; subsequent calls just update values.
    if (!_barWrap || !headerEl.contains(_barWrap)) {
      _barWrap = document.createElement('div');
      _barWrap.className = 'stat-bar-wrap';
      _barWrap.setAttribute('aria-label', 'Confidence Stat');

      var label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = 'Confidence';

      var barTrack = document.createElement('div');
      barTrack.className = 'stat-bar';
      barTrack.setAttribute('role', 'progressbar');
      barTrack.setAttribute('aria-valuemin', '0');
      barTrack.setAttribute('aria-valuemax', '100');

      _barFill = document.createElement('div');
      _barFill.className = 'stat-bar__fill';

      barTrack.appendChild(_barFill);

      _pctSpan = document.createElement('span');
      _pctSpan.className = 'stat-pct';

      _barWrap.appendChild(label);
      _barWrap.appendChild(barTrack);
      _barWrap.appendChild(_pctSpan);

      headerEl.appendChild(_barWrap);
      _headerEl = headerEl;

      // Subscribe to state changes for live animation.
      if (_barUnsub) { _barUnsub(); }
      if (CQ.state && typeof CQ.state.subscribe === 'function') {
        _barUnsub = CQ.state.subscribe(function () {
          _updateBar();
        });
      }
    }

    _updateBar();
  }

  function _updateBar() {
    if (!_barFill || !_pctSpan) { return; }
    var pct = computeStat();
    _barFill.style.width = pct + '%';
    _pctSpan.textContent = pct + '%';

    // Aria
    var track = _barFill.parentElement;
    if (track) { track.setAttribute('aria-valuenow', pct); }

    // Shimmer when complete
    if (pct >= 100) {
      _barFill.classList.add('stat-bar__fill--complete');
    } else {
      _barFill.classList.remove('stat-bar__fill--complete');
    }
  }

  // ─── Expose CQ.dashboard ─────────────────────────────────────────────────
  CQ.dashboard = {
    computeStat: computeStat,
    renderBar: renderBar
  };

  // ─── Screen: dashboard ────────────────────────────────────────────────────
  var _rootEl   = null;
  var _unsub    = null;

  function _safeEventName() {
    var name = (CQ.state && CQ.state.eventName) ? CQ.state.eventName.trim() : '';
    return name || 'your upcoming event';
  }

  function _safeBadges() {
    return (CQ.state && Array.isArray(CQ.state.badges)) ? CQ.state.badges : [];
  }

  function _safeNodes() {
    return (CQ.state && CQ.state.nodes) ? CQ.state.nodes : {};
  }

  function _safeArchetype() {
    return (CQ.state && CQ.state.archetype) ? CQ.state.archetype : 'unknown';
  }

  function _safeUnlocks() {
    var u = (CQ.state && CQ.state.unlocks) ? CQ.state.unlocks : {};
    var total = 0;
    if (Array.isArray(u.bodies))      { total += u.bodies.length; }
    if (Array.isArray(u.colors))      { total += u.colors.length; }
    if (Array.isArray(u.accessories)) { total += u.accessories.length; }
    return total;
  }

  // Build the full dashboard HTML and inject into rootEl.
  function _render(rootEl) {
    if (!rootEl) { return; }

    var stat       = computeStat();
    var eventName  = _safeEventName();
    var badges     = _safeBadges();
    var nodes      = _safeNodes();
    var archetype  = _safeArchetype();
    var unlockCnt  = _safeUnlocks();
    var isReady    = stat >= 100;

    rootEl.innerHTML = '';

    var inner = document.createElement('div');
    inner.className = 'screen__inner';

    // ── Hero heading ──────────────────────────────────────────────────────
    var hero = document.createElement('div');
    hero.className = 'text-center';

    var heading = document.createElement('h1');
    heading.className = 'heading-gradient text-3xl font-display';
    heading.textContent = isReady ? 'You\'re Ready.' : 'Your Progress';
    hero.appendChild(heading);

    var subheading = document.createElement('p');
    subheading.className = 'text-secondary text-sm mt-2';
    subheading.textContent = 'Preparing for: ' + eventName;
    hero.appendChild(subheading);

    inner.appendChild(hero);

    // ── Big Confidence Stat bar ───────────────────────────────────────────
    var statCard = document.createElement('div');
    statCard.className = isReady ? 'card card--glow-gold' : 'card';

    var statLabel = document.createElement('div');
    statLabel.className = 'flex items-center justify-between mb-4';

    var statTitle = document.createElement('span');
    statTitle.className = 'text-sm tracking-wider uppercase text-secondary font-bold';
    statTitle.textContent = 'Confidence Stat';

    var statPct = document.createElement('span');
    statPct.className = 'text-2xl font-display font-bold text-gold';
    statPct.id = 'dash-stat-pct';
    statPct.textContent = stat + '%';

    statLabel.appendChild(statTitle);
    statLabel.appendChild(statPct);
    statCard.appendChild(statLabel);

    var bigBarTrack = document.createElement('div');
    bigBarTrack.className = 'stat-bar stat-bar--lg';
    bigBarTrack.setAttribute('role', 'progressbar');
    bigBarTrack.setAttribute('aria-valuemin', '0');
    bigBarTrack.setAttribute('aria-valuemax', '100');
    bigBarTrack.setAttribute('aria-valuenow', stat);
    bigBarTrack.setAttribute('aria-label', 'Confidence Stat ' + stat + '%');

    var bigBarFill = document.createElement('div');
    bigBarFill.className = 'stat-bar__fill' + (isReady ? ' stat-bar__fill--complete' : '');
    bigBarFill.id = 'dash-stat-fill';
    // Animate fill on next frame so CSS transition fires.
    bigBarFill.style.width = '0%';
    bigBarTrack.appendChild(bigBarFill);
    statCard.appendChild(bigBarTrack);

    // Animate after paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bigBarFill.style.width = stat + '%';
      });
    });

    inner.appendChild(statCard);

    // ── Companion ─────────────────────────────────────────────────────────
    var companionCard = document.createElement('div');
    companionCard.className = 'card text-center';

    var companionTitle = document.createElement('p');
    companionTitle.className = 'text-xs tracking-wider uppercase text-secondary mb-4';
    companionTitle.textContent = 'Your Companion';
    companionCard.appendChild(companionTitle);

    var companionEl = document.createElement('div');
    companionEl.className = 'flex justify-center';
    companionCard.appendChild(companionEl);

    if (CQ.companion && typeof CQ.companion.render === 'function') {
      try {
        CQ.companion.render(companionEl);
      } catch (e) {
        console.error('[CQ.dashboard] companion.render failed:', e);
        companionEl.innerHTML = '<div style="font-size:3rem;line-height:1;">🌟</div>';
      }
    } else {
      companionEl.innerHTML = '<div style="font-size:3rem;line-height:1;">🌟</div>';
    }

    inner.appendChild(companionCard);

    // ── Badges ────────────────────────────────────────────────────────────
    var badgesCard = document.createElement('div');
    badgesCard.className = 'card';

    var badgesHeader = document.createElement('div');
    badgesHeader.className = 'flex items-center justify-between mb-3';

    var badgesTitle = document.createElement('span');
    badgesTitle.className = 'text-sm tracking-wider uppercase text-secondary font-bold';
    badgesTitle.textContent = 'Badges Earned';

    var badgesCount = document.createElement('span');
    badgesCount.className = 'badge badge--gold';
    badgesCount.textContent = badges.length + ' badge' + (badges.length === 1 ? '' : 's');

    badgesHeader.appendChild(badgesTitle);
    badgesHeader.appendChild(badgesCount);
    badgesCard.appendChild(badgesHeader);

    if (badges.length > 0) {
      var badgeRow = document.createElement('div');
      badgeRow.className = 'badge-row';
      badges.forEach(function (b) {
        var chip = document.createElement('span');
        chip.className = 'badge';
        chip.textContent = b;
        badgeRow.appendChild(chip);
      });
      badgesCard.appendChild(badgeRow);
    } else {
      var noBadges = document.createElement('p');
      noBadges.className = 'text-dim text-sm';
      noBadges.textContent = 'Complete training nodes to earn badges.';
      badgesCard.appendChild(noBadges);
    }

    if (unlockCnt > 0) {
      var unlockLine = document.createElement('p');
      unlockLine.className = 'text-xs text-secondary mt-3';
      unlockLine.textContent = unlockCnt + ' companion unlock' + (unlockCnt === 1 ? '' : 's') + ' collected.';
      badgesCard.appendChild(unlockLine);
    }

    inner.appendChild(badgesCard);

    // ── Node checklist (DoD-3: persisted state) ───────────────────────────
    var checklistCard = document.createElement('div');
    checklistCard.className = 'card';

    var checklistTitle = document.createElement('p');
    checklistTitle.className = 'text-sm tracking-wider uppercase text-secondary font-bold mb-4';
    checklistTitle.textContent = 'Training Checklist';
    checklistCard.appendChild(checklistTitle);

    var checkList = document.createElement('ul');
    checkList.className = 'flex-col gap-3';
    checkList.style.display = 'flex';

    NODE_META.forEach(function (node) {
      var cleared = !!nodes[node.id];

      var item = document.createElement('li');
      item.className = 'flex items-center gap-3';

      var iconWrap = document.createElement('span');
      iconWrap.style.fontSize = '1.5rem';
      iconWrap.style.lineHeight = '1';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.textContent = node.icon;

      var checkMark = document.createElement('span');
      checkMark.style.flexShrink = '0';
      checkMark.style.width = '22px';
      checkMark.style.height = '22px';
      checkMark.style.borderRadius = '50%';
      checkMark.style.border = cleared
        ? '2px solid var(--gold)'
        : '2px solid rgba(168, 85, 247, 0.35)';
      checkMark.style.background = cleared
        ? 'rgba(255, 215, 0, 0.18)'
        : 'transparent';
      checkMark.style.display = 'inline-flex';
      checkMark.style.alignItems = 'center';
      checkMark.style.justifyContent = 'center';
      checkMark.style.transition = 'all 0.24s ease-out';
      checkMark.innerHTML = cleared
        ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 6l3 3 5-5" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';

      var textWrap = document.createElement('span');
      textWrap.className = 'flex-col';
      textWrap.style.display = 'flex';

      var nodeName = document.createElement('span');
      nodeName.className = 'text-sm font-bold';
      nodeName.style.color = cleared ? 'var(--gold)' : 'var(--text-secondary)';
      nodeName.textContent = node.label;

      var nodeDesc = document.createElement('span');
      nodeDesc.className = 'text-xs text-dim';
      nodeDesc.textContent = cleared ? 'Complete' : node.desc;

      textWrap.appendChild(nodeName);
      textWrap.appendChild(nodeDesc);

      item.appendChild(checkMark);
      item.appendChild(iconWrap);
      item.appendChild(textWrap);
      checkList.appendChild(item);
    });

    checklistCard.appendChild(checkList);
    inner.appendChild(checklistCard);

    // ── Readiness Recap (only at 100%) ────────────────────────────────────
    if (isReady) {
      var recapCard = document.createElement('div');
      recapCard.className = 'card card--glow-teal';

      var recapHeading = document.createElement('h2');
      recapHeading.className = 'heading-gradient text-2xl font-display mb-2';
      recapHeading.textContent = 'You\'re ready for ' + eventName + '.';
      recapCard.appendChild(recapHeading);

      var recapIntro = document.createElement('p');
      recapIntro.className = 'text-secondary text-sm mb-4';
      recapIntro.textContent = 'Here\'s what you\'ve built. Carry these into the room with you:';
      recapCard.appendChild(recapIntro);

      var takeaways = READY_TAKEAWAYS[archetype] || READY_TAKEAWAYS['unknown'];

      var takeawayList = document.createElement('ul');
      takeawayList.className = 'flex-col gap-3';
      takeawayList.style.display = 'flex';

      takeaways.forEach(function (line) {
        var li = document.createElement('li');
        li.className = 'flex gap-3 items-start';
        li.style.padding = '0.5rem 0';
        li.style.borderBottom = '1px solid rgba(168, 85, 247, 0.12)';

        var dot = document.createElement('span');
        dot.style.color = 'var(--teal)';
        dot.style.fontWeight = '700';
        dot.style.flexShrink = '0';
        dot.style.marginTop = '1px';
        dot.textContent = '→';

        var text = document.createElement('span');
        text.className = 'text-primary text-sm';
        text.style.lineHeight = 'var(--leading-normal)';
        text.textContent = line;

        li.appendChild(dot);
        li.appendChild(text);
        takeawayList.appendChild(li);
      });

      recapCard.appendChild(takeawayList);

      var recapNote = document.createElement('p');
      recapNote.className = 'text-dim text-xs mt-4';
      recapNote.textContent = 'You did the work. Now go be who you practiced being.';
      recapCard.appendChild(recapNote);

      inner.appendChild(recapCard);
    }

    // ── Action buttons ────────────────────────────────────────────────────
    var btnRow = document.createElement('div');
    btnRow.className = 'flex-col gap-3';
    btnRow.style.display = 'flex';

    var mapBtn = document.createElement('button');
    mapBtn.type = 'button';
    mapBtn.className = 'btn btn--secondary btn--block';
    mapBtn.textContent = isReady ? 'Back to World Map' : 'Keep Training';
    mapBtn.addEventListener('pointerdown', function () {
      if (CQ.app && typeof CQ.app.showScreen === 'function') {
        CQ.app.showScreen('world-map');
      }
    });
    btnRow.appendChild(mapBtn);

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'btn btn--ghost btn--sm btn--block';
    resetBtn.textContent = 'Start Over';
    resetBtn.setAttribute('aria-label', 'Reset all progress and start over');
    resetBtn.addEventListener('pointerdown', function () {
      if (!window.confirm('This will erase all your progress. Are you sure?')) { return; }
      if (CQ.state && typeof CQ.state.reset === 'function') {
        CQ.state.reset();
      }
      if (CQ.app && typeof CQ.app.showScreen === 'function') {
        CQ.app.showScreen('intake');
      }
    });
    btnRow.appendChild(resetBtn);

    inner.appendChild(btnRow);
    rootEl.appendChild(inner);
  }

  // ─── Screen registration ──────────────────────────────────────────────────
  CQ.screens['dashboard'] = {
    mount: function (rootEl) {
      _rootEl = rootEl;
      _render(rootEl);

      // Subscribe to state changes and re-render on any mutation.
      if (_unsub) { _unsub(); }
      if (CQ.state && typeof CQ.state.subscribe === 'function') {
        _unsub = CQ.state.subscribe(function () {
          if (_rootEl) { _render(_rootEl); }
        });
      }
    },

    unmount: function () {
      if (_unsub) {
        _unsub();
        _unsub = null;
      }
      _rootEl = null;
    }
  };

}());

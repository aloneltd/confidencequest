// Brick: star-forge | Stud: CQ.state, CQ.fx, CQ.content.starPrompts | Socket: CQ.screens["star-forge"]
// Behavioral-interview trainer — player sorts shuffled STAR beats into S→T→A→R order
// to "forge" a Courage weapon, with optional typed answers for real-world practice.
// After 3 correct rounds: clearNode + levelUp + showScreen("world-map").

window.CQ = window.CQ || {};

(function () {
  'use strict';

  // ── Inline fallback content (guards against content.json missing starPrompts) ──
  var FALLBACK_PROMPTS = [
    {
      prompt: 'Tell me about a time you solved a problem under pressure.',
      beats: {
        S: 'Describe the specific situation: where you were, what the context was, and what was at stake.',
        T: 'Name your actual task or responsibility in that moment. What were YOU specifically accountable for?',
        A: 'Walk through the concrete steps YOU took. Use "I" not "we". Show your thinking and decisions.',
        R: 'State the outcome with specifics if you have them. What changed as a result of your action?'
      }
    },
    {
      prompt: 'Describe a time you had to work with someone difficult or navigate a conflict.',
      beats: {
        S: 'Set the scene: the role, the relationship, and why the difficulty mattered.',
        T: 'Clarify what you were responsible for achieving despite or through this conflict.',
        A: 'Describe what you actually did step by step — how you approached the person and what you tried.',
        R: 'Share how it resolved — relationship repaired, project completed, or lesson carried forward.'
      }
    },
    {
      prompt: 'Tell me about a time you took initiative or went beyond what was expected.',
      beats: {
        S: 'Describe the situation where you noticed something that wasn\'t being addressed.',
        T: 'Explain why you felt it was your place to act even when it wasn\'t explicitly your job.',
        A: 'Detail exactly what you did: who you talked to, what you built or proposed.',
        R: 'Describe the impact of your initiative. What changed, what was noticed?'
      }
    }
  ];

  // ── Constants ────────────────────────────────────────────────────────────────
  var ROUNDS_TO_WIN    = 3;
  var BEAT_ORDER       = ['S', 'T', 'A', 'R'];
  var BEAT_LABELS      = { S: 'Situation', T: 'Task', A: 'Action', R: 'Result' };
  var BEAT_COLORS      = {
    S: '#F5A623',   // amber
    T: '#00C9B1',   // teal
    A: '#A855F7',   // purple
    R: '#FFD700'    // gold
  };
  var FORGE_COLORS = ['#FFD700', '#F5A623', '#FF6B6B', '#00C9B1', '#A855F7'];

  // ── Module state (reset on each mount) ──────────────────────────────────────
  var _root         = null;       // section element
  var _canvas       = null;       // forge canvas for particle bursts
  var _ctx          = null;
  var _prompts      = [];         // array of prompt objects from content or fallback
  var _usedIndices  = [];         // which prompt indices have been used
  var _roundsWon    = 0;
  var _currentPrompt= null;       // { prompt, beats }
  var _shuffled     = [];         // [{ key:'S'|'T'|'A'|'R', text }] in shuffled order
  var _slots        = ['', '', '', ''];  // filled slot keys, '' = empty
  var _phase        = 'arrange';  // 'arrange' | 'bonus' | 'result'
  var _selectedTile = null;       // key of tapped tile awaiting slot placement
  var _animating    = false;      // prevent double-trigger during forge anim
  var _unsubscribe  = null;       // CQ.state subscriber cleanup

  // Drag state (pointer events)
  var _drag = {
    active:     false,
    key:        null,    // beat key being dragged
    el:         null,    // clone element
    startX:     0,
    startY:     0,
    offsetX:    0,
    offsetY:    0,
    originSlot: null     // 'tile' or slot index if dragging from a slot
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function safeGet(obj, path, fallback) {
    try {
      var parts = path.split('.');
      var cur = obj;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return fallback;
        cur = cur[parts[i]];
      }
      return (cur !== undefined && cur !== null) ? cur : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function getPrompts() {
    var fromContent = safeGet(window.CQ, 'content.starPrompts', null);
    if (Array.isArray(fromContent) && fromContent.length > 0) return fromContent;
    return FALLBACK_PROMPTS;
  }

  function pickNextPrompt() {
    if (_usedIndices.length >= _prompts.length) {
      _usedIndices = [];
    }
    var available = [];
    for (var i = 0; i < _prompts.length; i++) {
      if (_usedIndices.indexOf(i) === -1) available.push(i);
    }
    var idx = available[Math.floor(Math.random() * available.length)];
    _usedIndices.push(idx);
    return _prompts[idx];
  }

  function isSlotsCorrect() {
    for (var i = 0; i < BEAT_ORDER.length; i++) {
      if (_slots[i] !== BEAT_ORDER[i]) return false;
    }
    return true;
  }

  function isSlotsComplete() {
    return _slots.every(function (s) { return s !== ''; });
  }

  // ── DOM builders ─────────────────────────────────────────────────────────────

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') {
          node.className = attrs[k];
        } else if (k === 'style') {
          Object.keys(attrs[k]).forEach(function (sk) {
            node.style[sk] = attrs[k][sk];
          });
        } else if (k.startsWith('data-')) {
          node.setAttribute(k, attrs[k]);
        } else if (k === 'htmlFor') {
          node.htmlFor = attrs[k];
        } else {
          node[k] = attrs[k];
        }
      });
    }
    if (children) {
      if (typeof children === 'string') {
        node.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach(function (c) {
          if (c) node.appendChild(c);
        });
      } else {
        node.appendChild(children);
      }
    }
    return node;
  }

  function qs(selector, parent) {
    return (parent || _root).querySelector(selector);
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderTile(beatKey, isPlaced) {
    var color = BEAT_COLORS[beatKey];
    var tile = el('div', {
      className: 'sf-tile' + (isPlaced ? ' sf-tile--placed' : ''),
      'data-key': beatKey,
      role: 'button',
      tabIndex: '0',
      'aria-label': BEAT_LABELS[beatKey] + ' beat — ' + _currentPrompt.beats[beatKey],
      style: {
        '--tile-color': color
      }
    }, [
      el('div', { className: 'sf-tile__letter' }, beatKey),
      el('div', { className: 'sf-tile__label' }, BEAT_LABELS[beatKey]),
      el('div', { className: 'sf-tile__hint' }, _currentPrompt.beats[beatKey])
    ]);
    return tile;
  }

  function renderSlot(index) {
    var beatKey = BEAT_ORDER[index];
    var filledKey = _slots[index];
    var color = BEAT_COLORS[beatKey];
    var slot = el('div', {
      className: 'sf-slot' + (filledKey ? ' sf-slot--filled' : ''),
      'data-slot': String(index),
      'aria-label': 'Slot ' + (index + 1) + ' for ' + BEAT_LABELS[beatKey] + (filledKey ? ', filled with ' + BEAT_LABELS[filledKey] : ', empty'),
      role: 'button',
      tabIndex: '0',
      style: {
        '--slot-color': color
      }
    }, [
      el('div', { className: 'sf-slot__label' }, BEAT_LABELS[beatKey]),
      filledKey
        ? el('div', { className: 'sf-slot__filled-key', style: { color: BEAT_COLORS[filledKey] } }, filledKey)
        : el('div', { className: 'sf-slot__empty' }, String(index + 1))
    ]);
    return slot;
  }

  // ── Canvas overlay for particles ─────────────────────────────────────────────

  function ensureCanvas() {
    if (!_canvas) {
      _canvas = el('canvas', {
        className: 'sf-canvas',
        style: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: '999'
        }
      });
      document.body.appendChild(_canvas);
      resizeCanvas();
    }
    _ctx = _canvas.getContext('2d');
  }

  function resizeCanvas() {
    if (!_canvas) return;
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight;
  }

  function removeCanvas() {
    if (_canvas && _canvas.parentNode) {
      _canvas.parentNode.removeChild(_canvas);
    }
    _canvas = null;
    _ctx = null;
  }

  // ── Main render pipeline ─────────────────────────────────────────────────────

  function render() {
    if (!_root) return;
    _root.innerHTML = '';

    var inner = el('div', { className: 'screen__inner' });

    // Back button row
    var headerRow = el('div', {
      style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }
    }, [
      el('button', {
        className: 'btn btn--ghost btn--sm',
        'aria-label': 'Back to world map'
      }, 'Back')
    ]);
    headerRow.querySelector('button').addEventListener('pointerup', function () {
      safePlayCue('click');
      doBack();
    });

    // Progress pips
    var pips = el('div', { className: 'sf-pips', 'aria-label': 'Round progress' });
    for (var p = 0; p < ROUNDS_TO_WIN; p++) {
      pips.appendChild(el('div', {
        className: 'sf-pip' + (p < _roundsWon ? ' sf-pip--done' : '')
      }));
    }

    // Title & badge
    var titleRow = el('div', { style: { textAlign: 'center' } }, [
      el('div', { className: 'badge badge--amber', style: { display: 'inline-flex', marginBottom: '8px' } }, 'STAR Forge'),
      el('h2', { className: 'heading-gradient', style: { fontSize: 'var(--text-2xl)', marginBottom: '4px' } }, 'Interview Trainer'),
      el('p', { className: 'text-secondary text-sm', style: { marginBottom: '0' } },
        'Round ' + (_roundsWon + 1) + ' of ' + ROUNDS_TO_WIN
      )
    ]);

    // Teaching moment card (collapsible)
    var teaching = renderTeachingCard();

    // Prompt card
    var promptCard = el('div', { className: 'card card--glow-amber' }, [
      el('p', { className: 'text-xs text-secondary tracking-wider uppercase', style: { marginBottom: '6px' } }, 'Your prompt'),
      el('p', { className: 'text-lg', style: { fontWeight: '600', lineHeight: '1.45' } }, _currentPrompt.prompt)
    ]);

    // Arrange zone
    var arrangeSection;
    if (_phase === 'arrange') {
      arrangeSection = renderArrangePhase();
    } else if (_phase === 'bonus') {
      arrangeSection = renderBonusPhase();
    } else {
      arrangeSection = renderResultPhase();
    }

    inner.appendChild(headerRow);
    inner.appendChild(pips);
    inner.appendChild(titleRow);
    inner.appendChild(teaching);
    inner.appendChild(promptCard);
    inner.appendChild(arrangeSection);

    _root.appendChild(inner);

    // After DOM is in place, wire drag/tap events
    if (_phase === 'arrange') {
      wireDragAndTap();
    }
  }

  function renderTeachingCard() {
    var isOpen = false;
    var body = el('div', {
      id: 'sf-teaching-body',
      style: { display: 'none', marginTop: '12px' }
    }, [
      el('p', { className: 'text-sm', style: { marginBottom: '10px', color: 'var(--text-secondary)' } },
        'The STAR method gives your answer a story shape — interviewers remember stories, not facts.'
      ),
      renderBeatGuide('S', 'Situation', 'Set the scene. Where, when, what was at stake?'),
      renderBeatGuide('T', 'Task', 'Your specific responsibility. Not the team — YOU.'),
      renderBeatGuide('A', 'Action', 'What YOU did, step by step. This is most of your answer.'),
      renderBeatGuide('R', 'Result', 'What changed? Numbers help. Name what you learned.')
    ]);

    var toggle = el('button', {
      className: 'btn btn--ghost btn--sm',
      style: { width: '100%', justifyContent: 'space-between' },
      'aria-expanded': 'false',
      'aria-controls': 'sf-teaching-body'
    }, [
      el('span', {}, 'What is STAR?'),
      el('span', { className: 'sf-chevron' }, 'v')
    ]);

    toggle.addEventListener('click', function () {
      isOpen = !isOpen;
      body.style.display = isOpen ? 'block' : 'none';
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.querySelector('.sf-chevron').textContent = isOpen ? '^' : 'v';
    });

    return el('div', {
      className: 'card',
      style: { padding: '12px 16px' }
    }, [toggle, body]);
  }

  function renderBeatGuide(key, label, desc) {
    return el('div', {
      style: {
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        marginBottom: '8px'
      }
    }, [
      el('div', {
        style: {
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: BEAT_COLORS[key],
          color: key === 'R' ? '#1A1040' : '#1A1040',
          fontWeight: '800',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: '0'
        }
      }, key),
      el('div', {}, [
        el('div', { style: { fontWeight: '700', fontSize: '14px', color: BEAT_COLORS[key] } }, label),
        el('div', { style: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' } }, desc)
      ])
    ]);
  }

  function renderArrangePhase() {
    var section = el('div', { className: 'sf-arrange' });

    // Instruction
    section.appendChild(el('p', {
      className: 'text-sm text-secondary text-center',
      style: { marginBottom: '16px' }
    }, 'Drag (or tap-to-select then tap a slot) the beats into correct S → T → A → R order.'));

    // Tile bank
    var bank = el('div', { className: 'sf-tile-bank', id: 'sf-bank' });
    var tilesInBank = _shuffled.filter(function (b) {
      return _slots.indexOf(b.key) === -1;
    });
    tilesInBank.forEach(function (b) {
      bank.appendChild(renderTile(b.key, false));
    });
    section.appendChild(bank);

    // Arrow
    section.appendChild(el('div', {
      style: { textAlign: 'center', color: 'var(--text-dim)', fontSize: '20px', margin: '8px 0' }
    }, 'v'));

    // Slots row
    var slotsRow = el('div', { className: 'sf-slots', id: 'sf-slots' });
    for (var i = 0; i < 4; i++) {
      slotsRow.appendChild(renderSlot(i));
    }
    section.appendChild(slotsRow);

    // Check button (only visible if all slots filled)
    var checkBtn = el('button', {
      className: 'btn btn--primary btn--block',
      style: { marginTop: '20px' },
      disabled: !isSlotsComplete()
    }, 'Forge It!');
    checkBtn.addEventListener('pointerup', function () {
      if (!_animating) onCheckOrder();
    });
    section.appendChild(checkBtn);

    // Feedback message area
    section.appendChild(el('div', { id: 'sf-feedback', style: { minHeight: '48px' } }));

    return section;
  }

  function renderBonusPhase() {
    var section = el('div', {});

    // Success banner
    section.appendChild(el('div', {
      className: 'card card--glow-gold',
      style: { textAlign: 'center', padding: '20px' }
    }, [
      el('div', { style: { fontSize: '2.5rem', marginBottom: '8px' } }, 'FORGED!'),
      el('p', { className: 'text-sm text-secondary' },
        'You nailed the order. Now make it real — write your OWN answer below (bonus courage!) or skip ahead.'
      )
    ]));

    // Beat recap
    var recap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0' } });
    BEAT_ORDER.forEach(function (key) {
      recap.appendChild(el('div', {
        style: {
          borderLeft: '3px solid ' + BEAT_COLORS[key],
          paddingLeft: '12px'
        }
      }, [
        el('div', {
          style: { fontSize: '11px', fontWeight: '800', letterSpacing: '0.08em', color: BEAT_COLORS[key], textTransform: 'uppercase', marginBottom: '2px' }
        }, BEAT_LABELS[key]),
        el('div', { className: 'text-sm text-secondary', style: { lineHeight: '1.5' } }, _currentPrompt.beats[key])
      ]));
    });
    section.appendChild(recap);

    // Bonus textarea
    section.appendChild(el('label', {
      className: 'label',
      htmlFor: 'sf-bonus-text'
    }, 'Your real-life STAR answer (optional)'));

    var bonusTextarea = el('textarea', {
      id: 'sf-bonus-text',
      className: 'input',
      placeholder: 'Type your own S, T, A, R for your actual situation here...',
      style: {
        minHeight: '120px',
        resize: 'vertical',
        fontFamily: 'var(--font-body)',
        lineHeight: '1.55',
        marginBottom: '12px'
      },
      'aria-label': 'Your own STAR answer for bonus courage'
    });
    section.appendChild(bonusTextarea);

    // Buttons
    var btnRow = el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });

    var bonusBtn = el('button', {
      className: 'btn btn--gold',
      style: { flex: '1', minWidth: '140px' }
    }, 'Submit for +Courage');
    bonusBtn.addEventListener('pointerup', function () {
      var text = bonusTextarea.value.trim();
      if (text.length > 10) {
        safePlayCue('collect');
        bonusBtn.disabled = true;
        bonusBtn.textContent = 'Courage gained!';
        // Visual feedback
        var fb = qs('#sf-bonus-feedback');
        if (fb) {
          fb.textContent = 'Your story is getting sharper. Keep that answer — you may need it soon.';
          fb.style.color = 'var(--gold)';
        }
      } else {
        CQ.fx && CQ.fx.shake && CQ.fx.shake(bonusTextarea, 5);
        var fb2 = qs('#sf-bonus-feedback');
        if (fb2) fb2.textContent = 'Write at least a few words — your story matters!';
      }
    });

    var skipBtn = el('button', {
      className: 'btn btn--secondary',
      style: { flex: '1', minWidth: '120px' }
    }, 'Next Round');
    skipBtn.addEventListener('pointerup', function () {
      safePlayCue('click');
      advanceRound();
    });

    btnRow.appendChild(bonusBtn);
    btnRow.appendChild(skipBtn);
    section.appendChild(btnRow);
    section.appendChild(el('div', { id: 'sf-bonus-feedback', className: 'text-sm', style: { marginTop: '10px', minHeight: '24px' } }));

    return section;
  }

  function renderResultPhase() {
    // This renders the final win state before transitioning
    var section = el('div', { style: { textAlign: 'center' } }, [
      el('div', { style: { fontSize: '3rem', marginBottom: '8px' } }, 'WEAPON FORGED'),
      el('h2', { className: 'heading-gradient', style: { fontSize: 'var(--text-3xl)', marginBottom: '12px' } },
        'Courage Blade Unlocked!'
      ),
      el('p', { className: 'text-secondary', style: { marginBottom: '24px' } },
        'You can now answer behavioral interview questions with structure and confidence. Your STAR answers are your armor.'
      )
    ]);
    return section;
  }

  // ── Drag and tap wiring ───────────────────────────────────────────────────────

  function wireDragAndTap() {
    var bank  = qs('#sf-bank');
    var slots = qs('#sf-slots');
    if (!bank || !slots) return;

    // Attach pointer events to each tile in bank
    var tiles = bank.querySelectorAll('.sf-tile');
    tiles.forEach(function (tile) {
      wireTile(tile, 'bank');
    });

    // Attach pointer events to each slot
    var slotEls = slots.querySelectorAll('.sf-slot');
    slotEls.forEach(function (slotEl, idx) {
      // Slots with filled tiles can also be dragged back
      wireSlot(slotEl, idx);
    });

    // Pointer move and up are on document to handle dragging outside
    document.addEventListener('pointermove', onDragMove, { passive: false });
    document.addEventListener('pointerup',   onDragEnd,  { passive: true  });
    document.addEventListener('pointercancel', onDragEnd, { passive: true  });
  }

  function wireTile(tile, source) {
    var key = tile.getAttribute('data-key');

    tile.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      safePlayCue('click');

      // Tap-to-select mode: if no drag started within threshold, treat as tap
      _drag.active     = false;
      _drag.key        = key;
      _drag.el         = null;
      _drag.startX     = e.clientX;
      _drag.startY     = e.clientY;
      _drag.originSlot = source;
      _drag.tileEl     = tile;

      tile.setPointerCapture(e.pointerId);
    });

    tile.addEventListener('pointermove', function (e) {
      if (_drag.key !== key) return;
      var dx = e.clientX - _drag.startX;
      var dy = e.clientY - _drag.startY;
      if (!_drag.active && Math.sqrt(dx * dx + dy * dy) > 8) {
        startDragClone(tile, e);
      }
      if (_drag.active && _drag.el) {
        moveDragClone(e);
      }
    });

    tile.addEventListener('pointerup', function () {
      if (_drag.key !== key) return;
      if (!_drag.active) {
        // Pure tap: toggle selected
        onTileTap(key);
      }
      // drag end is handled by document listener
    });

    // Keyboard: Enter or Space to select/place
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTileTap(key);
      }
    });
  }

  function wireSlot(slotEl, idx) {
    // Tap-to-place if a tile is selected
    slotEl.addEventListener('pointerup', function () {
      if (_drag.active) return; // handled by drag end
      onSlotTap(idx);
    });

    slotEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSlotTap(idx);
      }
    });
  }

  // ── Drag clone helpers ────────────────────────────────────────────────────────

  function startDragClone(origTile, e) {
    _drag.active = true;

    var rect = origTile.getBoundingClientRect();
    _drag.offsetX = e.clientX - rect.left;
    _drag.offsetY = e.clientY - rect.top;

    var clone = origTile.cloneNode(true);
    clone.style.position   = 'fixed';
    clone.style.zIndex     = '1000';
    clone.style.width      = rect.width + 'px';
    clone.style.pointerEvents = 'none';
    clone.style.opacity    = '0.88';
    clone.style.transform  = 'scale(1.07) rotate(-2deg)';
    clone.style.boxShadow  = '0 12px 32px rgba(0,0,0,0.5)';
    clone.style.left       = (e.clientX - _drag.offsetX) + 'px';
    clone.style.top        = (e.clientY - _drag.offsetY) + 'px';
    document.body.appendChild(clone);
    _drag.el = clone;

    // Dim the source
    origTile.style.opacity = '0.35';
  }

  function moveDragClone(e) {
    if (!_drag.el) return;
    _drag.el.style.left = (e.clientX - _drag.offsetX) + 'px';
    _drag.el.style.top  = (e.clientY - _drag.offsetY) + 'px';

    // Highlight hovered slot
    var slots = document.querySelectorAll('.sf-slot');
    slots.forEach(function (s) { s.classList.remove('sf-slot--hover'); });
    var hovered = getSlotUnderPointer(e.clientX, e.clientY);
    if (hovered) hovered.classList.add('sf-slot--hover');
  }

  function onDragMove(e) {
    if (!_drag.key) return;
    if (!_drag.active) {
      var dx = e.clientX - _drag.startX;
      var dy = e.clientY - _drag.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 8 && _drag.tileEl) {
        startDragClone(_drag.tileEl, e);
      }
    }
    if (_drag.active && _drag.el) {
      moveDragClone(e);
    }
  }

  function onDragEnd(e) {
    if (!_drag.key) return;

    if (_drag.active) {
      // Remove clone
      if (_drag.el && _drag.el.parentNode) {
        _drag.el.parentNode.removeChild(_drag.el);
        _drag.el = null;
      }

      // Restore opacity on source tile
      var sourceTile = document.querySelector('.sf-tile[data-key="' + _drag.key + '"]') ||
                       (document.querySelector('.sf-slot--filled [data-key="' + _drag.key + '"]'));
      if (sourceTile) sourceTile.style.opacity = '';

      // Clear hover highlights
      document.querySelectorAll('.sf-slot--hover').forEach(function (s) {
        s.classList.remove('sf-slot--hover');
      });

      // Find which slot the pointer is over
      if (e) {
        var slot = getSlotUnderPointer(e.clientX, e.clientY);
        if (slot) {
          var slotIdx = parseInt(slot.getAttribute('data-slot'), 10);
          placeKeyInSlot(_drag.key, slotIdx);
        }
      }
    }

    // Clean up drag state
    _drag.active     = false;
    _drag.key        = null;
    _drag.tileEl     = null;
    _drag.originSlot = null;

    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup',   onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);

    // Re-wire after DOM re-render
    // (placeKeyInSlot calls render which re-wires)
  }

  function getSlotUnderPointer(x, y) {
    var slots = document.querySelectorAll('.sf-slot');
    for (var i = 0; i < slots.length; i++) {
      var r = slots[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return slots[i];
      }
    }
    return null;
  }

  // ── Tap-to-select / tap-to-place ─────────────────────────────────────────────

  function onTileTap(key) {
    if (_selectedTile === key) {
      // Deselect
      _selectedTile = null;
    } else {
      // Select this tile
      _selectedTile = key;
    }
    updateSelectionHighlight();
  }

  function onSlotTap(idx) {
    if (_selectedTile === null) {
      // Try to pick up the tile currently in this slot
      var occupant = _slots[idx];
      if (occupant) {
        _selectedTile = occupant;
        _slots[idx] = '';
        updateSelectionHighlight();
        render();
        wireDragAndTap();
      }
      return;
    }

    placeKeyInSlot(_selectedTile, idx);
    _selectedTile = null;
  }

  function updateSelectionHighlight() {
    var tiles = document.querySelectorAll('.sf-tile');
    tiles.forEach(function (t) {
      t.classList.toggle('sf-tile--selected', t.getAttribute('data-key') === _selectedTile);
    });
  }

  function placeKeyInSlot(key, idx) {
    // If another tile is in this slot, swap it back to bank
    var existing = _slots[idx];
    if (existing) {
      // existing returns to bank — just clear the slot, it's already not in bank
    }

    // Remove key from any other slot
    for (var i = 0; i < _slots.length; i++) {
      if (_slots[i] === key) { _slots[i] = ''; }
    }

    _slots[idx] = key;

    // Put existing tile back (clear its slot record)
    // (it's already out of _slots since we overwrote idx)

    safePlayCue('click');
    render();
    wireDragAndTap();

    // Auto-update the check button state
    var checkBtn = qs('.btn--primary');
    if (checkBtn) checkBtn.disabled = !isSlotsComplete();
  }

  // ── Game logic ────────────────────────────────────────────────────────────────

  function onCheckOrder() {
    if (_animating) return;

    if (!isSlotsComplete()) {
      showFeedback('Fill all four slots first — every beat matters!', false);
      return;
    }

    if (isSlotsCorrect()) {
      _animating = true;
      onCorrectOrder();
    } else {
      onWrongOrder();
    }
  }

  function onCorrectOrder() {
    safePlayCue('collect');
    fireForgeParticles();

    // Brief delay then switch to bonus phase
    window.setTimeout(function () {
      _animating = false;
      _phase = 'bonus';
      render();
    }, 900);
  }

  function onWrongOrder() {
    safePlayCue('zap');
    CQ.fx && CQ.fx.shake && CQ.fx.shake(qs('.sf-slots') || qs('.sf-arrange'), 6);
    showFeedback('Not quite — check the order: Situation first, then Task, then Action, then Result.', false);
    // Mark wrong slots with a brief flash
    markWrongSlots();
  }

  function markWrongSlots() {
    var slotEls = document.querySelectorAll('.sf-slot');
    slotEls.forEach(function (s, i) {
      if (_slots[i] && _slots[i] !== BEAT_ORDER[i]) {
        s.classList.add('sf-slot--wrong');
        window.setTimeout(function () { s.classList.remove('sf-slot--wrong'); }, 700);
      }
    });
  }

  function showFeedback(msg, isGood) {
    var fb = qs('#sf-feedback');
    if (!fb) return;
    fb.textContent = msg;
    fb.style.color = isGood ? 'var(--teal-light)' : 'var(--coral-light)';
    fb.style.padding = '8px 0';
    fb.style.fontSize = '14px';
  }

  function advanceRound() {
    _roundsWon++;

    if (_roundsWon >= ROUNDS_TO_WIN) {
      doWin();
    } else {
      // Next round
      _currentPrompt = pickNextPrompt();
      _slots         = ['', '', '', ''];
      _selectedTile  = null;
      _animating     = false;
      _phase         = 'arrange';
      _shuffled      = shuffle(BEAT_ORDER.map(function (k) {
        return { key: k, text: _currentPrompt.beats[k] };
      }));
      render();
      wireDragAndTap();
    }
  }

  function doWin() {
    _phase = 'result';
    render();
    safePlayCue('win');
    fireForgeParticles();
    fireForgeParticles(); // double burst for win

    window.setTimeout(function () {
      try {
        var _firstClear = CQ.state && CQ.state.nodes && !CQ.state.nodes['star-forge'];
        CQ.state.clearNode('star-forge');
        if (_firstClear) { CQ.companion.levelUp(); }
      } catch (e) { console.error('[star-forge] clearNode/levelUp failed', e); }
      window.setTimeout(function () {
        try { CQ.app.showScreen('world-map'); } catch (e) { console.error('[star-forge] showScreen failed', e); }
      }, 1400);
    }, 1800);
  }

  function doBack() {
    try { CQ.app.showScreen('world-map'); } catch (e) { console.error('[star-forge] back failed', e); }
  }

  // ── FX helpers ───────────────────────────────────────────────────────────────

  function safePlayCue(name) {
    try {
      if (CQ.fx && CQ.fx.playCue) CQ.fx.playCue(name);
    } catch (e) {}
  }

  function fireForgeParticles() {
    try {
      ensureCanvas();
      if (!_ctx) return;
      var cx = Math.round(_canvas.width * 0.5);
      var cy = Math.round(_canvas.height * 0.5);
      CQ.fx.particleBurst(_ctx, cx, cy, {
        count:  48,
        colors: FORGE_COLORS,
        spread: 200,
        life:   1100,
        radius: 6
      });
    } catch (e) {
      console.warn('[star-forge] particleBurst error (suppressed):', e && e.message);
    }
  }

  // ── CSS injection ─────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('sf-styles')) return;

    var css = [
      /* ── Layout ── */
      '.sf-pips{display:flex;gap:10px;justify-content:center;margin:0 0 8px;}',
      '.sf-pip{width:28px;height:6px;border-radius:99px;background:rgba(255,255,255,0.12);transition:background 0.3s;}',
      '.sf-pip--done{background:var(--gold);box-shadow:0 0 10px rgba(255,215,0,0.7);}',

      /* ── Tile bank ── */
      '.sf-tile-bank{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:4px;}',

      /* ── Tile ── */
      '.sf-tile{',
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:12px 16px;',
        'background:rgba(45,30,110,0.8);',
        'border:2px solid var(--tile-color,#A855F7);',
        'border-radius:12px;',
        'cursor:grab;',
        'user-select:none;',
        '-webkit-user-select:none;',
        'touch-action:none;',
        'transition:transform 0.15s,box-shadow 0.15s,opacity 0.2s,border-color 0.2s;',
        'min-width:72px;',
        'box-shadow:0 2px 12px rgba(0,0,0,0.35);',
      '}',
      '.sf-tile:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 6px 20px rgba(0,0,0,0.45);}',
      '.sf-tile:active{transform:scale(0.96);}',
      '.sf-tile:focus-visible{outline:3px solid var(--accent-glow);outline-offset:2px;}',
      '.sf-tile--selected{border-color:var(--gold);box-shadow:0 0 18px rgba(255,215,0,0.7),0 2px 12px rgba(0,0,0,0.35);transform:scale(1.06);}',
      '.sf-tile--placed{opacity:0.45;pointer-events:none;}',
      '.sf-tile__letter{font-size:22px;font-weight:800;color:var(--tile-color,#F0EAF8);font-family:var(--font-display);line-height:1;}',
      '.sf-tile__label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-secondary);}',
      '.sf-tile__hint{font-size:10px;color:var(--text-dim);max-width:110px;text-align:center;line-height:1.3;margin-top:2px;}',

      /* ── Slots ── */
      '.sf-slots{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}',
      '@media(max-width:480px){.sf-slots{grid-template-columns:repeat(2,1fr);}}',

      '.sf-slot{',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;',
        'min-height:72px;',
        'border:2px dashed rgba(168,85,247,0.35);',
        'border-radius:12px;',
        'background:rgba(26,16,64,0.6);',
        'cursor:pointer;',
        'transition:border-color 0.15s,background 0.15s,transform 0.15s;',
        'padding:10px 6px;',
        'user-select:none;',
        '-webkit-user-select:none;',
      '}',
      '.sf-slot:focus-visible{outline:3px solid var(--accent-glow);outline-offset:2px;}',
      '.sf-slot--hover{border-color:var(--teal);background:rgba(0,201,177,0.08);transform:scale(1.04);}',
      '.sf-slot--filled{border-style:solid;border-color:var(--slot-color,#A855F7);background:rgba(45,30,110,0.7);box-shadow:0 0 10px rgba(168,85,247,0.25);}',
      '.sf-slot--wrong{border-color:var(--coral)!important;animation:sf-wrong-flash 0.35s ease-in-out 2;}',
      '@keyframes sf-wrong-flash{0%,100%{background:rgba(26,16,64,0.6);}50%{background:rgba(255,107,107,0.18);}}',

      '.sf-slot__label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);}',
      '.sf-slot__empty{font-size:22px;color:rgba(255,255,255,0.15);font-weight:300;}',
      '.sf-slot__filled-key{font-size:26px;font-weight:900;font-family:var(--font-display);line-height:1;}',

      /* ── Arrange section ── */
      '.sf-arrange{display:flex;flex-direction:column;}',

      /* ── Chevron ── */
      '.sf-chevron{display:inline-block;font-style:normal;transition:transform 0.2s;}'
    ].join('');

    var style = document.createElement('style');
    style.id = 'sf-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Screen contract ───────────────────────────────────────────────────────────

  CQ.screens = CQ.screens || {};

  CQ.screens['star-forge'] = {

    mount: function (rootEl) {
      _root = rootEl;

      // Reset module state for a clean run
      _roundsWon    = 0;
      _usedIndices  = [];
      _slots        = ['', '', '', ''];
      _selectedTile = null;
      _animating    = false;
      _phase        = 'arrange';

      injectStyles();
      ensureCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Load prompts
      _prompts = getPrompts();

      // Pick first prompt and shuffle beats
      _currentPrompt = pickNextPrompt();
      _shuffled = shuffle(BEAT_ORDER.map(function (k) {
        return { key: k, text: _currentPrompt.beats[k] };
      }));

      render();
      wireDragAndTap();
    },

    unmount: function () {
      // Clean up global event listeners left by drag
      document.removeEventListener('pointermove', onDragMove);
      document.removeEventListener('pointerup',   onDragEnd);
      document.removeEventListener('pointercancel', onDragEnd);
      window.removeEventListener('resize', resizeCanvas);

      // Remove drag clone if still attached
      if (_drag.el && _drag.el.parentNode) {
        _drag.el.parentNode.removeChild(_drag.el);
        _drag.el = null;
      }
      _drag.active = false;
      _drag.key    = null;

      // Remove canvas overlay
      removeCanvas();

      if (_unsubscribe) {
        _unsubscribe();
        _unsubscribe = null;
      }

      _root = null;
    }
  };

}());

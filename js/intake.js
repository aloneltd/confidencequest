// Brick: intake-screen | Stud: js/game-state.js, data/content.json | Socket: js/intake.js
// First screen — player names their dread, free text is mapped to one of four archetypes,
// then eventName + archetype are written to CQ.state before advancing to the world-map.

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ─── Archetype keyword map ────────────────────────────────────────────────
  // Each entry: { archetype: string, terms: string[] }
  // Evaluated in declaration order; first match wins.
  var KEYWORD_RULES = [
    {
      archetype: 'interrogator',
      terms: [
        'interview', 'hiring', 'recruiter', 'job interview', 'tech screen',
        'phone screen', 'panel interview', 'behavioural', 'behavioral',
        'assessment centre', 'assessment center', 'aptitude test'
      ]
    },
    {
      archetype: 'critic',
      terms: [
        'presentation', 'present', 'pitch', 'talk', 'speech', 'keynote',
        'lecture', 'demo', 'seminar', 'webinar', 'toast', 'public speaking',
        'stand up', 'standup', 'ted', 'slide', 'slides'
      ]
    },
    {
      archetype: 'gatekeeper',
      terms: [
        'conversation', 'confront', 'confrontation', 'difficult conversation',
        'hard conversation', 'tough conversation', 'feedback', 'apology',
        'apologise', 'apologize', 'break up', 'breakup', 'negotiation',
        'negotiate', 'ask for raise', 'raise', 'promotion', 'complaint',
        'complain', 'tell them', 'talk to', 'speak to'
      ]
    },
    {
      archetype: 'unknown',
      terms: [
        'date', 'first date', 'dating', 'meet someone', 'blind date',
        'tinder', 'bumble', 'hinge', 'app date', 'coffee date', 'dinner date'
      ]
    }
  ];

  /**
   * mapEventToArchetype(text) — keyword match on normalized text.
   * Returns one of: "interrogator" | "critic" | "gatekeeper" | "unknown".
   * Defaults to "unknown" when no rule matches.
   * Exposed on CQ so it is testable.
   *
   * @param {string} text — raw player input
   * @returns {string}
   */
  function mapEventToArchetype(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      return 'unknown';
    }
    var normalized = text.toLowerCase();
    for (var i = 0; i < KEYWORD_RULES.length; i++) {
      var rule = KEYWORD_RULES[i];
      for (var j = 0; j < rule.terms.length; j++) {
        // Whole-word-ish check: the term appears as a substring in the
        // normalised text (sufficient for natural-language event names).
        if (normalized.indexOf(rule.terms[j]) !== -1) {
          return rule.archetype;
        }
      }
    }
    return 'unknown';
  }

  // Expose on CQ so other bricks and tests can call CQ.mapEventToArchetype(text)
  CQ.mapEventToArchetype = mapEventToArchetype;

  // ─── Example chips shown below the input ─────────────────────────────────
  var EXAMPLE_CHIPS = [
    { label: 'job interview',       icon: '💼' },
    { label: 'big presentation',    icon: '🎤' },
    { label: 'tough conversation',  icon: '💬' },
    { label: 'first date',          icon: '✨' }
  ];

  // ─── Internal state for the mounted screen ───────────────────────────────
  var _root     = null;   // the <section> rootEl passed to mount()
  var _inputEl  = null;   // the text <input>
  var _errorEl  = null;   // inline validation message element

  // ─── DOM builder helpers ─────────────────────────────────────────────────

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'className') {
          node.className = attrs[k];
        } else if (k === 'textContent') {
          node.textContent = attrs[k];
        } else if (k === 'htmlFor') {
          node.htmlFor = attrs[k];
        } else if (k === 'type') {
          node.type = attrs[k];
        } else if (k === 'placeholder') {
          node.placeholder = attrs[k];
        } else if (k === 'autocomplete') {
          node.setAttribute('autocomplete', attrs[k]);
        } else if (k === 'autocapitalize') {
          node.setAttribute('autocapitalize', attrs[k]);
        } else if (k === 'spellcheck') {
          node.setAttribute('spellcheck', attrs[k]);
        } else if (k === 'aria-label') {
          node.setAttribute('aria-label', attrs[k]);
        } else if (k === 'aria-live') {
          node.setAttribute('aria-live', attrs[k]);
        } else if (k === 'aria-atomic') {
          node.setAttribute('aria-atomic', attrs[k]);
        } else if (k === 'role') {
          node.setAttribute('role', attrs[k]);
        } else if (k === 'id') {
          node.id = attrs[k];
        } else if (k === 'for') {
          node.setAttribute('for', attrs[k]);
        } else if (k === 'maxlength') {
          node.setAttribute('maxlength', attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      children.forEach(function (child) {
        if (typeof child === 'string') {
          node.appendChild(document.createTextNode(child));
        } else if (child) {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  // ─── Validation & submission ──────────────────────────────────────────────

  function showError(msg) {
    if (_errorEl) {
      _errorEl.textContent = msg;
      _errorEl.style.display = 'block';
    }
  }

  function clearError() {
    if (_errorEl) {
      _errorEl.textContent = '';
      _errorEl.style.display = 'none';
    }
  }

  function handleSubmit() {
    if (!_inputEl) { return; }
    var raw = _inputEl.value.trim();

    if (raw === '') {
      showError("Please name what you're working up to — even a few words is enough.");
      _inputEl.focus();
      // Gentle shake on the input to draw attention without alerting
      if (CQ.fx && typeof CQ.fx.shake === 'function') {
        CQ.fx.shake(_inputEl, 4);
      }
      return;
    }

    clearError();

    if (raw.length > 200) { raw = raw.slice(0, 200); }

    var archetype = mapEventToArchetype(raw);

    // Persist to game state
    CQ.state.set({
      eventName: raw,
      archetype: archetype
    });

    // Optional click sound
    if (CQ.fx && typeof CQ.fx.playCue === 'function') {
      CQ.fx.playCue('click');
    }

    // Always go to world-map; companion customization is reachable from there
    CQ.app.showScreen('world-map');
  }

  // ─── Chip interaction ─────────────────────────────────────────────────────

  function handleChipClick(label) {
    if (!_inputEl) { return; }
    _inputEl.value = label;
    clearError();
    _inputEl.focus();
  }

  // ─── mount / unmount ──────────────────────────────────────────────────────

  function mount(rootEl) {
    _root = rootEl;

    // Outer centred wrapper
    var inner = el('div', { className: 'screen__inner mx-auto' });

    // ── Hero headline ──────────────────────────────────────────────────────
    var headline = el('h1', {
      className: 'heading-gradient text-4xl font-display text-center',
      style: 'font-size: clamp(1.75rem, 6vw, 2.75rem); margin-bottom: 0.25em;'
    }, ["What are you working up to?"]);

    var subline = el('p', {
      className: 'text-secondary text-center text-lg',
      style: 'margin-top: var(--sp-3); margin-bottom: var(--sp-6); line-height: var(--leading-snug);'
    }, [
      "Name the moment you’re dreading. Your companion will help you face it."
    ]);

    // ── Card ───────────────────────────────────────────────────────────────
    var card = el('div', { className: 'card card--glow-teal' });

    // Input label (visually minimal, accessible)
    var inputLabel = el('label', {
      className: 'label',
      'for': 'intake-event-input'
    }, ["What’s the situation?"]);

    // Text input
    _inputEl = el('input', {
      id: 'intake-event-input',
      type: 'text',
      className: 'input',
      placeholder: 'e.g. job interview at Google, big presentation, first date…',
      autocomplete: 'off',
      autocapitalize: 'sentences',
      spellcheck: 'true',
      maxlength: '200',
      'aria-label': 'Describe the situation you are dreading'
    });

    // Inline error region — always in DOM so screen readers see it
    _errorEl = el('p', {
      className: 'text-coral text-sm',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      style: 'margin-top: var(--sp-2); min-height: 1.4em; display: none;'
    });

    // Submit on Enter key
    _inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    });

    // Clear error as the player types
    _inputEl.addEventListener('input', function () {
      if (_errorEl && _errorEl.textContent !== '') {
        clearError();
      }
    });

    // ── Example chips ──────────────────────────────────────────────────────
    var chipsLabel = el('p', {
      className: 'text-dim text-sm',
      style: 'margin-top: var(--sp-5); margin-bottom: var(--sp-3);'
    }, ["Not sure how to put it? Try one of these:"]);

    var chipsRow = el('div', {
      className: 'flex flex-wrap gap-2',
      role: 'list'
    });

    EXAMPLE_CHIPS.forEach(function (chip) {
      var chipBtn = el('button', {
        className: 'btn btn--ghost btn--sm',
        type: 'button',
        'aria-label': 'Use example: ' + chip.label,
        style: [
          'border-radius: var(--r-full);',
          'font-size: var(--text-sm);',
          'padding: var(--sp-2) var(--sp-4);',
          'min-height: 36px;',
          'display: inline-flex;',
          'align-items: center;',
          'gap: var(--sp-2);'
        ].join(' ')
      }, [chip.icon + ' ' + chip.label]);

      chipBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();   // prevent focus shift away from input
        handleChipClick(chip.label);
      });

      // Keyboard support for non-pointer interactions
      chipBtn.addEventListener('click', function () {
        handleChipClick(chip.label);
      });

      var chipItem = el('div', { role: 'listitem' }, [chipBtn]);
      chipsRow.appendChild(chipItem);
    });

    // ── Begin button ───────────────────────────────────────────────────────
    var beginBtn = el('button', {
      type: 'button',
      className: 'btn btn--primary btn--lg btn--block btn--pulse',
      style: 'margin-top: var(--sp-6);',
      'aria-label': 'Begin your confidence quest'
    }, ["Begin your quest"]);

    beginBtn.addEventListener('click', handleSubmit);

    // ── Assemble card ──────────────────────────────────────────────────────
    card.appendChild(inputLabel);
    card.appendChild(_inputEl);
    card.appendChild(_errorEl);
    card.appendChild(chipsLabel);
    card.appendChild(chipsRow);
    card.appendChild(beginBtn);

    // ── Reassurance footer ─────────────────────────────────────────────────
    var footer = el('p', {
      className: 'text-dim text-sm text-center',
      style: 'margin-top: var(--sp-4); padding: 0 var(--sp-4);'
    }, [
      "Everything stays on your device. Nothing is sent anywhere."
    ]);

    // ── Assemble screen ────────────────────────────────────────────────────
    inner.appendChild(headline);
    inner.appendChild(subline);
    inner.appendChild(card);
    inner.appendChild(footer);
    rootEl.appendChild(inner);

    // Autofocus input after the screen-in animation completes (240 ms)
    // Only autofocus on non-touch primary pointer devices to avoid mobile
    // keyboards popping up unexpectedly.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var focusTimer = setTimeout(function () {
        if (_inputEl) { _inputEl.focus(); }
      }, 260);
      // Store so unmount can cancel it if the user navigates away immediately
      _root._intakeFocusTimer = focusTimer;
    }
  }

  function unmount() {
    // Cancel deferred autofocus if the screen is dismissed before it fires
    if (_root && _root._intakeFocusTimer) {
      clearTimeout(_root._intakeFocusTimer);
      delete _root._intakeFocusTimer;
    }

    // Clear DOM
    if (_root) {
      while (_root.firstChild) {
        _root.removeChild(_root.firstChild);
      }
    }

    // Drop references
    _root    = null;
    _inputEl = null;
    _errorEl = null;
  }

  // ─── Register screen ──────────────────────────────────────────────────────
  CQ.screens['intake'] = {
    mount:   mount,
    unmount: unmount
  };

}());

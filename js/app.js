// Brick: app-shell | Stud: CQ.state, CQ.screens, CQ.dashboard, data/content.json
// Socket: js/app.js — defines CQ.app (router + boot sequence)
// Wires every registered screen module together; mounts the first screen on boot.

window.CQ = window.CQ || {};
CQ.screens = CQ.screens || {};

(function () {
  'use strict';

  // ─── Internal router state ─────────────────────────────────────────────────
  var _currentId     = null;   // screen id currently mounted
  var _currentModule = null;   // the { mount, unmount } object for it

  // ─── showScreen(id) ───────────────────────────────────────────────────────
  // 1. Call current screen's unmount() if present.
  // 2. Strip .screen--active from every section.
  // 3. Activate #screen-<id> and call its module's mount(sectionEl).
  function showScreen(id) {
    // ── unmount current ──────────────────────────────────────────────────────
    if (_currentModule && typeof _currentModule.unmount === 'function') {
      try {
        _currentModule.unmount();
      } catch (e) {
        console.error('[CQ.app] unmount() threw on screen "' + _currentId + '":', e);
      }
    }

    // ── deactivate all sections ──────────────────────────────────────────────
    // Some screen modules set an inline display on their section during mount();
    // clear it here so the .screen { display:none } class rule can hide them.
    // Without this, a section that set style.display stays visible after we
    // navigate away (it would stack on top of the new screen).
    var allSections = document.querySelectorAll('.screen');
    for (var i = 0; i < allSections.length; i++) {
      allSections[i].classList.remove('screen--active');
      allSections[i].style.display = '';
    }

    // ── locate target section ────────────────────────────────────────────────
    var sectionEl = document.getElementById('screen-' + id);
    if (!sectionEl) {
      console.warn('[CQ.app] showScreen: no <section id="screen-' + id + '"> found in DOM.');
      _currentId     = null;
      _currentModule = null;
      return;
    }

    // ── locate screen module ─────────────────────────────────────────────────
    var mod = CQ.screens[id];
    if (!mod || typeof mod.mount !== 'function') {
      console.warn('[CQ.app] showScreen: no screen module registered for id "' + id + '".');
      // Still show the section (empty) so the app doesn't hard-lock.
      sectionEl.classList.add('screen--active');
      _currentId     = id;
      _currentModule = null;
      return;
    }

    // ── activate and mount ───────────────────────────────────────────────────
    sectionEl.classList.add('screen--active');
    _currentId     = id;
    _currentModule = mod;

    try {
      mod.mount(sectionEl);
    } catch (e) {
      console.error('[CQ.app] mount() threw on screen "' + id + '":', e);
    }
  }

  // ─── Expose CQ.app early ──────────────────────────────────────────────────
  // Set this before boot so that modules called during mount() can call
  // CQ.app.showScreen() without hitting "CQ.app is undefined".
  CQ.app = {
    showScreen: showScreen
  };

  // ─── Boot sequence ─────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {

    // 1. Hydrate state from localStorage (synchronous, no throw).
    CQ.state.load();

    // 2. Grab the header elements we need.
    var headerEl      = document.getElementById('app-header');
    var eventBannerEl = document.getElementById('header-event');

    // 3. Helper: update the event-name banner from current state.
    function syncEventBanner() {
      var name = (CQ.state && CQ.state.eventName) ? CQ.state.eventName.trim() : '';
      if (eventBannerEl) {
        eventBannerEl.textContent = name ? name : '';
      }
    }

    // Set the banner now (state is loaded) and keep it in sync on every change.
    syncEventBanner();
    if (CQ.state && typeof CQ.state.subscribe === 'function') {
      CQ.state.subscribe(function () {
        syncEventBanner();
      });
    }

    // 4. Mount the Confidence Stat bar into the header.
    if (CQ.dashboard && typeof CQ.dashboard.renderBar === 'function' && headerEl) {
      try {
        CQ.dashboard.renderBar(headerEl);
      } catch (e) {
        console.error('[CQ.app] dashboard.renderBar() failed:', e);
      }
    }

    // 5. Fetch content pack; assign to CQ.content.
    //    A missing or malformed content.json must NOT break boot — mini-games
    //    have inline fallbacks.  We start the first screen after the fetch
    //    resolves (or fails) so modules can rely on CQ.content being set or
    //    undefined — never in a partially-fetched state.
    function startFirstScreen() {
      var firstScreen = (CQ.state && CQ.state.eventName && CQ.state.eventName.trim())
        ? 'world-map'
        : 'intake';
      showScreen(firstScreen);
    }

    // Prefer fetch if available (all modern browsers); fall back gracefully.
    if (typeof fetch === 'function') {
      fetch('data/content.json')
        .then(function (res) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          CQ.content = data;
        })
        .catch(function (err) {
          // Non-fatal: leave CQ.content undefined; modules use inline fallbacks.
          console.warn('[CQ.app] data/content.json could not be loaded — mini-games will use fallback content.', err);
        })
        .then(function () {
          // Always runs — equivalent to a finally() for broad compatibility.
          startFirstScreen();
        });
    } else {
      // Very old browser without fetch — skip content load, start directly.
      console.warn('[CQ.app] fetch() not available — skipping content.json load.');
      startFirstScreen();
    }

  });

}());

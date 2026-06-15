// Brick: companion-system | Stud: js/game-state.js + js/fx-kit.js + css/theme.css | Socket: js/companion.js
// Renders the player's companion creature (inline SVG), handles leveling, badges, accessories, and a customizer UI.

window.CQ = window.CQ || {};

(function () {
  'use strict';

  // ─── HTML escape helper (guards innerHTML interpolation against XSS) ─────────
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ─── Catalogue ──────────────────────────────────────────────────────────────

  // BASE options available from level 0
  var BASE_BODIES      = ['round', 'spiky', 'boxy', 'wiggly'];
  var BASE_COLORS      = ['teal', 'coral', 'amber', 'indigo', 'mint', 'rose'];
  var BASE_EXPRESSIONS = ['neutral', 'happy', 'determined', 'sleepy'];

  // Accessories — unlock at specific levels
  var ALL_ACCESSORIES = [
    { id: 'halo',    label: 'Halo',        unlockAt: 1 },
    { id: 'scarf',   label: 'Scarf',       unlockAt: 2 },
    { id: 'crown',   label: 'Crown',       unlockAt: 3 },
    { id: 'wings',   label: 'Wings',       unlockAt: 4 },
    { id: 'star',    label: 'Star Cape',   unlockAt: 5 },
    { id: 'aura',    label: 'Aura Ring',   unlockAt: 6 }
  ];

  // Extra bodies/colors unlocked at each level
  var LEVEL_UNLOCKS = {
    1: { bodies: [],           colors: ['violet'],  accessories: ['halo']  },
    2: { bodies: ['ghost'],    colors: ['lemon'],   accessories: ['scarf'] },
    3: { bodies: [],           colors: ['plasma'],  accessories: ['crown'] },
    4: { bodies: ['crystal'],  colors: ['magma'],   accessories: ['wings'] },
    5: { bodies: [],           colors: ['void'],    accessories: ['star']  },
    6: { bodies: ['ascended'], colors: ['rainbow'], accessories: ['aura']  }
  };

  // Badge metadata — one per level-up (levels 1..6)
  var LEVEL_BADGES = [
    { id: 'first-step',    label: 'First Step',    icon: '✦',  cls: 'badge--teal'  },
    { id: 'rising',        label: 'Rising',        icon: '★',  cls: 'badge--amber' },
    { id: 'focused',       label: 'Focused',       icon: '◆',  cls: 'badge--teal'  },
    { id: 'powerful',      label: 'Powerful',      icon: '⬡',  cls: 'badge--gold'  },
    { id: 'legendary',     label: 'Legendary',     icon: '✸',  cls: 'badge--gold'  },
    { id: 'ascended',      label: 'Ascended',      icon: '❋',  cls: 'badge--gold'  }
  ];

  // Color hex map (used inside SVG)
  var COLOR_MAP = {
    teal:    { body: '#00C9B1', shadow: '#009E8C', shine: '#33D6C4' },
    coral:   { body: '#FF6B6B', shadow: '#CC4545', shine: '#FF8E8E' },
    amber:   { body: '#F5A623', shadow: '#C8841A', shine: '#FFB84D' },
    indigo:  { body: '#7B68EE', shadow: '#5A4FCC', shine: '#9A8FFF' },
    mint:    { body: '#48D1A8', shadow: '#2BAB84', shine: '#6FECBF' },
    rose:    { body: '#F06292', shadow: '#C94070', shine: '#F48FB1' },
    violet:  { body: '#A855F7', shadow: '#7C3ACD', shine: '#C084FC' },
    lemon:   { body: '#FFD700', shadow: '#C8A800', shine: '#FFE74C' },
    plasma:  { body: '#00E5FF', shadow: '#009CB3', shine: '#5EF8FF' },
    magma:   { body: '#FF4D00', shadow: '#CC3300', shine: '#FF7A33' },
    void:    { body: '#9C27B0', shadow: '#6A0080', shine: '#CE93D8' },
    rainbow: { body: '#FF6B6B', shadow: '#00C9B1', shine: '#FFD700' }
  };

  // ─── SVG body shapes ────────────────────────────────────────────────────────

  function svgBodyPath(bodyType, size) {
    var cx = size / 2;
    var cy = size / 2;
    var r  = size * 0.38;

    switch (bodyType) {
      case 'spiky':
        // Star-like spiky shape
        return _starPath(cx, cy, r, r * 0.55, 8);
      case 'boxy':
        // Rounded rectangle
        return '<rect x="' + (cx - r) + '" y="' + (cy - r * 0.9) + '" width="' + (r * 2) + '" height="' + (r * 1.8) + '" rx="' + (r * 0.3) + '" ry="' + (r * 0.3) + '"/>';
      case 'wiggly':
        // Organic blob
        return _blobPath(cx, cy, r);
      case 'ghost':
        // Ghost shape — round top, wavy bottom
        return _ghostPath(cx, cy, r);
      case 'crystal':
        // Diamond/gem shape
        return _diamondPath(cx, cy, r);
      case 'ascended':
        // Double-ring star
        return _starPath(cx, cy, r, r * 0.4, 12);
      default: // 'round'
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
    }
  }

  function _starPath(cx, cy, outerR, innerR, points) {
    var pts = [];
    for (var i = 0; i < points * 2; i++) {
      var angle = (Math.PI / points) * i - Math.PI / 2;
      var r = (i % 2 === 0) ? outerR : innerR;
      pts.push((cx + Math.cos(angle) * r).toFixed(2) + ',' + (cy + Math.sin(angle) * r).toFixed(2));
    }
    return '<polygon points="' + pts.join(' ') + '"/>';
  }

  function _blobPath(cx, cy, r) {
    // Organic blob using cubic beziers
    var k = r * 0.95;
    var o = r * 0.55;
    return '<path d="M ' + cx + ' ' + (cy - k) +
      ' C ' + (cx + o) + ' ' + (cy - k) + ' ' + (cx + k * 1.1) + ' ' + (cy - o * 0.5) + ' ' + (cx + k * 1.05) + ' ' + cy +
      ' C ' + (cx + k * 1.1) + ' ' + (cy + o * 1.2) + ' ' + (cx + o * 0.8) + ' ' + (cy + k) + ' ' + cx + ' ' + (cy + k * 0.9) +
      ' C ' + (cx - o * 0.9) + ' ' + (cy + k * 1.05) + ' ' + (cx - k * 1.1) + ' ' + (cy + o * 0.9) + ' ' + (cx - k) + ' ' + cy +
      ' C ' + (cx - k * 0.9) + ' ' + (cy - o * 1.1) + ' ' + (cx - o * 0.5) + ' ' + (cy - k * 0.95) + ' ' + cx + ' ' + (cy - k) +
      ' Z"/>';
  }

  function _ghostPath(cx, cy, r) {
    var top = cy - r * 0.95;
    var bot = cy + r * 0.85;
    var left = cx - r;
    var right = cx + r;
    var w3 = (right - left) / 3;
    return '<path d="M ' + left + ' ' + cy +
      ' A ' + r + ' ' + (r * 0.95) + ' 0 0 1 ' + right + ' ' + cy +
      ' L ' + right + ' ' + bot +
      ' Q ' + (right - w3 * 0.5) + ' ' + (bot - r * 0.22) + ' ' + (cx + w3 * 0.5) + ' ' + bot +
      ' Q ' + cx + ' ' + (bot + r * 0.22) + ' ' + (cx - w3 * 0.5) + ' ' + bot +
      ' Q ' + (left + w3 * 0.5) + ' ' + (bot - r * 0.22) + ' ' + left + ' ' + bot +
      ' Z"/>';
  }

  function _diamondPath(cx, cy, r) {
    var pts = [
      cx + ',' + (cy - r),
      (cx + r * 0.7) + ',' + (cy - r * 0.3),
      (cx + r * 0.55) + ',' + cy,
      cx + ',' + (cy + r),
      (cx - r * 0.55) + ',' + cy,
      (cx - r * 0.7) + ',' + (cy - r * 0.3)
    ];
    return '<polygon points="' + pts.join(' ') + '"/>';
  }

  // ─── Expression eyes / mouth ────────────────────────────────────────────────

  function svgFace(expression, size) {
    var cx   = size / 2;
    var cy   = size / 2;
    var ey   = cy - size * 0.07;  // eye row y
    var ex   = size * 0.12;       // eye horizontal offset from center
    var er   = size * 0.048;      // eye radius
    var parts = '';

    switch (expression) {
      case 'happy':
        // Wide happy eyes + big smile arc
        parts += '<ellipse cx="' + (cx - ex) + '" cy="' + ey + '" rx="' + (er * 1.1) + '" ry="' + (er * 0.7) + '" fill="#1A1040" opacity="0.85"/>';
        parts += '<ellipse cx="' + (cx + ex) + '" cy="' + ey + '" rx="' + (er * 1.1) + '" ry="' + (er * 0.7) + '" fill="#1A1040" opacity="0.85"/>';
        // shines
        parts += '<circle cx="' + (cx - ex + er * 0.4) + '" cy="' + (ey - er * 0.3) + '" r="' + (er * 0.35) + '" fill="white" opacity="0.9"/>';
        parts += '<circle cx="' + (cx + ex + er * 0.4) + '" cy="' + (ey - er * 0.3) + '" r="' + (er * 0.35) + '" fill="white" opacity="0.9"/>';
        // smile arc
        var smR = size * 0.13;
        parts += '<path d="M ' + (cx - smR) + ' ' + (cy + size * 0.1) + ' Q ' + cx + ' ' + (cy + size * 0.25) + ' ' + (cx + smR) + ' ' + (cy + size * 0.1) + '" stroke="#1A1040" stroke-width="' + (size * 0.028) + '" fill="none" stroke-linecap="round" opacity="0.85"/>';
        break;

      case 'determined':
        // Angled "fierce" brows + flat confident eyes + straight mouth
        parts += '<rect x="' + (cx - ex - er * 1.2) + '" y="' + (ey - er * 1.6) + '" width="' + (er * 2.2) + '" height="' + (er * 0.55) + '" rx="' + (er * 0.25) + '" fill="#1A1040" opacity="0.85" transform="rotate(-8,' + (cx - ex) + ',' + (ey - er) + ')"/>';
        parts += '<rect x="' + (cx + ex - er) + '" y="' + (ey - er * 1.6) + '" width="' + (er * 2.2) + '" height="' + (er * 0.55) + '" rx="' + (er * 0.25) + '" fill="#1A1040" opacity="0.85" transform="rotate(8,' + (cx + ex) + ',' + (ey - er) + ')"/>';
        parts += '<ellipse cx="' + (cx - ex) + '" cy="' + ey + '" rx="' + er + '" ry="' + (er * 0.65) + '" fill="#1A1040" opacity="0.85"/>';
        parts += '<ellipse cx="' + (cx + ex) + '" cy="' + ey + '" rx="' + er + '" ry="' + (er * 0.65) + '" fill="#1A1040" opacity="0.85"/>';
        parts += '<circle cx="' + (cx - ex + er * 0.3) + '" cy="' + (ey - er * 0.25) + '" r="' + (er * 0.3) + '" fill="white" opacity="0.8"/>';
        parts += '<circle cx="' + (cx + ex + er * 0.3) + '" cy="' + (ey - er * 0.25) + '" r="' + (er * 0.3) + '" fill="white" opacity="0.8"/>';
        // firm line mouth
        parts += '<line x1="' + (cx - size * 0.1) + '" y1="' + (cy + size * 0.16) + '" x2="' + (cx + size * 0.1) + '" y2="' + (cy + size * 0.16) + '" stroke="#1A1040" stroke-width="' + (size * 0.025) + '" stroke-linecap="round" opacity="0.85"/>';
        break;

      case 'sleepy':
        // Half-closed droopy eyes + small yawn oval
        parts += '<path d="M ' + (cx - ex - er * 1.1) + ' ' + ey + ' Q ' + (cx - ex) + ' ' + (ey - er * 0.9) + ' ' + (cx - ex + er * 1.1) + ' ' + ey + '" fill="#1A1040" opacity="0.8"/>';
        parts += '<path d="M ' + (cx + ex - er * 1.1) + ' ' + ey + ' Q ' + (cx + ex) + ' ' + (ey - er * 0.9) + ' ' + (cx + ex + er * 1.1) + ' ' + ey + '" fill="#1A1040" opacity="0.8"/>';
        // little Z near eye
        parts += '<text x="' + (cx + ex + er * 1.5) + '" y="' + (ey - er) + '" font-size="' + (size * 0.1) + '" fill="#1A1040" opacity="0.55" font-family="sans-serif">z</text>';
        // tiny oval mouth
        parts += '<ellipse cx="' + cx + '" cy="' + (cy + size * 0.17) + '" rx="' + (size * 0.06) + '" ry="' + (size * 0.042) + '" fill="#1A1040" opacity="0.6"/>';
        break;

      default: // 'neutral'
        // Simple round eyes + gentle smile
        parts += '<circle cx="' + (cx - ex) + '" cy="' + ey + '" r="' + er + '" fill="#1A1040" opacity="0.8"/>';
        parts += '<circle cx="' + (cx + ex) + '" cy="' + ey + '" r="' + er + '" fill="#1A1040" opacity="0.8"/>';
        parts += '<circle cx="' + (cx - ex + er * 0.35) + '" cy="' + (ey - er * 0.3) + '" r="' + (er * 0.32) + '" fill="white" opacity="0.85"/>';
        parts += '<circle cx="' + (cx + ex + er * 0.35) + '" cy="' + (ey - er * 0.3) + '" r="' + (er * 0.32) + '" fill="white" opacity="0.85"/>';
        var sr = size * 0.1;
        parts += '<path d="M ' + (cx - sr) + ' ' + (cy + size * 0.12) + ' Q ' + cx + ' ' + (cy + size * 0.19) + ' ' + (cx + sr) + ' ' + (cy + size * 0.12) + '" stroke="#1A1040" stroke-width="' + (size * 0.025) + '" fill="none" stroke-linecap="round" opacity="0.75"/>';
        break;
    }

    return parts;
  }

  // ─── Accessory overlays ──────────────────────────────────────────────────────

  function svgAccessory(accessoryId, size, colorHex) {
    var cx = size / 2;
    var cy = size / 2;
    var r  = size * 0.38;

    switch (accessoryId) {
      case 'halo':
        return '<ellipse cx="' + cx + '" cy="' + (cy - r * 0.95) + '" rx="' + (r * 0.7) + '" ry="' + (r * 0.13) + '" fill="none" stroke="#FFD700" stroke-width="' + (size * 0.028) + '" opacity="0.92"/>';

      case 'scarf':
        return '<path d="M ' + (cx - r * 0.88) + ' ' + (cy + r * 0.15) +
          ' Q ' + cx + ' ' + (cy + r * 0.42) + ' ' + (cx + r * 0.88) + ' ' + (cy + r * 0.15) +
          '" stroke="' + colorHex + '" stroke-width="' + (size * 0.09) + '" fill="none" stroke-linecap="round" opacity="0.88"/>' +
          '<line x1="' + (cx + r * 0.3) + '" y1="' + (cy + r * 0.3) + '" x2="' + (cx + r * 0.5) + '" y2="' + (cy + r * 0.75) + '" stroke="' + colorHex + '" stroke-width="' + (size * 0.07) + '" stroke-linecap="round" opacity="0.8"/>';

      case 'crown':
        var cBase = cy - r * 0.78;
        var cLeft = cx - r * 0.55;
        var cRight = cx + r * 0.55;
        return '<polygon points="' +
          cLeft + ',' + cBase + ' ' +
          (cx - r * 0.2) + ',' + (cBase - r * 0.42) + ' ' +
          cx + ',' + cBase + ' ' +
          (cx + r * 0.2) + ',' + (cBase - r * 0.42) + ' ' +
          cRight + ',' + cBase + ' ' +
          cRight + ',' + (cBase + r * 0.22) + ' ' +
          cLeft + ',' + (cBase + r * 0.22) +
          '" fill="#FFD700" opacity="0.95"/>' +
          '<circle cx="' + (cx - r * 0.3) + '" cy="' + (cBase - r * 0.05) + '" r="' + (r * 0.1) + '" fill="#FF6B6B"/>' +
          '<circle cx="' + cx + '" cy="' + (cBase - r * 0.05) + '" r="' + (r * 0.1) + '" fill="#00C9B1"/>' +
          '<circle cx="' + (cx + r * 0.3) + '" cy="' + (cBase - r * 0.05) + '" r="' + (r * 0.1) + '" fill="#A855F7"/>';

      case 'wings':
        return '<path d="M ' + (cx - r * 0.95) + ' ' + cy +
          ' Q ' + (cx - r * 1.7) + ' ' + (cy - r * 0.8) + ' ' + (cx - r * 1.3) + ' ' + (cy + r * 0.55) +
          ' Q ' + (cx - r * 0.85) + ' ' + (cy + r * 0.3) + ' ' + (cx - r * 0.95) + ' ' + cy + '" fill="#F0EAF8" opacity="0.82"/>' +
          '<path d="M ' + (cx + r * 0.95) + ' ' + cy +
          ' Q ' + (cx + r * 1.7) + ' ' + (cy - r * 0.8) + ' ' + (cx + r * 1.3) + ' ' + (cy + r * 0.55) +
          ' Q ' + (cx + r * 0.85) + ' ' + (cy + r * 0.3) + ' ' + (cx + r * 0.95) + ' ' + cy + '" fill="#F0EAF8" opacity="0.82"/>';

      case 'star':
        // Mini stars orbiting the body
        var result = '';
        var positions = [
          { x: cx - r * 1.35, y: cy - r * 0.5 },
          { x: cx + r * 1.35, y: cy - r * 0.5 },
          { x: cx,            y: cy - r * 1.4 }
        ];
        positions.forEach(function (p) {
          result += _svgMiniStar(p.x, p.y, r * 0.2, '#FFD700');
        });
        return result;

      case 'aura':
        // Rotating rainbow ring
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.28) + '" fill="none" stroke="url(#aura-grad)" stroke-width="' + (size * 0.032) + '" opacity="0.75" stroke-dasharray="' + (r * 0.38) + ' ' + (r * 0.19) + '"/>';

      default:
        return '';
    }
  }

  function _svgMiniStar(cx, cy, r, color) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var angle = (Math.PI / 5) * i - Math.PI / 2;
      var rad = (i % 2 === 0) ? r : r * 0.45;
      pts.push(
        (cx + Math.cos(angle) * rad).toFixed(2) + ',' +
        (cy + Math.sin(angle) * rad).toFixed(2)
      );
    }
    return '<polygon points="' + pts.join(' ') + '" fill="' + color + '" opacity="0.95"/>';
  }

  // ─── Level-0 vs higher visual difference ────────────────────────────────────
  // Level 0: creature is small, grey, curled in on itself (dim mode via CSS class handles glow;
  // the SVG also renders smaller, uses a monochrome accent, and no shine dot).
  // Level 1+: full-size, colored, animated glow (from .companion--lvlN).

  // ─── Core SVG builder ────────────────────────────────────────────────────────

  function buildCompanionSVG(companionCfg, level, equippedAccessory) {
    var body   = companionCfg.body       || 'round';
    var color  = companionCfg.color      || 'teal';
    var expr   = companionCfg.expression || 'neutral';
    var acc    = equippedAccessory || null;

    var size   = 120;    // SVG canvas in px (viewBox units)
    var cx     = size / 2;
    var cy     = size / 2;

    var palette = COLOR_MAP[color] || COLOR_MAP['teal'];

    // At level 0 override to muted grey
    var bodyFill   = level === 0 ? '#8877BB' : palette.body;
    var shadowFill = level === 0 ? '#554488' : palette.shadow;
    var shineFill  = level === 0 ? '#AA99CC' : palette.shine;

    // Choose a slightly different shade for level 0 expression
    var faceScale = level === 0 ? 0.88 : 1.0;

    // Gradient id (unique to each call to avoid conflicts if multiple renders)
    var gid = 'cq-grad-' + Math.random().toString(36).slice(2, 7);

    var defs = '<defs>' +
      '<radialGradient id="' + gid + '" cx="40%" cy="35%" r="62%">' +
        '<stop offset="0%" stop-color="' + shineFill + '"/>' +
        '<stop offset="100%" stop-color="' + shadowFill + '"/>' +
      '</radialGradient>' +
      '<radialGradient id="aura-grad" cx="50%" cy="50%" r="50%" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0%"   stop-color="#FF6B6B"/>' +
        '<stop offset="33%"  stop-color="#FFD700"/>' +
        '<stop offset="66%"  stop-color="#00C9B1"/>' +
        '<stop offset="100%" stop-color="#A855F7"/>' +
      '</radialGradient>' +
    '</defs>';

    // Shadow ellipse under creature (not at level 0)
    var shadow = level > 0
      ? '<ellipse cx="' + cx + '" cy="' + (size * 0.91) + '" rx="' + (size * 0.28) + '" ry="' + (size * 0.06) + '" fill="#1A1040" opacity="0.35"/>'
      : '';

    // Body shape — fill with gradient
    var bodyPath = svgBodyPath(body, size);
    // Insert gradient fill into the shape element
    var bodyEl = bodyPath.replace('/>', ' fill="url(#' + gid + ')"/>');

    // Optional rainbow body shimmer at level 6
    var shimmer = '';
    if (level === 6 && body !== 'ascended') {
      shimmer = bodyPath.replace('/>', ' fill="none" stroke="#FFD700" stroke-width="2.5" opacity="0.35"/>');
    }

    // Accessory under the face (wings, scarf)
    var accUnder = '';
    var accOver  = '';
    if (acc) {
      var accSvg = svgAccessory(acc, size, palette.body);
      if (acc === 'wings' || acc === 'scarf') {
        accUnder = accSvg;
      } else {
        accOver = accSvg;
      }
    }

    // Face — scale slightly for level 0 timidness
    var face = '';
    if (faceScale !== 1.0) {
      face = '<g transform="scale(' + faceScale + ') translate(' + (cx * (1 - faceScale)) + ',' + (cy * (1 - faceScale)) + ')">' + svgFace(expr, size) + '</g>';
    } else {
      face = svgFace(expr, size);
    }

    // Cheek blush circles (not on level 0)
    var blush = '';
    if (level > 0) {
      var blushAlpha = Math.min(0.25 + level * 0.05, 0.55);
      blush = '<circle cx="' + (cx - size * 0.22) + '" cy="' + (cy + size * 0.06) + '" r="' + (size * 0.07) + '" fill="#FF6B6B" opacity="' + blushAlpha.toFixed(2) + '"/>' +
              '<circle cx="' + (cx + size * 0.22) + '" cy="' + (cy + size * 0.06) + '" r="' + (size * 0.07) + '" fill="#FF6B6B" opacity="' + blushAlpha.toFixed(2) + '"/>';
    }

    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Companion creature">' +
      defs +
      shadow +
      accUnder +
      bodyEl +
      shimmer +
      blush +
      face +
      accOver +
    '</svg>';

    return svg;
  }

  // ─── Badge row HTML ──────────────────────────────────────────────────────────

  function buildBadgeRowHTML(badges) {
    if (!badges || badges.length === 0) {
      return '<span style="font-size:0.72rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;">No badges yet</span>';
    }
    return badges.map(function (badgeId) {
      var meta = LEVEL_BADGES.find(function (b) { return b.id === badgeId; });
      if (!meta) { return ''; }
      return '<span class="badge ' + meta.cls + '" title="' + meta.label + '">' + meta.icon + ' ' + meta.label + '</span>';
    }).join('');
  }

  // ─── Equipped accessory resolve ──────────────────────────────────────────────

  function resolveEquippedAccessory(state) {
    // Find the highest-tier unlocked accessory that is available at this level
    var unlockedAcc = state.unlocks.accessories || [];
    var equipped = null;
    // Walk in reverse priority order: pick the most-recently unlocked
    for (var i = ALL_ACCESSORIES.length - 1; i >= 0; i--) {
      var accMeta = ALL_ACCESSORIES[i];
      if (unlockedAcc.indexOf(accMeta.id) !== -1) {
        equipped = accMeta.id;
        break;
      }
    }
    return equipped;
  }

  // ─── render(el) ─────────────────────────────────────────────────────────────

  var _renderTarget = null;
  var _unsub        = null;

  function render(el) {
    if (!el) {
      console.error('[CQ.companion] render() requires a DOM element.');
      return;
    }

    // Remember the element for re-renders
    _renderTarget = el;

    // Subscribe to state changes if not already (idempotent)
    if (!_unsub) {
      _unsub = CQ.state.subscribe(function () {
        if (_renderTarget) { _doRender(_renderTarget); }
      });
    }

    _doRender(el);
  }

  function _doRender(el) {
    try {
      var state   = CQ.state;
      var level   = state.level;
      var compCfg = state.companion;
      var badges  = state.badges;
      var equipped = resolveEquippedAccessory(state);

      var lvlClass = 'companion--lvl' + Math.min(level, 6);

      var svg    = buildCompanionSVG(compCfg, level, equipped);
      var badgeRow = buildBadgeRowHTML(badges);

      // Level indicator label
      var lvlLabel = level === 0
        ? '<span style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.07em;text-transform:uppercase;">Starting out…</span>'
        : '<span style="font-size:0.7rem;color:var(--text-secondary);letter-spacing:0.07em;text-transform:uppercase;">Level ' + level + '</span>';

      el.innerHTML =
        '<div class="companion ' + lvlClass + '" style="display:flex;flex-direction:column;align-items:center;gap:8px;">' +
          '<div class="companion__avatar" style="position:relative;">' +
            svg +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">' +
            lvlLabel +
            '<div class="badge-row" style="justify-content:center;">' + badgeRow + '</div>' +
          '</div>' +
        '</div>';
    } catch (e) {
      console.error('[CQ.companion] render error:', e);
    }
  }

  // ─── levelUp() ──────────────────────────────────────────────────────────────

  function levelUp() {
    var currentLevel = CQ.state.level;
    if (currentLevel >= 6) {
      console.warn('[CQ.companion] levelUp(): already at max level 6.');
      return;
    }

    var nextLevel = currentLevel + 1;

    // Badge to award
    var badgeMeta = LEVEL_BADGES[nextLevel - 1];
    var newBadges = CQ.state.badges.slice();
    if (badgeMeta && newBadges.indexOf(badgeMeta.id) === -1) {
      newBadges.push(badgeMeta.id);
    }

    // Unlocks for the new level
    var unlockData = LEVEL_UNLOCKS[nextLevel] || { bodies: [], colors: [], accessories: [] };
    var curUnlocks = CQ.state.unlocks;

    var newUnlocks = {
      bodies:      (curUnlocks.bodies || []).concat(unlockData.bodies),
      colors:      (curUnlocks.colors || []).concat(unlockData.colors),
      accessories: (curUnlocks.accessories || []).concat(unlockData.accessories)
    };

    // Mutate state (triggers notify → re-render)
    CQ.state.set({ level: nextLevel, badges: newBadges, unlocks: newUnlocks });

    // Play sound cue (must be in a user-gesture chain — mini-games call levelUp from a click)
    try { CQ.fx.playCue('level'); } catch (e) {}

    // Fire particle burst on the companion avatar in _renderTarget
    _fireParticleBurst();

    // Flash the levelup CSS class
    _flashLevelupClass();
  }

  function _fireParticleBurst() {
    if (!_renderTarget) { return; }
    try {
      var avatarEl = _renderTarget.querySelector('.companion__avatar');
      if (!avatarEl) { return; }

      var rect   = avatarEl.getBoundingClientRect();
      var cx     = rect.left + rect.width / 2;
      var cy     = rect.top  + rect.height / 2;

      // Create a temporary full-viewport canvas overlaid on top
      var canvas = document.createElement('canvas');
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
      document.body.appendChild(canvas);

      var ctx = canvas.getContext('2d');
      CQ.fx.particleBurst(ctx, cx, cy, {
        count:  36,
        colors: ['#FFD700', '#00C9B1', '#F5A623', '#A855F7', '#FF6B6B', '#F0EAF8'],
        spread: 200,
        life:   1000,
        radius: 5
      });

      // Remove canvas after animation is done (life + buffer)
      setTimeout(function () {
        if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
      }, 1200);
    } catch (e) {
      console.error('[CQ.companion] particleBurst error:', e);
    }
  }

  function _flashLevelupClass() {
    if (!_renderTarget) { return; }
    try {
      var compEl = _renderTarget.querySelector('.companion');
      if (!compEl) { return; }
      compEl.classList.add('companion--levelup');
      // Remove after animation (0.6s defined in theme.css)
      setTimeout(function () {
        compEl.classList.remove('companion--levelup');
      }, 700);
    } catch (e) {}
  }

  // ─── openCustomizer(el) ──────────────────────────────────────────────────────

  function openCustomizer(el) {
    if (!el) {
      console.error('[CQ.companion] openCustomizer() requires a DOM element.');
      return;
    }

    var state    = CQ.state;
    var comp     = state.companion;
    var unlocks  = state.unlocks;
    var level    = state.level;

    // Available options = base + unlocked
    var availBodies  = BASE_BODIES.concat(unlocks.bodies  || []);
    var availColors  = BASE_COLORS.concat(unlocks.colors  || []);
    var availExpr    = BASE_EXPRESSIONS;

    // Determine accessories visible at this level (the ones unlocked so far)
    var availAcc = ALL_ACCESSORIES.filter(function (a) {
      return (unlocks.accessories || []).indexOf(a.id) !== -1;
    });

    // State for live preview inside customizer
    var preview = {
      body:       comp.body,
      color:      comp.color,
      expression: comp.expression
    };

    function renderCustomizer() {
      var previewSVG = buildCompanionSVG(preview, level, resolveEquippedAccessory(state));

      var bodySectionHTML = '<div style="margin-bottom:12px;">' +
        '<div style="font-size:0.7rem;color:var(--text-secondary);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:6px;">Body</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        availBodies.map(function (b) {
          var active = preview.body === b;
          var previewSvg = buildCompanionSVG({ body: b, color: preview.color, expression: 'neutral' }, level, null);
          return '<button data-type="body" data-val="' + esc(b) + '" class="cq-cust-btn" style="' +
            'background:' + (active ? 'rgba(0,201,177,0.18)' : 'rgba(45,30,110,0.7)') + ';' +
            'border:2px solid ' + (active ? 'var(--teal)' : 'rgba(168,85,247,0.3)') + ';' +
            'border-radius:10px;padding:6px;cursor:pointer;transition:border-color 0.15s;' +
            'display:flex;flex-direction:column;align-items:center;gap:4px;' +
            '">' +
            previewSvg.replace('width="120"', 'width="48"').replace('height="120"', 'height="48"') +
            '<span style="font-size:0.62rem;color:var(--text-secondary);letter-spacing:0.05em;text-transform:capitalize;">' + esc(b) + '</span>' +
            '</button>';
        }).join('') +
        '</div></div>';

      var colorSectionHTML = '<div style="margin-bottom:12px;">' +
        '<div style="font-size:0.7rem;color:var(--text-secondary);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:6px;">Color</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        availColors.map(function (c) {
          var active = preview.color === c;
          var hex    = (COLOR_MAP[c] || COLOR_MAP['teal']).body;
          return '<button data-type="color" data-val="' + esc(c) + '" class="cq-cust-btn" style="' +
            'width:36px;height:36px;border-radius:50%;background:' + hex + ';' +
            'border:3px solid ' + (active ? 'white' : 'transparent') + ';' +
            'box-shadow: 0 0 ' + (active ? '10px ' + hex : '0px transparent') + ';' +
            'cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;outline:none;' +
            '" title="' + esc(c) + '"></button>';
        }).join('') +
        '</div></div>';

      var exprSectionHTML = '<div style="margin-bottom:12px;">' +
        '<div style="font-size:0.7rem;color:var(--text-secondary);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:6px;">Expression</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        availExpr.map(function (e) {
          var active = preview.expression === e;
          var eSvg   = buildCompanionSVG({ body: preview.body, color: preview.color, expression: e }, level, null);
          return '<button data-type="expression" data-val="' + esc(e) + '" class="cq-cust-btn" style="' +
            'background:' + (active ? 'rgba(245,166,35,0.18)' : 'rgba(45,30,110,0.7)') + ';' +
            'border:2px solid ' + (active ? 'var(--amber)' : 'rgba(168,85,247,0.3)') + ';' +
            'border-radius:10px;padding:6px;cursor:pointer;' +
            'display:flex;flex-direction:column;align-items:center;gap:4px;' +
            '">' +
            eSvg.replace('width="120"', 'width="48"').replace('height="120"', 'height="48"') +
            '<span style="font-size:0.62rem;color:var(--text-secondary);letter-spacing:0.05em;text-transform:capitalize;">' + esc(e) + '</span>' +
            '</button>';
        }).join('') +
        '</div></div>';

      var accSectionHTML = '';
      if (availAcc.length > 0) {
        accSectionHTML = '<div style="margin-bottom:12px;">' +
          '<div style="font-size:0.7rem;color:var(--text-secondary);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:4px;">Accessories <span style="color:var(--amber);font-size:0.65rem;">(auto-equipped)</span></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
          availAcc.map(function (a) {
            return '<span class="badge badge--amber" title="Unlocked at level ' + esc(String(a.unlockAt)) + '">' + esc(a.label) + '</span>';
          }).join('') +
          '</div></div>';
      } else {
        accSectionHTML = '<div style="margin-bottom:12px;">' +
          '<div style="font-size:0.7rem;color:var(--text-dim);letter-spacing:0.06em;text-transform:uppercase;">Accessories unlock as you level up!</div>' +
        '</div>';
      }

      el.innerHTML =
        '<div style="background:var(--bg-surface);border:1px solid rgba(168,85,247,0.25);border-radius:16px;padding:20px;max-width:380px;">' +
          '<div style="font-family:var(--font-display);font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:16px;letter-spacing:0.04em;">Customize Companion</div>' +
          '<div style="display:flex;justify-content:center;margin-bottom:16px;">' +
            '<div class="companion companion--lvl' + Math.min(level, 6) + '">' + previewSVG + '</div>' +
          '</div>' +
          bodySectionHTML +
          colorSectionHTML +
          exprSectionHTML +
          accSectionHTML +
          '<div style="display:flex;gap:10px;margin-top:4px;">' +
            '<button id="cq-cust-save" class="btn btn--secondary" style="flex:1;min-height:40px;">Save</button>' +
            '<button id="cq-cust-cancel" class="btn btn--ghost" style="flex:1;min-height:40px;">Cancel</button>' +
          '</div>' +
        '</div>';

      // Event delegation on the customizer
      el.addEventListener('pointerdown', _custHandler, { passive: true });

      function _custHandler(ev) {
        var btn = ev.target.closest('[data-type]');
        if (btn) {
          var type = btn.getAttribute('data-type');
          var val  = btn.getAttribute('data-val');
          preview[type] = val;
          el.removeEventListener('pointerdown', _custHandler);
          renderCustomizer();
          return;
        }

        if (ev.target.closest('#cq-cust-save')) {
          el.removeEventListener('pointerdown', _custHandler);
          CQ.state.set({ companion: { body: preview.body, color: preview.color, expression: preview.expression } });
          try { CQ.fx.playCue('click'); } catch (e2) {}
          el.innerHTML = '';
          return;
        }

        if (ev.target.closest('#cq-cust-cancel')) {
          el.removeEventListener('pointerdown', _custHandler);
          el.innerHTML = '';
          return;
        }
      }
    }

    renderCustomizer();
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  CQ.companion = {
    render:          render,
    levelUp:         levelUp,
    openCustomizer:  openCustomizer,

    // Exposed for other bricks that want to read catalogue data
    BASE_BODIES:      BASE_BODIES,
    BASE_COLORS:      BASE_COLORS,
    BASE_EXPRESSIONS: BASE_EXPRESSIONS,
    LEVEL_BADGES:     LEVEL_BADGES
  };

}());

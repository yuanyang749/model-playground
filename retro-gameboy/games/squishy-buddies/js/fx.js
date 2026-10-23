/* ==========================================================================
   Squishy Buddies 2006 - Hi-Res Vector FX Renderer
   Jelly characters, crystal-clear bubbles, themed room maps & juicy particles.
   Ported from the promo film's art direction (agy-mobile-film/js/lib.js + scenes.js).

   Everything is drawn in the game's 320x240 logical units. game.js scales the
   canvas backing store (setTransform) so every stroke stays razor sharp on
   phone screens - no more pixelated blow-ups.
   ========================================================================== */

const SquishyFX = (() => {
  const TAU = Math.PI * 2;
  const FONT = '"SF Mono","Menlo","Consolas","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",monospace';
  const INK = '#16110C';

  /* ---------------- math & easing ---------------- */
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const outCubic = p => 1 - Math.pow(1 - p, 3);
  const outBack = (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  // damped spring: starts at 1, settles at 0 (used for pop-in / landing wobble)
  const spring = (t, freq = 3.2, zeta = 0.28) => {
    if (t <= 0) return 1;
    const w = TAU * freq, wd = w * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-zeta * w * t) * Math.cos(wd * t);
  };
  const hash2 = (a, b) => {
    let x = Math.imul((a * 73856093) ^ (b * 19349663), 0x9E3779B1);
    x ^= x >>> 15; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13;
    return ((x >>> 0) % 100000) / 100000;
  };
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const mixHex = (a, b, p) => {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const r = Math.round(lerp((A >> 16) & 255, (B >> 16) & 255, p));
    const g = Math.round(lerp((A >> 8) & 255, (B >> 8) & 255, p));
    const bl = Math.round(lerp(A & 255, B & 255, p));
    return `rgb(${r},${g},${bl})`;
  };

  /* ---------------- primitives ---------------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 'bold'} ${o.size || 9}px ${FONT}`;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillStyle = o.color || '#FFF4E2';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || 2; ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
    ctx.fillText(s, x, y);
    ctx.restore();
  }
  // toy-style glass panel used by HUD / overlays
  function panel(ctx, x, y, w, h, o = {}) {
    const r = o.r == null ? 5 : o.r;
    ctx.save();
    rr(ctx, x, y + (o.lift || 0), w, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.top || 'rgba(70,50,34,.94)');
    g.addColorStop(1, o.bottom || 'rgba(36,26,18,.94)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = o.lw || 1.2; ctx.strokeStyle = o.border || '#FFD454'; ctx.stroke();
    // top gloss line
    ctx.globalAlpha *= .35; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = .7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + r, y + 1.6); ctx.lineTo(x + w - r, y + 1.6); ctx.stroke();
    ctx.restore();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * .35);
    ctx.bezierCurveTo(x - s * .9, y - s * .3, x - s * .45, y - s * .95, x, y - s * .45);
    ctx.bezierCurveTo(x + s * .45, y - s * .95, x + s * .9, y - s * .3, x, y + s * .35);
    ctx.closePath();
  }
  function star4(ctx, x, y, r, rot = 0, inner = .28) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + i * Math.PI / 4, rad = i % 2 ? r * inner : r;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  // unit droplet: base at y, tip at y - 2.02 s, half width s
  function dropletPath(ctx, x, y, s, sx, sy) {
    const P = (px, py) => [x + px * s * sx, y + py * s * sy];
    ctx.beginPath();
    let a = P(0, -2.02); ctx.moveTo(a[0], a[1]);
    let c1 = P(.42, -1.78), c2 = P(1.02, -1.28), e = P(1.02, -.62); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(1.02, -.12); c2 = P(.62, 0); e = P(0, 0); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(-.62, 0); c2 = P(-1.02, -.12); e = P(-1.02, -.62); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(-1.02, -1.28); c2 = P(-.42, -1.78); e = P(0, -2.02); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    ctx.closePath();
  }
  function dropIcon(ctx, x, y, s, col = '#19C8FF') {
    ctx.save();
    dropletPath(ctx, x, y + s * 1.0, s * .5, 1, 1);
    const g = ctx.createLinearGradient(x, y - s, x, y + s);
    g.addColorStop(0, '#C8FCFF'); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = .7; ctx.strokeStyle = '#0A5A86'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - s * .22, y + s * .1, s * .09, s * .2, .4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- room themes (map style) ---------------- */
  const THEMES = [
    // Stage 1 (Rooms 1-5)
    { id: 'springs', name: '彩虹泉林', light: true, skyTop: '#FFF6E6', skyBot: '#FFDDB8', grid: 'rgba(196,150,98,.20)', body0: '#D6AC82', body1: '#A57A52', lip: '#8EE0B0', lipHi: '#D2FAE2', ink: '#3B2A1C', accent: '#FFD454', cloud: 'rgba(255,255,255,.80)', shadow: 'rgba(90,58,30,.30)', vignette: 'rgba(130,76,34,.26)', deco: 'meadow', rainbow: true },
    { id: 'chasm', name: '浮力峡谷', light: true, skyTop: '#EAF6FF', skyBot: '#B7DEF8', grid: 'rgba(110,160,205,.22)', body0: '#8499CE', body1: '#566BA6', lip: '#C9EBFF', lipHi: '#F2FBFF', ink: '#1E2A4D', accent: '#75C8F8', cloud: 'rgba(255,255,255,.85)', shadow: 'rgba(30,50,100,.28)', vignette: 'rgba(30,70,140,.26)', deco: 'ice' },
    { id: 'cliff', name: '绝壁粘附', light: true, skyTop: '#FFEAF3', skyBot: '#FFC6DC', grid: 'rgba(222,130,170,.22)', body0: '#DE92B4', body1: '#B05A82', lip: '#FFD6E7', lipHi: '#FFF1F7', ink: '#4A1F35', accent: '#FF8CB8', cloud: 'rgba(255,255,255,.80)', shadow: 'rgba(110,30,70,.28)', vignette: 'rgba(160,40,100,.24)', deco: 'candy' },
    { id: 'meadow', name: '弹跳苍穹', light: true, skyTop: '#EBFBF0', skyBot: '#B8EACB', grid: 'rgba(96,170,128,.22)', body0: '#63BC8E', body1: '#3C8A66', lip: '#D0F8E0', lipHi: '#F3FFF8', ink: '#143A2C', accent: '#70D8A8', cloud: 'rgba(255,255,255,.82)', shadow: 'rgba(20,80,50,.28)', vignette: 'rgba(24,110,70,.24)', deco: 'leaf' },
    { id: 'dusk', name: '五彩交响', light: false, skyTop: '#2C2040', skyBot: '#150E1F', grid: 'rgba(120,90,170,.20)', body0: '#4F4264', body1: '#2A2038', lip: '#8D7BA8', lipHi: '#C8B6E8', ink: '#0A0510', accent: '#B98CFF', cloud: 'rgba(185,140,255,.10)', shadow: 'rgba(0,0,0,.45)', vignette: 'rgba(0,0,0,.50)', deco: 'crystal' },
    // Stage 2 (Rooms 6-10)
    { id: 'star_mine', name: '星岩爆破', light: true, skyTop: '#F7EEFF', skyBot: '#DEC8FA', grid: 'rgba(145,105,205,.22)', body0: '#9A78C8', body1: '#684898', lip: '#FFE498', lipHi: '#FFF8DC', ink: '#2B1848', accent: '#C884FF', cloud: 'rgba(255,255,255,.82)', shadow: 'rgba(65,30,110,.28)', vignette: 'rgba(85,40,140,.25)', deco: 'crystal' },
    { id: 'glacier', name: '冰渊浮渡', light: true, skyTop: '#E4FAFF', skyBot: '#9EE2F8', grid: 'rgba(70,155,195,.22)', body0: '#589EC8', body1: '#326A94', lip: '#C8FAFF', lipHi: '#F4FFFF', ink: '#10324A', accent: '#45E0FF', cloud: 'rgba(255,255,255,.86)', shadow: 'rgba(15,65,105,.28)', vignette: 'rgba(18,85,135,.26)', deco: 'ice' },
    { id: 'rose_spires', name: '绝壁双塔', light: true, skyTop: '#FFF0EC', skyBot: '#FFC8BC', grid: 'rgba(215,115,105,.22)', body0: '#D87C78', body1: '#A24848', lip: '#FFE0D8', lipHi: '#FFF6F2', ink: '#481818', accent: '#FF7888', cloud: 'rgba(255,255,255,.82)', shadow: 'rgba(110,35,35,.28)', vignette: 'rgba(145,45,50,.24)', deco: 'candy' },
    { id: 'aurora', name: '翡翠云梯', light: true, skyTop: '#E8FFF8', skyBot: '#A8F0DC', grid: 'rgba(65,175,145,.22)', body0: '#4CB89E', body1: '#28826E', lip: '#C8FFEE', lipHi: '#F2FFFA', ink: '#0E382E', accent: '#48F0C8', cloud: 'rgba(255,255,255,.84)', shadow: 'rgba(16,80,68,.28)', vignette: 'rgba(20,105,88,.24)', deco: 'leaf', rainbow: true },
    { id: 'crystal_core', name: '终焉晶核', light: false, skyTop: '#16243E', skyBot: '#091020', grid: 'rgba(70,165,220,.20)', body0: '#2E4E72', body1: '#182A42', lip: '#64C8F0', lipHi: '#B8F2FF', ink: '#050B14', accent: '#58E4FF', cloud: 'rgba(100,220,255,.12)', shadow: 'rgba(0,0,0,.48)', vignette: 'rgba(0,8,24,.52)', deco: 'crystal' }
  ];
  const themeFor = (levelIndex) => THEMES[Math.max(0, Math.min(THEMES.length - 1, levelIndex | 0))];

  /* ---------------- buddy (droplet mochi) ---------------- */
  // x,y = centre of the base (feet).  s = half width.  pal = BUDDY_TYPES entry.
  // o: sx, sy (squash about the feet), rot, alpha, eyes, mouth, cheeks, look
  function drawBuddy(ctx, x, y, s, pal, o = {}) {
    const sx = o.sx || 1, sy = o.sy || 1;
    const hi = pal.hi || pal.highlight;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
    // body
    dropletPath(ctx, x, y, s, sx, sy);
    const g = ctx.createLinearGradient(x, y - 2 * s * sy, x, y);
    g.addColorStop(0, hi); g.addColorStop(.45, pal.color); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.fill();
    // soft bounce light on the belly so the jelly feels translucent
    ctx.save(); dropletPath(ctx, x, y, s, sx, sy); ctx.clip();
    const rg = ctx.createRadialGradient(x, y - s * .15 * sy, s * .05, x, y - s * .15 * sy, s * 1.05 * sx);
    rg.addColorStop(0, 'rgba(255,255,255,.30)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - s * 1.4, y - s * 2.2 * sy, s * 2.8, s * 2.4 * sy);
    ctx.restore();
    // outline
    ctx.lineWidth = Math.max(.9, s * .085); ctx.strokeStyle = o.outline || INK; ctx.lineJoin = 'round';
    dropletPath(ctx, x, y, s, sx, sy); ctx.stroke();
    // gloss
    ctx.save(); dropletPath(ctx, x, y, s, sx, sy); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.ellipse(x - s * .55 * sx, y - s * 1.22 * sy, s * .11 * sx, s * .26 * sy, .5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.arc(x - s * .42 * sx, y - s * .86 * sy, s * .05, 0, TAU); ctx.fill();
    ctx.restore();
    // face
    const look = (o.look || 0) * s * .1;
    const ey = y - s * .78 * sy, ex = s * .36 * sx, er = s * .13;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = s * .075;
    const eyes = o.eyes || 'open';
    for (const side of [-1, 1]) {
      const cx = x + side * ex + look;
      if (eyes === 'open') {
        ctx.beginPath(); ctx.ellipse(cx, ey, er, er * 1.08, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - er * .35, ey - er * .38, er * .36, 0, TAU); ctx.fill(); ctx.fillStyle = INK;
      } else if (eyes === 'happy') {
        ctx.beginPath(); ctx.arc(cx, ey + er * .4, er * .9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (eyes === 'squint') {
        ctx.beginPath(); ctx.moveTo(cx - side * er * .9, ey - er * .8); ctx.lineTo(cx + side * er * .5, ey); ctx.lineTo(cx - side * er * .9, ey + er * .8); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(cx - er, ey); ctx.lineTo(cx + er, ey); ctx.stroke();
      }
    }
    const ch = 1 + (o.cheeks || 0) * .9;
    ctx.fillStyle = hexA(pal.blush, .55);
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + side * s * .62 * sx + look, y - s * .56 * sy, s * .17 * ch, s * .11 * ch, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = INK;
    const my = y - s * .6 * sy;
    if (o.mouth === 'o') { ctx.beginPath(); ctx.ellipse(x + look, my, s * .13, s * .15, 0, 0, TAU); ctx.fill(); }
    else if (o.mouth === 'flat') { ctx.beginPath(); ctx.moveTo(x - s * .1 + look, my); ctx.lineTo(x + s * .1 + look, my); ctx.stroke(); }
    else if (o.mouth === 'puff') { ctx.beginPath(); ctx.arc(x + look, my, s * .05, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x + look, my - s * .1, s * .17, Math.PI * .2, Math.PI * .8); ctx.stroke(); }
    ctx.restore();
  }

  function drawShadow(ctx, x, groundY, w, a, th) {
    if (a <= 0.02) return;
    ctx.save();
    ctx.globalAlpha *= clamp(a);
    ctx.fillStyle = th ? th.shadow : 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(x, groundY + .4, w, Math.max(1.1, w * .2), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- bubbles ---------------- */
  function bubbleIcon(ctx, type, r, t, tint) {
    const u = r / 12;
    ctx.save(); ctx.scale(u, u);
    if (type === 'SOLID') {
      const g = ctx.createLinearGradient(0, -4, 0, 4); g.addColorStop(0, '#FFF0A0'); g.addColorStop(1, '#E0A010');
      rr(ctx, -3.9, -3.9, 7.8, 7.8, 1.9); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = .9; ctx.strokeStyle = '#7A4A08'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-2.7, -2.7, 2.6, .9); ctx.fillRect(-2.7, -2.7, .9, 2.6);
    } else if (type === 'FLOAT') {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.6;
      const ph = (t * 1.6) % 1;
      for (let k = 0; k < 2; k++) {
        const q = (ph + k * .5) % 1, yy = 4 - q * 8, a = Math.sin(q * Math.PI);
        ctx.globalAlpha = a; ctx.strokeStyle = '#2E86D8';
        ctx.beginPath(); ctx.moveTo(-3.6, yy + 1.8); ctx.lineTo(0, yy - 1.8); ctx.lineTo(3.6, yy + 1.8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (type === 'STICKY') {
      ctx.fillStyle = '#FF6FA0'; ctx.strokeStyle = '#8A1E4E'; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.arc(0, -.8, 3.7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(1.6, 3.6 + Math.sin(t * 5) * .4, 1.2, 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-1.8, 3.2, 1, 1.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(-1.2, -2.2, .9, 0, TAU); ctx.fill();
    } else if (type === 'BOUNCY') {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.7; ctx.strokeStyle = '#168A55';
      const sq = 1 + Math.sin(t * 7) * .12;
      ctx.beginPath(); ctx.moveTo(-3.6, 4.4);
      for (let i = 0; i < 5; i++) ctx.lineTo(i % 2 ? -3.6 : 3.6, 4.4 - (i + 1) * 1.7 * sq);
      ctx.stroke();
      ctx.fillStyle = '#70F0B0'; ctx.strokeStyle = '#168A55'; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.ellipse(0, 4.4 - 5 * 1.7 * sq - 1, 4.4, 1.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (type === 'CHAIN_POP') {
      const pulse = 1 + Math.sin(t * 9) * .12;
      star4(ctx, 0, 0, 5.2 * pulse, t * .8, .42);
      const g = ctx.createRadialGradient(0, 0, .5, 0, 0, 5.4); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#A864FF');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = .9; ctx.strokeStyle = '#4A1A8A'; ctx.stroke();
    }
    ctx.restore();
  }
  // x,y centre, r radius. o: tint, rim, type, t, sx, sy, alpha, noGlow
  function drawBubble(ctx, x, y, r, o = {}) {
    const tint = o.tint || '#75C8F8';
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y); ctx.scale(o.sx || 1, o.sy || 1);
    if (!o.noGlow) {
      const gl = ctx.createRadialGradient(0, 0, r * .85, 0, 0, r * 1.45);
      gl.addColorStop(0, hexA(tint, .26)); gl.addColorStop(1, hexA(tint, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, TAU); ctx.fill();
    }
    const g = ctx.createRadialGradient(-r * .3, -r * .35, r * .08, 0, 0, r);
    const kk = Math.min(1, Math.pow(15 / r, 2)); // big bubbles (boss) keep their contents readable
    g.addColorStop(0, `rgba(255,255,255,${.40 * kk})`); g.addColorStop(.55, hexA(tint, .07 * kk)); g.addColorStop(1, hexA(tint, .50));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(.9, r * .075); ctx.strokeStyle = hexA(o.rim || tint, .96); ctx.stroke();
    ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(255,255,255,.40)';
    ctx.beginPath(); ctx.arc(0, 0, r * .86, 0, TAU); ctx.stroke();
    if (o.type) bubbleIcon(ctx, o.type, r, o.t || 0, tint);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(.9, r * .09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * .72, Math.PI * 1.12, Math.PI * 1.46); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(r * .46, r * .42, r * .07, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- enemies ---------------- */
  // Sludge Titan (Stage 1) & Frost-Crystal Golem (Stage 2). x,y = body centre, R = horizontal radius
  function drawBoss(ctx, x, y, R, t, o = {}) {
    const rage = !!o.rage, facing = o.facing || 1;
    const isCrystal = o.variant === 'CRYSTAL';
    ctx.save();
    ctx.translate(x, y); ctx.scale(o.sx || 1, o.sy || 1);
    if (isCrystal) {
      // Orbiting crystal crown spikes
      ctx.fillStyle = rage ? '#FF5898' : '#58E4FF';
      ctx.strokeStyle = '#08182C';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + t * 1.1;
        const rr2 = R * (1.04 + .06 * Math.sin(t * 4 + i));
        const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2 * .85;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * R * .22, py + Math.sin(a) * R * .22);
        ctx.lineTo(px + Math.cos(a + 1.2) * R * .12, py + Math.sin(a + 1.2) * R * .12);
        ctx.lineTo(px + Math.cos(a - 1.2) * R * .12, py + Math.sin(a - 1.2) * R * .12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // tendril bumps
      ctx.fillStyle = rage ? '#5A1846' : '#3A1C55';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + t * .8, rr2 = R * (1.0 + .04 * Math.sin(t * 3 + i));
        ctx.beginPath(); ctx.arc(Math.cos(a) * rr2, Math.sin(a) * rr2 * .85, R * .17, 0, TAU); ctx.fill();
      }
    }
    // wobbling body
    ctx.beginPath();
    for (let i = 0; i <= 56; i++) {
      const a = i / 56 * TAU;
      const r = R * (1 + .05 * Math.sin(5 * a + t * 3) + .03 * Math.sin(9 * a - t * 5));
      const px = Math.cos(a) * r, py = Math.sin(a) * r * .85;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R * 1.1);
    if (isCrystal) {
      g.addColorStop(0, rage ? '#FF78B8' : '#78F0FF');
      g.addColorStop(0.55, rage ? '#7A2068' : '#2668A8');
      g.addColorStop(1, rage ? '#280828' : '#0E2240');
    } else {
      g.addColorStop(0, rage ? '#7A2A70' : '#4A2669');
      g.addColorStop(1, rage ? '#2A0A26' : '#1A0B27');
    }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, R * .05); ctx.strokeStyle = '#0A0510'; ctx.lineJoin = 'round'; ctx.stroke();
    if (o.flash) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; ctx.fill(); }
    // slime gloss
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.beginPath(); ctx.ellipse(-R * .38, -R * .5, R * .2, R * .11, -.5, 0, TAU); ctx.fill();
    ctx.restore();
    // glowing eyes
    const er = R * (rage ? .14 : .12), ex = R * .27, ey = -R * .1, shift = facing * R * .05;
    for (const s of [-1, 1]) {
      const cx = s * ex + shift;
      const gl = ctx.createRadialGradient(cx, ey, 0, cx, ey, er * 3.2);
      gl.addColorStop(0, `rgba(255,45,74,${rage ? .7 : .5})`); gl.addColorStop(1, 'rgba(255,45,74,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, ey, er * 3.2, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#FF3B4E';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * ex + shift, ey, er, er * .8, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#FFE1E5';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + shift - er * .3, ey - er * .3, er * .3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#16000A';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * ex + shift + facing * er * .3, ey + er * .05, er * .32, 0, TAU); ctx.fill(); }
    if (rage) {
      ctx.strokeStyle = '#0A0510'; ctx.lineWidth = Math.max(1, R * .05); ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * R * .45 + shift, -R * .32); ctx.lineTo(s * R * .12 + shift, -R * .2); ctx.stroke(); }
    }
    // mouth
    const my = R * .28;
    if (o.charge) {
      const gl = ctx.createRadialGradient(facing * R * .1, my, 0, facing * R * .1, my, R * .4);
      gl.addColorStop(0, 'rgba(255,60,110,.95)'); gl.addColorStop(1, 'rgba(255,30,80,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(facing * R * .1, my, R * .4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#16000A'; ctx.beginPath(); ctx.ellipse(facing * R * .1, my, R * .2, R * .13, 0, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = '#0A0510'; ctx.lineWidth = Math.max(.9, R * .045); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-R * .24, my);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-R * .24 + i * R * .08, my + (i % 2 ? R * .05 : -R * .02));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Sludge creep (small).  x = centre, feetY = ground contact
  function drawCreep(ctx, x, feetY, R, t, o = {}) {
    const ph = o.phase || 0;
    const sq = 1 + .1 * Math.sin(t * 7 + ph);
    const sx = 1 / Math.sqrt(sq), sy = sq;
    const cy = feetY - R * .82 * sy;
    ctx.save(); ctx.translate(x, cy); ctx.scale(sx, sy);
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = i / 28 * TAU, r = R * (1 + .06 * Math.sin(4 * a + t * 4 + ph));
      const px = Math.cos(a) * r, py = Math.sin(a) * r * .82;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-R * .3, -R * .4, R * .1, 0, 0, R * 1.15);
    g.addColorStop(0, '#7A7096'); g.addColorStop(1, '#2E2840');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(.9, R * .11); ctx.strokeStyle = '#120D1C'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-R * .38, -R * .5, R * .22, R * .12, -.5, 0, TAU); ctx.fill();
    // angry eyes
    const f = o.facing || 1;
    for (const s of [-1, 1]) {
      const cx = s * R * .36 + f * R * .08;
      ctx.fillStyle = '#FFF4F4'; ctx.beginPath(); ctx.ellipse(cx, -R * .08, R * .24, R * .27, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FF2040'; ctx.beginPath(); ctx.arc(cx + f * R * .07, -R * .04, R * .15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#220008'; ctx.beginPath(); ctx.arc(cx + f * R * .09, -R * .04, R * .07, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#120D1C'; ctx.lineWidth = Math.max(.9, R * .12); ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * R * .62, -R * .46); ctx.lineTo(s * R * .12, -R * .24); ctx.stroke(); }
    ctx.restore();
  }

  function drawProjectile(ctx, p, t) {
    const ang = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
    const st = 1 + clamp(sp / 260) * .6;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius * 2.6);
    gl.addColorStop(0, 'rgba(176,96,255,.55)'); gl.addColorStop(1, 'rgba(176,96,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, p.radius * 2.6, 0, TAU); ctx.fill();
    const pulse = 1 + .08 * Math.sin(t * 24);
    ctx.scale(st * pulse, 1 / Math.sqrt(st));
    const g = ctx.createRadialGradient(-p.radius * .3, -p.radius * .3, 0, 0, 0, p.radius);
    g.addColorStop(0, '#C070FF'); g.addColorStop(1, '#3A104C');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, TAU); ctx.fill();
    ctx.lineWidth = .9; ctx.strokeStyle = '#120420'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(-p.radius * .35, -p.radius * .35, p.radius * .22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawShockwave(ctx, sw, t) {
    const lr = clamp(sw.life / 1.5);
    const w = sw.width * 1.5, h = sw.height * 1.3;
    ctx.save(); ctx.translate(sw.x, sw.y); ctx.globalAlpha *= clamp(lr * 2.2);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
    gl.addColorStop(0, 'rgba(255,59,107,.55)'); gl.addColorStop(1, 'rgba(185,140,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(0, 0, w, h * 1.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#50146E'; ctx.beginPath(); ctx.ellipse(0, 0, w * .55, h * .5, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#C86CFF'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.ellipse(-sw.dir * w * .12, -h * .12, w * .3, h * .2, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- pickups ---------------- */
  function drawDew(ctx, x, y, t, ph) {
    const bob = Math.sin(ph) * 2.2;
    const pulse = .75 + .25 * Math.sin(ph * 1.3);
    ctx.save(); ctx.translate(x, y + bob);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
    gl.addColorStop(0, `rgba(80,230,255,${.45 * pulse})`); gl.addColorStop(1, 'rgba(80,230,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    const sq = 1 + .06 * Math.sin(ph * 2);
    dropletPath(ctx, 0, 4.2, 3.5, 1 / Math.sqrt(sq), sq);
    const g = ctx.createLinearGradient(0, -4, 0, 4.2);
    g.addColorStop(0, '#D6FDFF'); g.addColorStop(.5, '#3FDCFF'); g.addColorStop(1, '#0B86C8');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = .8; ctx.strokeStyle = '#08507C'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-1.2, 0, .7, 1.5, .4, 0, TAU); ctx.fill();
    const tw = Math.max(0, Math.sin(ph * 1.7));
    if (tw > .05) { ctx.fillStyle = `rgba(255,255,255,${tw})`; star4(ctx, 4.2, -3.6, 2.6 * tw + .6, 0, .25); ctx.fill(); }
    ctx.restore();
  }

  function drawGoal(ctx, tx, ty, t, open) {
    const cx = tx + 10, base = ty + 20;
    ctx.save();
    // rainbow halo
    const hl = ctx.createRadialGradient(cx, ty + 8, 2, cx, ty + 8, 24);
    hl.addColorStop(0, `rgba(255,236,150,${.55 + .15 * Math.sin(t * 3)})`); hl.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(cx, ty + 8, 24, 0, TAU); ctx.fill();
    // little rainbow
    const cols = ['#FF5F7E', '#FF9F4A', '#FFE14A', '#4ADB8A', '#4AB4FF', '#A878FF'];
    ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(cx, base - 4, 11 - i * 1.1, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); });
    ctx.globalAlpha = 1;
    // fountain jets
    for (let k = 0; k < 7; k++) {
      const q = ((t * 1.3 + k / 7) % 1), dir = (k % 3 - 1);
      const px = cx + dir * 4.4 * q, py = base - 6 - Math.sin(q * Math.PI) * (9 + (k % 2) * 3);
      ctx.fillStyle = `rgba(110,235,255,${.95 - q * .6})`;
      ctx.beginPath(); ctx.arc(px, py, 1.15 + (1 - q) * .5, 0, TAU); ctx.fill();
    }
    // basin
    const g = ctx.createLinearGradient(0, base - 9, 0, base);
    g.addColorStop(0, '#FFE680'); g.addColorStop(1, '#D89C20');
    ctx.beginPath(); ctx.moveTo(tx + 2.5, base - 9); ctx.lineTo(tx + 17.5, base - 9); ctx.lineTo(tx + 15, base - .5); ctx.lineTo(tx + 5, base - .5); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#6A420A'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = '#45D2FF'; ctx.beginPath(); ctx.ellipse(cx, base - 9, 7.5, 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(cx - 2, base - 9.4, 2.4, .6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------- particles & rings ---------------- */
  function drawParticle(ctx, p) {
    const lr = clamp(p.life / p.maxLife);
    ctx.save();
    if (p.kind === 'dust') {
      const r = p.radius * (1 + (1 - lr) * 1.5);
      ctx.globalAlpha = lr * .5; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = lr; ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(.6, p.radius * .55); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .05, p.y - p.vy * .05); ctx.stroke();
    } else if (p.kind === 'star') {
      ctx.globalAlpha = lr; ctx.fillStyle = p.color;
      star4(ctx, p.x, p.y, p.radius * (.6 + lr * .8), p.life * 6, .3); ctx.fill();
    } else {
      const r = p.radius * (.35 + .65 * lr);
      const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      gl.addColorStop(0, hexA(p.color, .35 * lr)); gl.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = Math.min(1, lr * 1.8); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(p.x - r * .3, p.y - r * .3, r * .35, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function drawRing(ctx, f) {
    const lr = clamp(f.life / f.maxLife), r = lerp(f.r0, f.r1, outCubic(1 - lr));
    ctx.save();
    ctx.globalAlpha = lr * .9; ctx.strokeStyle = f.color; ctx.lineWidth = Math.max(.4, f.lw * lr);
    ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * (f.flat || 1), 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- map: tile layer, backdrop, ambience ---------------- */
  function tuft(g, x, y, col, ink, h) {
    g.beginPath(); g.moveTo(x - 2.4, y);
    g.quadraticCurveTo(x - 2.6, y - h * .7, x - 3.6, y - h);
    g.quadraticCurveTo(x - 1, y - h * .55, x, y - h * .35);
    g.quadraticCurveTo(x + .6, y - h * .9, x + 1.8, y - h * 1.15);
    g.quadraticCurveTo(x + 1.6, y - h * .5, x + 2.4, y);
    g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = .6; g.strokeStyle = ink; g.lineJoin = 'round'; g.stroke();
  }
  function flower(g, x, y, petal, ink) {
    g.strokeStyle = '#3C8A4A'; g.lineWidth = .8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4.6); g.stroke();
    g.fillStyle = petal; g.lineWidth = .5; g.strokeStyle = ink;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(x + Math.cos(a) * 1.5, y - 5.2 + Math.sin(a) * 1.5, 1.15, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#FFD454'; g.beginPath(); g.arc(x, y - 5.2, .95, 0, TAU); g.fill();
  }
  function decorate(g, th, x, y, h1, h2) {
    switch (th.deco) {
      case 'meadow':
        if (h1 < .5) tuft(g, x, y, '#4DBE78', th.ink, 4.4 + h2 * 2);
        else flower(g, x, y, ['#FF8CB8', '#FFF4A8', '#FFFFFF', '#B898EC'][Math.floor(h2 * 4) % 4], th.ink);
        break;
      case 'ice': {
        g.fillStyle = '#E6F8FF'; g.strokeStyle = th.ink; g.lineWidth = .6; g.lineJoin = 'round';
        const hh = 4 + h2 * 3;
        g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x - .4, y - hh); g.lineTo(x + 1.2, y); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(x + .8, y); g.lineTo(x + 2.4, y - hh * .65); g.lineTo(x + 3.8, y); g.closePath(); g.fill(); g.stroke();
        break;
      }
      case 'candy': {
        const col = ['#FF6FA0', '#FFD454', '#8CE0C0', '#B898EC'][Math.floor(h2 * 4) % 4];
        g.fillStyle = col; g.strokeStyle = th.ink; g.lineWidth = .6;
        g.beginPath(); g.arc(x, y, 3, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x - 1, y - 1.5, .5, 0, TAU); g.arc(x + 1, y - 1, .5, 0, TAU); g.fill();
        break;
      }
      case 'leaf': {
        g.fillStyle = '#7FE0A8'; g.strokeStyle = th.ink; g.lineWidth = .6;
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * 2, y - 2.4, 2.8, 1.5, s * -.7, 0, TAU); g.fill(); g.stroke(); }
        g.strokeStyle = '#2E7A52'; g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 2.4); g.stroke();
        break;
      }
      case 'crystal': {
        const hh = 5 + h2 * 5;
        g.lineJoin = 'round'; g.lineWidth = .7; g.strokeStyle = th.ink;
        const gr = g.createLinearGradient(0, y - hh, 0, y); gr.addColorStop(0, '#E4D0FF'); gr.addColorStop(1, '#7A4AC8');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - 2.2, y); g.lineTo(x - .6, y - hh); g.lineTo(x + 1.6, y - hh * .25); g.lineTo(x + 2.4, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x - 1.4, y - 1); g.lineTo(x - .6, y - hh * .8); g.lineTo(x - .1, y - 1); g.closePath(); g.fill();
        break;
      }
    }
  }

  function buildTileLayer(grid, th, S) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(320 * S); cv.height = Math.round(240 * S);
    const g = cv.getContext('2d');
    g.scale(S, S);
    const T = 20, R = grid.length, C = grid[0].length;
    const at = (r, c) => (r < 0 || r >= R || c < 0 || c >= C) ? T_SOLID : grid[r][c];
    const blk = (r, c) => { const t = at(r, c); return t === T_SOLID || t === T_CRACKED; };

    // 1. merged body of all solid terrain (one gradient so walls never look like a grid)
    g.beginPath();
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] === T_SOLID) g.rect(c * T, r * T, T, T);
    const bg = g.createLinearGradient(0, 0, 0, 240); bg.addColorStop(0, th.body0); bg.addColorStop(1, th.body1);
    g.fillStyle = bg; g.fill();

    // 2. pebbles + exposed-edge shading
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (grid[r][c] !== T_SOLID) continue;
      const x = c * T, y = r * T, h1 = hash2(r + 11, c + 3), h2 = hash2(c + 29, r + 7);
      g.fillStyle = 'rgba(255,255,255,.13)';
      g.beginPath(); g.ellipse(x + 4 + h1 * 12, y + 6 + h2 * 9, 1.8 + h2, 1.1 + h1, h1 * 3, 0, TAU); g.fill();
      g.fillStyle = 'rgba(0,0,0,.11)';
      g.beginPath(); g.ellipse(x + 15 - h2 * 10, y + 13 + h1 * 4, 1.5 + h1, 1 + h2 * .8, h2 * 3, 0, TAU); g.fill();
      if (!blk(r + 1, c)) { const sh = g.createLinearGradient(0, y + T - 5, 0, y + T); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.30)'); g.fillStyle = sh; g.fillRect(x, y + T - 5, T, 5); }
      if (!blk(r, c - 1)) { const sh = g.createLinearGradient(x, 0, x + 4, 0); sh.addColorStop(0, 'rgba(255,255,255,.20)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(x, y, 4, T); }
      if (!blk(r, c + 1)) { const sh = g.createLinearGradient(x + T - 4, 0, x + T, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = sh; g.fillRect(x + T - 4, y, 4, T); }
    }

    // 3. frosting lip along every exposed top edge (continuous scalloped runs)
    for (let r = 0; r < R; r++) {
      let c = 0;
      while (c < C) {
        if (blk(r, c) && !blk(r - 1, c)) {
          let c1 = c; while (c1 + 1 < C && blk(r, c1 + 1) && !blk(r - 1, c1 + 1)) c1++;
          const x0 = c * T, x1 = (c1 + 1) * T, y = r * T;
          g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y);
          for (let x = x1; x >= x0; x -= 2) g.lineTo(x, y + 4.2 + 1.7 * Math.sin(x * .85 + r));
          g.closePath(); g.fillStyle = th.lip; g.fill();
          g.fillStyle = th.lipHi; g.fillRect(x0 + 1, y + .8, x1 - x0 - 2, 1);
          c = c1 + 1;
        } else c++;
      }
    }

    // 4. ink outline on every exposed edge
    g.beginPath();
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!blk(r, c)) continue;
      const x = c * T, y = r * T;
      if (!blk(r - 1, c)) { g.moveTo(x, y); g.lineTo(x + T, y); }
      if (!blk(r + 1, c)) { g.moveTo(x, y + T); g.lineTo(x + T, y + T); }
      if (!blk(r, c - 1)) { g.moveTo(x, y); g.lineTo(x, y + T); }
      if (!blk(r, c + 1)) { g.moveTo(x + T, y); g.lineTo(x + T, y + T); }
    }
    g.lineWidth = 1.5; g.strokeStyle = th.ink; g.lineCap = 'round'; g.stroke();

    // 5. decorations on tops (and dripping slime under dusk ceilings)
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (grid[r][c] !== T_SOLID) continue;
      const x = c * T, y = r * T, h1 = hash2(r * 5 + 1, c * 7 + 2), h2 = hash2(c * 13 + 5, r * 3 + 9);
      if (!blk(r - 1, c) && at(r - 1, c) === T_AIR && h1 < .62 && c > 0 && c < C - 1) decorate(g, th, x + 4 + h2 * 12, y + .4, h1 * 1.6, h2);
      if (th.deco === 'crystal' && !blk(r + 1, c) && at(r + 1, c) === T_AIR && h2 < .45) {
        const dx = x + 5 + h1 * 10, dl = 3 + h2 * 5;
        g.fillStyle = '#7A4AC8'; g.strokeStyle = th.ink; g.lineWidth = .6; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(dx - 1.8, y + T); g.quadraticCurveTo(dx - 1.6, y + T + dl * .6, dx, y + T + dl); g.quadraticCurveTo(dx + 1.6, y + T + dl * .6, dx + 1.8, y + T); g.closePath(); g.fill(); g.stroke();
      }
    }

    // 6. special tiles
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const t = grid[r][c], x = c * T, y = r * T;
      if (t === T_SPIKE) {
        g.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const sx0 = x + k * (T / 3), sw = T / 3;
          const sg = g.createLinearGradient(0, y + 6, 0, y + T);
          sg.addColorStop(0, '#FF8A9A'); sg.addColorStop(1, '#C0173A');
          g.beginPath(); g.moveTo(sx0 + .3, y + T); g.lineTo(sx0 + sw / 2, y + 5.5 + (k % 2) * 1.2); g.lineTo(sx0 + sw - .3, y + T); g.closePath();
          g.fillStyle = sg; g.fill(); g.lineWidth = .9; g.strokeStyle = '#3A0814'; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = .6; g.beginPath(); g.moveTo(sx0 + sw * .38, y + T - 3); g.lineTo(sx0 + sw * .5, y + 8 + (k % 2) * 1.2); g.stroke();
        }
      } else if (t === T_CRAWLWAY) {
        g.save(); rr(g, x + .5, y, T - 1, 9, 2.5); g.clip();
        g.fillStyle = '#FFD454'; g.fillRect(x, y, T, 9);
        g.fillStyle = th.ink;
        for (let k = -2; k < 6; k++) { g.beginPath(); g.moveTo(x + k * 5, y + 9); g.lineTo(x + k * 5 + 3, y + 9); g.lineTo(x + k * 5 + 8, y); g.lineTo(x + k * 5 + 5, y); g.closePath(); g.fill(); }
        g.restore();
        rr(g, x + .5, y, T - 1, 9, 2.5); g.lineWidth = 1.2; g.strokeStyle = th.ink; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 2, y + 1.3, T - 4, .8);
      } else if (t === T_GATE) {
        const gg = g.createLinearGradient(x, 0, x + T, 0); gg.addColorStop(0, '#6A4028'); gg.addColorStop(.5, '#A8703C'); gg.addColorStop(1, '#5A3520');
        rr(g, x + 2.5, y, T - 5, T, 2.5); g.fillStyle = gg; g.fill(); g.lineWidth = 1.3; g.strokeStyle = th.ink; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .8;
        for (const px of [x + 7, x + 13]) { g.beginPath(); g.moveTo(px, y + 1.5); g.lineTo(px, y + T - 1.5); g.stroke(); }
        g.fillStyle = '#FFD454'; g.strokeStyle = '#6A420A'; g.lineWidth = .9;
        g.beginPath(); g.arc(x + 10, y + 10, 3.6, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#3A2410'; g.beginPath(); g.arc(x + 10, y + 9.2, 1, 0, TAU); g.fill(); g.fillRect(x + 9.4, y + 9.4, 1.2, 3);
      } else if (t === T_CRACKED) {
        const cg = g.createLinearGradient(0, y, 0, y + T); cg.addColorStop(0, '#CDB48E'); cg.addColorStop(1, '#9C8460');
        rr(g, x + .8, y + .8, T - 1.6, T - 1.6, 3); g.fillStyle = cg; g.fill(); g.lineWidth = 1.3; g.strokeStyle = th.ink; g.stroke();
        g.strokeStyle = '#4A3A22'; g.lineWidth = .9; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(x + 11, y + 1.5); g.lineTo(x + 8, y + 7); g.lineTo(x + 12.5, y + 11); g.lineTo(x + 9, y + 18); g.stroke();
        g.beginPath(); g.moveTo(x + 8, y + 7); g.lineTo(x + 3.5, y + 9); g.moveTo(x + 12.5, y + 11); g.lineTo(x + 17, y + 13); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3, y + 3, 3, 1);
      }
    }
    return cv;
  }

  function buildBackdrop(th, S) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(320 * S); cv.height = Math.round(240 * S);
    const g = cv.getContext('2d'); g.scale(S, S);
    const sky = g.createLinearGradient(0, 0, 0, 240); sky.addColorStop(0, th.skyTop); sky.addColorStop(1, th.skyBot);
    g.fillStyle = sky; g.fillRect(0, 0, 320, 240);
    if (th.rainbow) {
      const cols = ['#FF5F7E', '#FF9F4A', '#FFE14A', '#4ADB8A', '#4AB4FF', '#A878FF'];
      g.lineWidth = 5; cols.forEach((c, i) => { g.strokeStyle = hexA(c, .30); g.beginPath(); g.arc(210, 236, 120 - i * 5, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); });
    }
    if (!th.light) {
      const gl = g.createRadialGradient(240, 150, 20, 240, 150, 190); gl.addColorStop(0, 'rgba(120,40,160,.38)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl; g.fillRect(0, 0, 320, 240);
    }
    g.strokeStyle = th.grid; g.lineWidth = .6;
    g.beginPath();
    for (let x = 0; x <= 320; x += 20) { g.moveTo(x, 0); g.lineTo(x, 240); }
    for (let y = 0; y <= 240; y += 20) { g.moveTo(0, y); g.lineTo(320, y); }
    g.stroke();
    return cv;
  }
  function buildVignette(th, S) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(320 * S); cv.height = Math.round(240 * S);
    const g = cv.getContext('2d'); g.scale(S, S);
    const v = g.createRadialGradient(160, 120, 90, 160, 120, 215);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, th.vignette);
    g.fillStyle = v; g.fillRect(0, 0, 320, 240);
    return cv;
  }

  function cloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 7 * s, 0, TAU); ctx.arc(x + 9 * s, y - 4 * s, 9 * s, 0, TAU); ctx.arc(x + 19 * s, y, 7.5 * s, 0, TAU);
    ctx.rect(x, y, 19 * s, 7 * s);
    ctx.fill();
  }
  // moving ambience: drifting clouds + twinkles (light rooms) / rising spores (dusk room)
  function drawAmbient(ctx, th, t) {
    if (th.light) {
      const defs = [[0, 34, 1.0, 5], [110, 82, .75, 3.5], [200, 56, 1.2, 4.2], [260, 128, .6, 2.6]];
      for (const [x0, y, s, sp] of defs) {
        const x = ((x0 + t * sp) % 400) - 50;
        cloud(ctx, x, y, s, th.cloud);
      }
      for (let i = 0; i < 6; i++) {
        const x = 30 + hash2(i, 3) * 260, y = 20 + hash2(i, 9) * 190, a = Math.max(0, Math.sin(t * 1.6 + i * 1.7));
        if (a < .08) continue;
        ctx.fillStyle = `rgba(255,255,255,${a * .9})`; star4(ctx, x, y, 2.4 * a + .6, 0, .25); ctx.fill();
      }
    } else {
      for (let i = 0; i < 18; i++) {
        const sp = 5 + hash2(i, 1) * 9, x0 = hash2(i, 2) * 320, y0 = hash2(i, 5) * 260;
        const y = 250 - ((y0 + t * sp) % 270), x = x0 + Math.sin(t * .7 + i) * 6;
        const a = .15 + .35 * hash2(i, 8);
        ctx.fillStyle = `rgba(200,150,255,${a})`; ctx.beginPath(); ctx.arc(x, y, .7 + hash2(i, 4) * 1.5, 0, TAU); ctx.fill();
      }
    }
  }

  // Visual size of the buddy you control (every buddy is drawn equally big when selected)
  // and of the translucent after-images of the unselected ones.
  const ACTIVE_S = 12.5;
  const GHOST_S = 7.4;

  return {
    FONT, INK, TAU, ACTIVE_S, GHOST_S,
    clamp, lerp, seg, outCubic, outBack, spring, hash2, hexA, mixHex,
    rr, text, panel, heart, star4, dropIcon, dropletPath,
    THEMES, themeFor,
    drawBuddy, drawShadow, drawBubble, drawBoss, drawCreep, drawProjectile, drawShockwave,
    drawDew, drawGoal, drawParticle, drawRing,
    buildTileLayer, buildBackdrop, buildVignette, drawAmbient
  };
})();

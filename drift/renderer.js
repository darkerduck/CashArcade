/* Neon Drift — original, dependency-free aerial city renderer. */
(function (root) {
  'use strict';

  const W = 1000, H = 760;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const color = (hex, a) => {
    if (typeof hex !== 'string' || !/^#[\da-f]{6}$/i.test(hex)) return `rgba(93,236,235,${a})`;
    return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  };
  function random(seed) {
    let n = seed >>> 0;
    return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hash(s) { let n = 2166136261; for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; }
  function canvas() {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
    const c = document.createElement('canvas'); c.width = W; c.height = H; return c;
  }
  function rounded(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function path(ctx, points, closed = true) {
    if (!points.length) return;
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (closed) ctx.closePath();
  }
  function stroke(ctx, points, width, paint, closed = true) {
    path(ctx, points, closed); ctx.strokeStyle = paint; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  }
  function frame(points, i) {
    const n = points.length, index = (Math.floor(i) % n + n) % n;
    const p = points[index], prev = points[(index + n - 1) % n], next = points[(index + 1) % n];
    const dx = next.x - prev.x, dy = next.y - prev.y, len = Math.hypot(dx, dy) || 1;
    return { x: p.x, y: p.y, dx: dx / len, dy: dy / len, nx: -dy / len, ny: dx / len, angle: Math.atan2(dy, dx) };
  }
  function side(points, d) {
    let offset = points.map((p, i) => { const f = frame(points, i); return { x: p.x + f.nx * d, y: p.y + f.ny * d }; });
    // Remove local offset loops at very tight hairpins, like a round road join.
    for (let pass = 0; pass < 12; pass++) {
      let found = false;
      for (let i = 0; i < offset.length - 3 && !found; i++) {
        const a = offset[i], b = offset[i + 1], rx = b.x - a.x, ry = b.y - a.y;
        for (let j = i + 2; j < Math.min(offset.length - 1, i + 30); j++) {
          const c = offset[j], e = offset[j + 1], sx = e.x - c.x, sy = e.y - c.y;
          const denom = rx * sy - ry * sx;
          if (Math.abs(denom) < .000001) continue;
          const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
          const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
          if (t > 0 && t < 1 && u > 0 && u < 1) {
            offset.splice(i + 1, j - i, { x: a.x + rx * t, y: a.y + ry * t }); found = true; break;
          }
        }
      }
      if (!found) break;
    }
    return offset;
  }
  function distance(points, x, y) {
    let best = Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const a = points[i], b = points[(i + 2) % points.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const d = Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
      if (d < best) best = d;
    }
    return best;
  }
  function palette(track, light) {
    const name = `${track.id || ''} ${track.zone || ''} ${track.name || ''}`.toLowerCase();
    const harbor = /harbor|dock|port|bay|water/.test(name), gold = /gold|sun|desert|canyon|industrial|foundry|ridge/.test(name);
    const purple = /sky|zen|temple|violet|midnight|mountain/.test(name);
    const accent = /^#[\da-f]{6}$/i.test(track.color || '') ? track.color : harbor ? '#55e8e1' : gold ? '#ffd070' : purple ? '#ad91ff' : '#57eee1';
    return {
      light, harbor, gold, purple, accent,
      second: gold ? '#ff846e' : harbor ? '#55e8e1' : '#ff68ad',
      ground: light ? '#d9e4e8' : '#070e1b',
      blocks: light ? '#c8d6dc' : '#0d1929',
      roof: light ? '#b1c3cc' : '#122338',
      roofDark: light ? '#a2b8c3' : '#0c1727',
      outline: light ? '#96b1bc' : '#24374c',
      road: light ? '#435b6a' : '#152436',
      roadInner: light ? '#344b5b' : '#101e2f',
      ink: light ? '#334f61' : '#8da8bf',
      white: light ? '#dcebf2' : '#b9d7e6',
      shadow: light ? 'rgba(27,51,63,.17)' : 'rgba(0,2,10,.55)'
    };
  }

  class Renderer {
    constructor(target) {
      this.canvas = target;
      this.ctx = target.getContext('2d', { alpha: false });
      this.width = W; this.height = H;
      this.cache = null; this.cacheKey = ''; this.trackRef = null;
      this.trails = new Array(480); this.trailCursor = 0; this.lastTires = null;
      this.lastTime = 0; this.elapsed = 0; this.particles = [];
      this.rain = Array.from({ length: 78 }, (_, i) => { const r = random(i * 961 + 77); return { x: r() * W, y: r() * H, speed: 30 + r() * 42, len: 5 + r() * 11 }; });
      this.resize();
    }

    resize(width, height) {
      const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      const cssWidth = Number(width) || (rect && rect.width) || W;
      const cssHeight = Number(height) || (rect && rect.height) || cssWidth * H / W;
      const ratio = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
      const pw = Math.max(1, Math.round(cssWidth * ratio)), ph = Math.max(1, Math.round(cssHeight * ratio));
      if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
      this.width = pw; this.height = ph;
      return this;
    }

    prepare(track, theme) {
      const points = track.points;
      const key = `${track.id || track.name || ''}:${theme}:${points.length}:${track.width}`;
      if (this.cache && this.cacheKey === key && this.trackRef === track) return;
      this.cacheKey = key; this.trackRef = track;
      this.pal = palette(track, theme === 'light');
      this.half = (track.width || 110) / 2;
      this.outer = side(points, this.half); this.inner = side(points, -this.half);
      this.trails.fill(null); this.trailCursor = 0; this.lastTires = null; this.particles.length = 0;
      this.cache = canvas();
      const ctx = this.cache.getContext('2d'), p = this.pal;
      ctx.clearRect(0, 0, W, H);
      this.drawCity(ctx, track, p);
      this.drawRoad(ctx, track, p);
      this.drawTrackFurniture(ctx, track, p);
      this.drawStart(ctx, track, p);
    }

    drawCity(ctx, track, p) {
      const rng = random(hash(track.id || track.name || 'neon'));
      ctx.fillStyle = p.ground; ctx.fillRect(0, 0, W, H);
      const sky = ctx.createLinearGradient(0, 0, W, H);
      sky.addColorStop(0, color(p.accent, p.light ? .04 : .06)); sky.addColorStop(.5, 'rgba(0,0,0,0)'); sky.addColorStop(1, color(p.second, p.light ? .055 : .075));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // Quiet underlying street grid gives the circuit a lived-in district.
      ctx.lineWidth = 15; ctx.strokeStyle = p.light ? '#d0dee3' : '#0c1725'; ctx.beginPath();
      for (let x = 18; x < W; x += 104) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 32; y < H; y += 92) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.setLineDash([2, 10]); ctx.lineWidth = .7; ctx.strokeStyle = p.light ? '#aec2cb' : '#233247'; ctx.stroke(); ctx.setLineDash([]);
      if (p.harbor) {
        const water = ctx.createLinearGradient(0, H - 105, W, H);
        water.addColorStop(0, p.light ? '#91c4cc' : '#0b2836'); water.addColorStop(1, p.light ? '#abcdd4' : '#102338');
        ctx.fillStyle = water; ctx.fillRect(0, H - 72, W, 72);
        for (let y = H - 61; y < H; y += 11) { ctx.strokeStyle = color(p.accent, .12); ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y - 11); ctx.stroke(); }
        ctx.fillStyle = p.light ? '#90aeb8' : '#273548'; ctx.fillRect(0, H - 76, W, 4);
      }
      // Buildings are culled against the actual circuit, not a hard-coded map.
      for (let gy = -12; gy < H; gy += 67) for (let gx = -6; gx < W; gx += 78) {
        const bw = 31 + rng() * 31, bh = 28 + rng() * 25;
        const x = gx + rng() * 14, y = gy + rng() * 12;
        if (distance(track.points, x + bw / 2, y + bh / 2) < this.half + Math.hypot(bw, bh) / 2 + 18) continue;
        if (p.harbor && y + bh > H - 78) continue;
        const tall = rng() > .52;
        ctx.fillStyle = p.shadow; rounded(ctx, x + 7, y + 10, bw + 1, bh + 1, 2); ctx.fill();
        ctx.fillStyle = tall ? p.roof : p.roofDark; rounded(ctx, x, y, bw, bh, 2); ctx.fill();
        ctx.strokeStyle = p.outline; ctx.lineWidth = .8; ctx.stroke();
        ctx.strokeStyle = color(p.accent, p.light ? .22 : .19); ctx.beginPath(); ctx.moveTo(x + 2, y + bh - 2); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + bw - 2, y + 2); ctx.stroke();
        ctx.fillStyle = p.light ? '#c1d0d6' : '#172b40'; ctx.fillRect(x + 7, y + 7, Math.max(7, bw - 14), bh - 14);
        ctx.strokeStyle = p.outline; ctx.strokeRect(x + 7, y + 7, bw - 14, bh - 14);
        if (bw > 42) {
          ctx.fillStyle = p.light ? '#9db5bf' : '#0b1829'; ctx.fillRect(x + 12, y + 12, 11, 12); ctx.fillRect(x + 27, y + 12, 11, 12);
          ctx.strokeStyle = p.light ? '#b9ccd2' : '#2c3e51'; ctx.lineWidth = 1;
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 13, y + 14 + i * 2); ctx.lineTo(x + 21, y + 14 + i * 2); ctx.stroke(); }
        }
        // Pinpoint warm windows, equipment LEDs, and occasional rooftop signage.
        for (let q = 5; q < bw - 4; q += 7) {
          if (rng() > .3) { ctx.fillStyle = rng() > .55 ? color('#ffc586', .56) : color(p.accent, .36); ctx.fillRect(x + q, y + bh - 3, 3, 1.3); }
        }
        if (tall && rng() > .4) { ctx.fillStyle = color(p.second, .7); ctx.fillRect(x + bw - 6, y + 3, 2, 2); }
      }
      // Small pocket parks and rooftop trees soften the grid.
      for (let i = 0; i < 65; i++) {
        const x = 24 + rng() * 952, y = 28 + rng() * 704;
        if (distance(track.points, x, y) < this.half + 31 || (p.harbor && y > H - 90)) continue;
        const r = 3 + rng() * 5;
        ctx.fillStyle = p.light ? 'rgba(63,116,111,.26)' : 'rgba(29,69,67,.45)'; ctx.beginPath(); ctx.arc(x + 2, y + 3, r + 2, 0, TAU); ctx.fill();
        ctx.fillStyle = p.light ? '#739d96' : '#173d3d'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = color(p.accent, .14); ctx.beginPath(); ctx.arc(x - 1, y - 2, r * .6, 0, TAU); ctx.fill();
      }
      // Border map typography is architectural, never a gameplay HUD.
      ctx.font = '500 9px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'left'; ctx.fillStyle = p.light ? '#6e8d9b' : '#3e566c';
      ctx.fillText('N  ↑', 22, 29); ctx.fillText('SECTOR ' + String((hash(track.id || '') % 8) + 1).padStart(2, '0'), 65, 29);
      ctx.textAlign = 'right'; ctx.fillText(p.harbor ? 'WATERFRONT / NIGHT RUN' : p.gold ? 'INDUSTRIAL / NIGHT RUN' : p.purple ? 'UPPER DISTRICT / NIGHT RUN' : 'DOWNTOWN / NIGHT RUN', W - 22, H - 19);
      ctx.textAlign = 'left';
    }

    drawRoad(ctx, track, p) {
      const pts = track.points, width = track.width || 110, rng = random(hash(track.id || '') + 423);
      // Layered curb, reflected glow, roadbed, and wet tarmac.
      stroke(ctx, pts, width + 31, p.light ? 'rgba(50,77,94,.1)' : 'rgba(0,0,0,.3)');
      stroke(ctx, pts, width + 21, p.light ? '#9eb6c2' : '#172b3d');
      stroke(ctx, pts, width + 13, p.light ? '#adc4ce' : '#263d4f');
      stroke(ctx, pts, width + 8, p.light ? '#647f8e' : '#0b1928');
      stroke(ctx, pts, width, p.road);
      stroke(ctx, pts, width - 16, p.roadInner);
      stroke(ctx, pts, width - 33, p.light ? 'rgba(117,147,162,.08)' : 'rgba(79,118,143,.05)');
      for (const [edge, c] of [[this.outer, p.accent], [this.inner, p.second]]) {
        stroke(ctx, edge, 13, color(c, p.light ? .1 : .065));
        stroke(ctx, edge, 6, color(c, .17));
        stroke(ctx, edge, 2.5, color(c, p.light ? .8 : .94));
        stroke(ctx, edge, .7, color('#e7ffff', .69));
      }
      // Asphalt reflects long thin light rather than a flat fill.
      for (let i = 0; i < pts.length; i += 3) {
        const f = frame(pts, i), lane = (rng() - .5) * (width - 24), len = 3 + rng() * 24;
        ctx.strokeStyle = color(rng() > .75 ? p.second : p.accent, p.light ? .08 : .055 + rng() * .045); ctx.lineWidth = .4 + rng() * 1.3;
        ctx.beginPath(); ctx.moveTo(f.x + f.nx * lane, f.y + f.ny * lane); ctx.lineTo(f.x + f.nx * lane + f.dx * len, f.y + f.ny * lane + f.dy * len); ctx.stroke();
      }
      // Long broken shoulder markings help telegraph each bend.
      ctx.setLineDash([8, 17]);
      stroke(ctx, side(pts, this.half - 11), .9, color(p.white, .24));
      stroke(ctx, side(pts, -this.half + 11), .9, color(p.white, .24));
      ctx.setLineDash([]);
      // Each direction arrow is stamped into the centre of the road.
      const stride = Math.max(9, Math.floor(pts.length / 21));
      for (let i = Math.floor(stride * .6); i < pts.length; i += stride) {
        const f = frame(pts, i); ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        ctx.strokeStyle = color(p.white, p.light ? .3 : .2); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(2, 0); ctx.lineTo(-5, 5); ctx.stroke(); ctx.restore();
      }
      // Reflective perimeter bollards make the usable road width unambiguous.
      const step = Math.max(5, Math.floor(pts.length / 58));
      for (let i = 0; i < pts.length; i += step) {
        const f = frame(pts, i);
        for (const sign of [-1, 1]) {
          const x = f.x + f.nx * (this.half + 8) * sign, y = f.y + f.ny * (this.half + 8) * sign;
          ctx.fillStyle = p.light ? '#4f6977' : '#07121d'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 2.8, 0, TAU); ctx.fill();
          ctx.fillStyle = color(sign === 1 ? p.accent : p.second, .8); ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
        }
      }
    }

    drawTrackFurniture(ctx, track, p) {
      const pts = track.points;
      this.signs = [];
      const fractions = [.12, .40, .69, .87];
      for (let k = 0; k < fractions.length; k++) {
        const f = frame(pts, pts.length * fractions[k]), s = k % 2 ? 1 : -1;
        const x = f.x + f.nx * (this.half + 26) * s, y = f.y + f.ny * (this.half + 26) * s;
        if (x < 43 || x > W - 43 || y < 30 || y > H - 30) continue;
        this.signs.push({ x, y, text: ['NEON //', 'AFTERHOURS', 'DRIFT CLUB', '夜 / RUN'][k], color: k % 2 ? p.accent : p.second, k });
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = p.light ? '#334d5e' : '#08121f'; rounded(ctx, -34, -9, 68, 18, 3); ctx.fill();
        ctx.strokeStyle = color(k % 2 ? p.accent : p.second, .55); ctx.lineWidth = .8; ctx.stroke(); ctx.restore();
      }
      // A translucent canopy occupies one short, readable part of each course.
      const start = p.harbor ? .19 : p.gold ? .04 : p.purple ? .28 : .19;
      this.tunnel = [];
      const count = Math.max(4, Math.floor(pts.length * .063));
      const begin = Math.floor(pts.length * start);
      for (let i = 0; i <= count; i++) this.tunnel.push(frame(pts, begin + i));
      for (const f of [this.tunnel[0], this.tunnel[this.tunnel.length - 1]]) {
        for (const s of [-1, 1]) {
          ctx.save(); ctx.translate(f.x + f.nx * (this.half + 5) * s, f.y + f.ny * (this.half + 5) * s); ctx.rotate(f.angle);
          ctx.fillStyle = p.light ? '#607b8b' : '#263d53'; ctx.fillRect(-6, -7, 12, 14);
          ctx.fillStyle = color(p.accent, .65); ctx.fillRect(-2, -6, 2, 12); ctx.restore();
        }
      }
    }

    drawStart(ctx, track, p) {
      const f = frame(track.points, track.startIndex || 0), half = this.half - 5;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
      ctx.fillStyle = p.light ? '#294150' : '#07131f'; ctx.fillRect(-9, -half, 18, half * 2);
      const size = 7, cells = Math.floor(half * 2 / size), top = -(cells * size) / 2;
      for (let row = 0; row < 2; row++) for (let col = 0; col < cells; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#132535' : '#e2f4f4'; ctx.fillRect(-7 + row * size, top + col * size, size, size);
      }
      ctx.strokeStyle = color(p.accent, .95); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-11, -half); ctx.lineTo(-11, half); ctx.stroke();
      ctx.font = 'bold 8px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = color(p.white, .65);
      ctx.rotate(-Math.PI / 2); ctx.fillText('START / FINISH', 0, -22); ctx.restore();
    }

    render(game, options) {
      options = options || {};
      if (!game || !game.track || !game.track.points || game.track.points.length < 3 || !this.ctx) return;
      const theme = options.theme === 'light' ? 'light' : 'dark';
      this.resize(); this.prepare(game.track, theme);
      const ctx = this.ctx, reduced = !!options.reducedMotion;
      const now = Number(game.time) || 0;
      let dt = clamp(now - this.lastTime, 0, .07);
      if (now < this.lastTime) { this.trails.fill(null); this.lastTires = null; this.particles.length = 0; dt = 0; }
      this.lastTime = now; this.elapsed += dt;
      ctx.setTransform(this.width / W, 0, 0, this.height / H, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(this.cache, 0, 0, W, H);
      this.drawSigns(ctx, reduced ? 0 : now);
      this.updateTrails(game, dt, reduced);
      this.drawTrails(ctx);
      this.drawCheckpoints(ctx, game, reduced ? 0 : now);
      if (game.car) this.drawCar(ctx, game, reduced);
      this.drawTunnel(ctx);
      if (!reduced) this.drawAtmosphere(ctx, now);
      // A light vignette keeps the eye inside the playable circuit.
      const v = ctx.createRadialGradient(W / 2, H / 2, 240, W / 2, H / 2, 645);
      v.addColorStop(0, 'rgba(2,7,15,0)'); v.addColorStop(1, this.pal.light ? 'rgba(43,73,93,.08)' : 'rgba(0,4,14,.3)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    drawSigns(ctx, t) {
      for (const s of this.signs || []) {
        const a = .78 + Math.sin(t * 1.3 + s.k * 2) * .09;
        ctx.save(); ctx.translate(s.x, s.y); ctx.font = '600 7px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = s.color; ctx.shadowBlur = 5; ctx.fillStyle = color(s.color, a); ctx.fillText(s.text, 0, 0); ctx.shadowBlur = 0;
        ctx.fillStyle = color(s.color, .06); ctx.fillRect(-30, 12, 60, 4); ctx.fillStyle = color(s.color, .035); ctx.fillRect(-27, 19, 54, 2); ctx.restore();
      }
    }

    updateTrails(game, dt, reduced) {
      for (const tr of this.trails) if (tr) tr.life -= dt;
      const car = game.car;
      if (!car) { this.lastTires = null; return; }
      const a = car.angle || 0, dx = Math.cos(a), dy = Math.sin(a);
      const tires = [-1, 1].map(s => ({ x: car.x - dx * 8 - dy * s * 6, y: car.y - dy * 8 + dx * s * 6 }));
      const speed = Number.isFinite(car.speed) ? Math.abs(car.speed) : Math.hypot(car.vx || 0, car.vy || 0);
      const skidding = !!game.drifting || !!car.drifting || !!game.offroad;
      if (skidding && speed > 28 && this.lastTires && dt > 0) {
        for (let k = 0; k < 2; k++) {
          const prev = this.lastTires[k], next = tires[k], d = Math.hypot(next.x - prev.x, next.y - prev.y);
          if (d > .2 && d < 24) { this.trails[this.trailCursor] = { x1: prev.x, y1: prev.y, x2: next.x, y2: next.y, life: 7, max: 7, offroad: !!game.offroad }; this.trailCursor = (this.trailCursor + 1) % this.trails.length; }
        }
        if (!reduced && this.particles.length < 32 && Math.floor(this.elapsed * 35) !== Math.floor((this.elapsed - dt) * 35)) {
          const s = Math.sin(this.elapsed * 287) > 0 ? 1 : -1;
          this.particles.push({ x: car.x - dx * 10, y: car.y - dy * 10, vx: -dx * 15 - dy * s * 8, vy: -dy * 15 + dx * s * 8, life: .48, max: .48, r: 2.4, dust: !!game.offroad });
        }
      }
      this.lastTires = tires;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const s = this.particles[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 8;
        if (s.life <= 0) this.particles.splice(i, 1);
      }
    }

    drawTrails(ctx) {
      ctx.lineCap = 'round'; ctx.lineWidth = 2.3;
      for (let bucket = 0; bucket < 5; bucket++) {
        ctx.strokeStyle = this.pal.light ? `rgba(8,26,37,${.16 + bucket * .055})` : `rgba(2,8,15,${.18 + bucket * .067})`; ctx.beginPath();
        for (const tr of this.trails) if (tr && tr.life > 0 && Math.min(4, Math.floor(tr.life / tr.max * 5)) === bucket) { ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); }
        ctx.stroke();
      }
      for (const s of this.particles) { ctx.fillStyle = s.dust ? `rgba(168,159,130,${s.life / s.max * .14})` : color(this.pal.white, s.life / s.max * .12); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    }

    drawCheckpoints(ctx, game, t) {
      const track = game.track, pts = track.points;
      let checkpoints = track.checkpoints;
      if (!Array.isArray(checkpoints) || !checkpoints.length) checkpoints = [.25, .5, .75].map(v => Math.floor(pts.length * v));
      const next = Number.isFinite(game.nextCheckpoint) ? game.nextCheckpoint : Number.isFinite(game.checkpoint) ? (game.checkpoint + 1) % checkpoints.length : 1;
      checkpoints.forEach((cp, k) => {
        const index = typeof cp === 'number' ? cp : cp.index == null ? cp.pointIndex : cp.index;
        if (!Number.isFinite(index)) return;
        const f = frame(pts, index), active = next === k || next === index;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        ctx.strokeStyle = color(this.pal.accent, active ? .34 : .09); ctx.lineWidth = active ? 1.4 : .8; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(0, -this.half + 6); ctx.lineTo(0, this.half - 6); ctx.stroke(); ctx.setLineDash([]);
        for (const s of [-1, 1]) {
          const y = s * (this.half - 3);
          ctx.fillStyle = color(active ? this.pal.accent : this.pal.white, active ? .85 : .35);
          ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y); ctx.lineTo(0, y - s * 7); ctx.closePath(); ctx.fill();
        }
        if (active) {
          ctx.strokeStyle = color(this.pal.accent, .48 + Math.sin(t * 2) * .1); ctx.lineWidth = 2;
          for (let q = 0; q < 2; q++) { ctx.beginPath(); ctx.moveTo(-17 - q * 8, -6); ctx.lineTo(-10 - q * 8, 0); ctx.lineTo(-17 - q * 8, 6); ctx.stroke(); }
        }
        ctx.restore();
      });
    }

    drawCar(ctx, game, reduced) {
      const car = game.car, p = this.pal;
      const x = Number(car.x) || 0, y = Number(car.y) || 0, a = Number(car.angle) || 0;
      const boost = !!(game.boosting || car.boosting || game.boostActive || (typeof game.boost === 'number' && game.boost > 0 && !game.drifting && !game.offroad) || (game.boost && typeof game.boost === 'object' && game.boost.active));
      const drifting = !!(game.drifting || car.drifting);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      // Two converging cones illuminate the asphalt ahead of the nose.
      for (const sy of [-5, 5]) {
        const beam = ctx.createLinearGradient(11, sy, 92, sy); beam.addColorStop(0, 'rgba(190,239,255,.17)'); beam.addColorStop(.5, 'rgba(148,221,245,.065)'); beam.addColorStop(1, 'rgba(148,221,245,0)');
        ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(10, sy - 2); ctx.lineTo(94, sy - 17); ctx.lineTo(94, sy + 17); ctx.lineTo(10, sy + 2); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,2,9,.5)'; rounded(ctx, -16, -7, 32, 18, 5); ctx.fill();
      ctx.shadowColor = boost ? '#68ecff' : p.accent; ctx.shadowBlur = boost ? 17 : 9;
      ctx.fillStyle = color(boost ? '#5ce4ff' : p.accent, .15); rounded(ctx, -13, -7.5, 27, 15, 4); ctx.fill(); ctx.shadowBlur = 0;
      // The tyres sit outside the wide-body arches.
      ctx.fillStyle = '#050d17';
      for (const tx of [-9, 8]) for (const sy of [-1, 1]) { ctx.save(); ctx.translate(tx, sy * 7.5); if (tx > 0) ctx.rotate(clamp(Number(car.steerAngle || car.steer) || 0, -.45, .45)); rounded(ctx, -4, -1.8, 8, 3.6, 1); ctx.fill(); ctx.restore(); }
      const body = ctx.createLinearGradient(0, -8, 0, 8); body.addColorStop(0, '#d8fcf8'); body.addColorStop(.25, '#92e5df'); body.addColorStop(.52, '#effff9'); body.addColorStop(.72, '#86c6ce'); body.addColorStop(1, '#44889f');
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-11, -8); ctx.lineTo(6, -8); ctx.quadraticCurveTo(14, -7, 16, -4); ctx.lineTo(16, 4); ctx.quadraticCurveTo(14, 7, 6, 8); ctx.lineTo(-11, 8); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e5fff7'; ctx.lineWidth = .55; ctx.stroke();
      // Dark panoramic glass with a bright roof and asymmetrical livery.
      ctx.fillStyle = '#112b3b'; ctx.beginPath(); ctx.moveTo(-7, -5.5); ctx.lineTo(3, -5.5); ctx.lineTo(8, -4); ctx.lineTo(8, 4); ctx.lineTo(3, 5.5); ctx.lineTo(-7, 5.5); ctx.closePath(); ctx.fill();
      const wind = ctx.createLinearGradient(-3, -5, 7, 5); wind.addColorStop(0, '#2d788a'); wind.addColorStop(1, '#163647'); ctx.fillStyle = wind; ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(7, -3.7); ctx.lineTo(7, 3.7); ctx.lineTo(2, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d2f4e9'; rounded(ctx, -5, -4.9, 7, 9.8, 1.7); ctx.fill();
      ctx.fillStyle = '#ff689d'; ctx.fillRect(-12, -2, 6, 1.4); ctx.fillRect(-4.5, -2, 6, 1.4); ctx.fillRect(9, -2, 5, 1.4);
      ctx.strokeStyle = 'rgba(18,52,67,.55)'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-10, 6); ctx.moveTo(10, -5); ctx.lineTo(10, 5); ctx.stroke();
      ctx.fillStyle = '#203f4a'; rounded(ctx, -14.5, -8.6, 3, 17.2, .8); ctx.fill(); ctx.fillStyle = '#a9ddd9'; ctx.fillRect(-14, -8.6, 1, 17.2);
      ctx.fillStyle = '#f0ffff'; ctx.shadowColor = '#b4f5ff'; ctx.shadowBlur = 5; ctx.fillRect(14, -5.5, 2, 3); ctx.fillRect(14, 2.5, 2, 3); ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff4f79'; ctx.shadowColor = '#ff4f79'; ctx.shadowBlur = drifting ? 7 : 3; ctx.fillRect(-14, -6, 1.6, 3); ctx.fillRect(-14, 3, 1.6, 3); ctx.shadowBlur = 0;
      if (boost) {
        const len = reduced ? 14 : 18 + Math.sin(this.elapsed * 51) * 6;
        const flame = ctx.createLinearGradient(-13, 0, -13 - len, 0); flame.addColorStop(0, 'rgba(225,255,255,.95)'); flame.addColorStop(.2, 'rgba(92,241,255,.8)'); flame.addColorStop(1, 'rgba(119,126,255,0)');
        ctx.fillStyle = flame; for (const sy of [-3.5, 3.5]) { ctx.beginPath(); ctx.moveTo(-13, sy - 2); ctx.quadraticCurveTo(-20, sy - 4, -13 - len, sy); ctx.quadraticCurveTo(-20, sy + 4, -13, sy + 2); ctx.fill(); }
      }
      ctx.restore();
      // Small heading marker remains clear even under the glass canopy.
      const ux = Math.cos(a), uy = Math.sin(a);
      ctx.save(); ctx.translate(x + ux * 30, y + uy * 30); ctx.rotate(a); ctx.strokeStyle = color(p.accent, .8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(2, 0); ctx.lineTo(-3, 4); ctx.stroke(); ctx.restore();
    }

    drawTunnel(ctx) {
      if (!this.tunnel || this.tunnel.length < 2) return;
      const p = this.pal, half = this.half + 2;
      const edge1 = this.tunnel.map(f => ({ x: f.x + f.nx * half, y: f.y + f.ny * half }));
      const edge2 = this.tunnel.map(f => ({ x: f.x - f.nx * half, y: f.y - f.ny * half }));
      path(ctx, edge1.concat(edge2.slice().reverse())); ctx.fillStyle = p.light ? 'rgba(153,183,200,.1)' : 'rgba(52,80,107,.115)'; ctx.fill();
      stroke(ctx, edge1, 2.5, p.light ? 'rgba(78,118,142,.62)' : 'rgba(96,135,166,.4)', false);
      stroke(ctx, edge2, 2.5, p.light ? 'rgba(78,118,142,.62)' : 'rgba(96,135,166,.4)', false);
      const step = Math.max(1, Math.floor(this.tunnel.length / 7));
      for (let i = 0; i < this.tunnel.length; i += step) {
        const f = this.tunnel[i]; ctx.strokeStyle = p.light ? 'rgba(65,105,126,.27)' : 'rgba(111,151,180,.22)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(f.x - f.nx * half, f.y - f.ny * half); ctx.lineTo(f.x + f.nx * half, f.y + f.ny * half); ctx.stroke();
        for (const s of [-1, 1]) { ctx.strokeStyle = color(p.accent, .55); ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(f.x + f.nx * (half - 5) * s, f.y + f.ny * (half - 5) * s); ctx.lineTo(f.x + f.nx * (half - 16) * s, f.y + f.ny * (half - 16) * s); ctx.stroke(); }
      }
    }

    drawAtmosphere(ctx, t) {
      ctx.strokeStyle = this.pal.light ? 'rgba(217,247,255,.19)' : 'rgba(160,211,237,.075)'; ctx.lineWidth = .7; ctx.beginPath();
      for (const r of this.rain) { const x = (r.x - t * 10 % W + W) % W, y = (r.y + t * r.speed) % H; ctx.moveTo(x, y); ctx.lineTo(x - 2.4, y + r.len); }
      ctx.stroke();
    }

    destroy() { this.cache = null; this.trails.length = 0; this.particles.length = 0; }
  }

  root.NeonDriftRenderer = { Renderer };
})(typeof globalThis !== 'undefined' ? globalThis : window);

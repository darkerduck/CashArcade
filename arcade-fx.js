// CashArcade 共用街機手感：鏡頭震動、命中停頓、閃光、粒子、得分飄字、關卡字卡與 CRT 疊層。
// 全部以秒為單位推進，不受幀率影響；沒有 DOM 或 Canvas 時安全退化，可在 Node 測試直接載入。
(() => {
    'use strict';
    const TAU = Math.PI * 2;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const easing = Object.freeze({
        outCubic: t => 1 - (1 - clamp(t, 0, 1)) ** 3,
        outBack: t => { const x = clamp(t, 0, 1) - 1; return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2; },
        inOutSine: t => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2,
    });

    // 依裝置像素比例設定 Canvas 實際解析度，回傳縮放倍率；renderer 以 setTransform(ratio, …) 畫邏輯座標。
    function fitCanvas(canvas, width, height, maxDpr = 2) {
        const ratio = clamp(Number(globalThis.devicePixelRatio) || 1, 1, maxDpr);
        const w = Math.round(width * ratio), h = Math.round(height * ratio);
        if (canvas && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
        return ratio;
    }

    function createFx({ reduced = false, maxParticles = 400, maxPopups = 24, maxShake = 14, random = Math.random } = {}) {
        let trauma = 0, stop = 0, slow = 0, slowScale = 1, time = 0, low = Boolean(reduced);
        let particles = [], popups = [], flashes = [], banner = null;

        function update(dt) {
            if (!(dt > 0)) return;
            dt = Math.min(dt, .1);
            time += dt;
            trauma = Math.max(0, trauma - dt * 1.7);
            const scaled = dt * timeScale();
            stop = Math.max(0, stop - dt);
            slow = Math.max(0, slow - dt);
            for (const p of particles) {
                p.life -= scaled;
                const drag = Math.exp(-p.drag * scaled);
                p.vx *= drag; p.vy = p.vy * drag + p.gravity * scaled;
                p.x += p.vx * scaled; p.y += p.vy * scaled; p.spin += p.turn * scaled;
            }
            particles = particles.filter(p => p.life > 0);
            for (const p of popups) p.life -= dt;
            popups = popups.filter(p => p.life > 0);
            for (const f of flashes) f.life -= dt;
            flashes = flashes.filter(f => f.life > 0);
            if (banner) { banner.age += dt; if (banner.age >= banner.duration) banner = null; }
        }
        function timeScale() { if (low) return 1; return stop > 0 ? 0 : slow > 0 ? slowScale : 1; }
        function shake(amount) { if (!low) trauma = clamp(trauma + amount, 0, 1); }
        function hitStop(seconds) { if (!low) stop = Math.max(stop, clamp(seconds, 0, .25)); }
        function slowMotion(seconds, scale = .35) { if (!low) { slow = Math.max(slow, clamp(seconds, 0, 2)); slowScale = clamp(scale, .05, 1); } }
        function flash(color = '#ffffff', alpha = .25, duration = .16) {
            flashes.push({ color, alpha: clamp(alpha, 0, .6) * (low ? .5 : 1), life: duration, duration });
            if (flashes.length > 4) flashes.shift();
        }
        function popup(x, y, text, { color = '#ffffff', size = 16, life = .85, rise = 42 } = {}) {
            popups.push({ x, y, text: String(text), color, size, life, duration: life, rise });
            if (popups.length > maxPopups) popups.splice(0, popups.length - maxPopups);
        }
        function burst(x, y, { kind = 'spark', color = '#ffffff', count = 12, speed = 220, life = .55, size = 2.4, angle = 0, spread = TAU, gravity = 0, drag = 3 } = {}) {
            const n = kind === 'ring' ? 1 : Math.max(1, Math.round(low ? count / 4 : count));
            for (let i = 0; i < n; i++) {
                const a = angle + (random() - .5) * spread, v = speed * (.35 + random() * .65);
                particles.push({ kind, color, x, y, vx: kind === 'ring' ? 0 : Math.cos(a) * v, vy: kind === 'ring' ? 0 : Math.sin(a) * v,
                    life: life * (.7 + random() * .3), max: life, size: kind === 'ring' ? size : size * (.6 + random() * .8),
                    spin: random() * TAU, turn: (random() - .5) * 14, gravity, drag: kind === 'ring' ? 0 : drag });
            }
            if (particles.length > maxParticles) particles.splice(0, particles.length - maxParticles);
        }
        function showBanner(title, sub = '', { color = '#6ef3ff', duration = 1.1 } = {}) { banner = { title, sub, color, duration, age: 0 }; }
        function offset() {
            if (low || trauma <= 0) return { x: 0, y: 0 };
            const power = trauma * trauma * maxShake;
            return { x: Math.sin(time * 71.3) * Math.cos(time * 23.1) * power, y: Math.cos(time * 63.7) * Math.sin(time * 31.9) * power };
        }
        function apply(ctx) { const o = offset(); if (o.x || o.y) ctx.translate(o.x, o.y); }

        function draw(ctx, width, height) {
            if (!ctx) return;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const p of particles) {
                const t = clamp(p.life / p.max, 0, 1);
                ctx.globalAlpha = p.kind === 'smoke' ? t * .35 : t;
                ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
                if (p.kind === 'ring') {
                    ctx.lineWidth = Math.max(.5, 3 * t);
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t) + 4, 0, TAU); ctx.stroke();
                } else if (p.kind === 'shard') {
                    const r = p.size * 2.6;
                    ctx.lineWidth = 1.6;
                    ctx.beginPath(); ctx.moveTo(p.x - Math.cos(p.spin) * r, p.y - Math.sin(p.spin) * r); ctx.lineTo(p.x + Math.cos(p.spin) * r, p.y + Math.sin(p.spin) * r); ctx.stroke();
                } else if (p.kind === 'smoke') {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (3 - 2 * t), 0, TAU); ctx.fill();
                } else {
                    // Spark: a short streak along its velocity reads as motion at any frame rate.
                    ctx.lineWidth = p.size; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (const p of popups) {
                const age = 1 - p.life / p.duration, scale = easing.outBack(Math.min(1, age * 4));
                ctx.globalAlpha = clamp(p.life / (p.duration * .4), 0, 1);
                ctx.font = `800 ${Math.round(p.size * scale)}px ui-monospace, SFMono-Regular, Consolas, monospace`;
                ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(4,8,20,.75)';
                const y = p.y - p.rise * easing.outCubic(age);
                ctx.strokeText(p.text, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, y);
            }
            if (banner && width && height) drawBanner(ctx, width, height);
            for (const f of flashes) { ctx.globalAlpha = f.alpha * (f.life / f.duration); ctx.fillStyle = f.color; ctx.fillRect(-20, -20, (width || 0) + 40, (height || 0) + 40); }
            ctx.restore();
        }
        function drawBanner(ctx, width, height) {
            const { title, sub, color, duration, age } = banner;
            const enter = low ? 1 : easing.outCubic(age / .22), leave = clamp((duration - age) / .25, 0, 1);
            const alpha = Math.min(low ? clamp(age / .2, 0, 1) : 1, leave), band = 74, y = height * .42;
            ctx.globalAlpha = alpha * .82; ctx.fillStyle = '#050a18';
            ctx.fillRect(0, y - band / 2 * enter, width, band * enter);
            ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
            const span = width * enter;
            ctx.beginPath(); ctx.moveTo((width - span) / 2, y - band / 2 * enter); ctx.lineTo((width + span) / 2, y - band / 2 * enter);
            ctx.moveTo((width - span) / 2, y + band / 2 * enter); ctx.lineTo((width + span) / 2, y + band / 2 * enter); ctx.stroke();
            ctx.globalAlpha = alpha * .12; ctx.fillStyle = color;
            for (let line = y - band / 2 + 2; line < y + band / 2; line += 4) ctx.fillRect(0, line, width, 1);
            ctx.globalAlpha = alpha; ctx.fillStyle = color;
            ctx.font = '800 28px ui-monospace, SFMono-Regular, Consolas, monospace';
            ctx.fillText(title, width / 2 + (1 - enter) * -60, y - (sub ? 9 : 0));
            if (sub) { ctx.globalAlpha = alpha * .8; ctx.font = '600 12px ui-monospace, SFMono-Regular, Consolas, monospace'; ctx.fillStyle = '#d7f6ff'; ctx.fillText(sub, width / 2 + (1 - enter) * 60, y + 19); }
        }
        function clear() { particles = []; popups = []; flashes = []; banner = null; trauma = 0; stop = 0; slow = 0; }
        function setReduced(value) { low = Boolean(value); if (low) { trauma = 0; stop = 0; slow = 0; } }
        function stats() { return { particles: particles.length, popups: popups.length, flashes: flashes.length, banner: banner?.title ?? null, trauma, stop, slow }; }
        return Object.freeze({ update, timeScale, shake, hitStop, slowMotion, flash, popup, burst, banner: showBanner, offset, apply, draw, clear, setReduced, stats,
            get busy() { return particles.length > 0 || popups.length > 0 || flashes.length > 0 || Boolean(banner) || trauma > 0; } });
    }

    // 淡掃描線＋暗角，紋理依尺寸快取；沒有 DOM 時略過。
    const crtCache = new Map();
    function crt(ctx, width, height, strength = .07) {
        const doc = globalThis.document;
        if (!ctx || !doc?.createElement || strength <= 0) return;
        const key = `${width}x${height}`;
        let layer = crtCache.get(key);
        if (!layer) {
            layer = doc.createElement('canvas'); layer.width = width; layer.height = height;
            const c = layer.getContext?.('2d');
            if (!c || typeof c.createRadialGradient !== 'function') return;
            c.fillStyle = '#000';
            for (let y = 0; y < height; y += 3) c.fillRect(0, y, width, 1);
            const v = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .35, width / 2, height / 2, Math.max(width, height) * .75);
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.9)');
            c.fillStyle = v; c.fillRect(0, 0, width, height);
            crtCache.set(key, layer);
            if (crtCache.size > 8) crtCache.delete(crtCache.keys().next().value);
        }
        ctx.save(); ctx.globalAlpha = strength; ctx.drawImage(layer, 0, 0, width, height); ctx.restore();
    }

    globalThis.CashArcadeFX = Object.freeze({ fitCanvas, createFx, crt, easing });
})();

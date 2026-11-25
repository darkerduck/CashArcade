// CashArcade 共用霓虹光暈：在 2D Canvas 畫完一幀後加上 bloom 後製。
// 只用 drawImage 與合成模式，不依賴 ctx.filter；淺色主題、缺 DOM 或效能不足時自動略過。
(() => {
    'use strict';
    const DEFAULTS = Object.freeze({ strength: 1, spread: 1, threshold: .45, gain: 1, scale: 4 });
    const BUDGET_MS = 4, SLOW_FRAMES = 24;
    const states = new WeakMap();
    const now = () => globalThis.performance?.now?.() ?? Date.now();

    function surface(doc, width, height) {
        const canvas = doc.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext?.('2d');
        if (!ctx || typeof ctx.drawImage !== 'function') return null;
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        return { canvas, ctx, width, height };
    }

    function stateFor(canvas) {
        let state = states.get(canvas);
        if (!state) { state = { scale: 0, disabled: false, slow: 0, width: 0, height: 0, layers: null, lastMs: 0, frames: 0 }; states.set(canvas, state); markHost(canvas); }
        return state;
    }

    // 讓遊戲區外框在深色主題下有燈管邊光（樣式在 brand.css）；只標記已定位的容器，避免改動版面。
    function markHost(canvas) {
        const host = canvas.parentElement;
        if (!host?.classList || typeof globalThis.getComputedStyle !== 'function') return;
        if (globalThis.getComputedStyle(host).position !== 'static') host.classList.add('neon-glow-host');
    }

    function build(state, doc, width, height, scale) {
        const w = Math.max(1, Math.ceil(width / scale)), h = Math.max(1, Math.ceil(height / scale));
        const layers = [surface(doc, w, h), surface(doc, w, h), surface(doc, Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2))), surface(doc, Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)))];
        state.layers = layers.every(Boolean) ? layers : null;
        state.width = width; state.height = height; state.scale = scale;
        return state.layers;
    }

    function copy(target, source, mode = 'copy') {
        const c = target.ctx;
        c.globalCompositeOperation = mode; c.globalAlpha = 1;
        c.drawImage(source.canvas || source, 0, 0, target.width, target.height);
    }

    function apply(canvas, options = {}) {
        if (!canvas || options.theme === 'light' || options.light === true || options.enabled === false) return false;
        const doc = globalThis.document;
        if (!doc?.createElement || typeof canvas.getContext !== 'function') return false;
        const width = canvas.width | 0, height = canvas.height | 0;
        if (width < 8 || height < 8) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx || typeof ctx.drawImage !== 'function' || typeof ctx.setTransform !== 'function') return false;
        const state = stateFor(canvas);
        if (state.disabled) return false;
        const o = { ...DEFAULTS, ...options };
        const scale = Math.max(o.scale, state.scale || 0);
        const layers = state.layers && state.width === width && state.height === height && state.scale === scale ? state.layers : build(state, doc, width, height, scale);
        if (!layers) { state.disabled = true; return false; }
        const started = now(), [bright, temp, mid, wide] = layers;

        // 1. 縮小取樣，順便柔化。
        copy(bright, canvas);
        // 2. 亮度門檻：bright = max(x - k, 0)。temp 取 min(x, k)（darken），再以 difference 相減，
        //    壓掉背景、網格與大片漸層，只留亮的燈管、子彈與粒子；飽和霓虹色會保留色相。
        const k = Math.round(Math.max(0, Math.min(.95, o.threshold)) * 255);
        if (k > 0) {
            copy(temp, bright);
            temp.ctx.globalCompositeOperation = 'darken'; temp.ctx.fillStyle = `rgb(${k},${k},${k})`;
            temp.ctx.fillRect(0, 0, temp.width, temp.height);
            copy(bright, temp, 'difference');
        }
        // 3. 增益：門檻後再加亮，讓光暈夠飽和。
        for (let i = 0; i < Math.round(o.gain); i++) { copy(temp, bright); copy(bright, temp, 'lighter'); }
        // 4. 多級縮小，得到中距與遠距光暈。
        copy(mid, bright); copy(wide, mid);
        // 5. 以加色疊回主畫布。
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        const strength = Math.max(0, Math.min(2, o.strength)), spread = Math.max(0, o.spread);
        ctx.globalAlpha = Math.min(1, strength * .55); ctx.drawImage(bright.canvas, 0, 0, width, height);
        ctx.globalAlpha = Math.min(1, strength * .7 * spread); ctx.drawImage(mid.canvas, 0, 0, width, height);
        ctx.globalAlpha = Math.min(1, strength * .8 * spread); ctx.drawImage(wide.canvas, 0, 0, width, height);
        ctx.restore();

        // 效能保護：連續過慢先降解析度，仍過慢就停用。
        const elapsed = now() - started;
        state.lastMs = elapsed; state.frames++;
        if (elapsed > (o.budget ?? BUDGET_MS)) {
            if (++state.slow >= SLOW_FRAMES) {
                state.slow = 0;
                if (state.scale < 8) state.scale = 8, state.layers = null;
                else state.disabled = true;
            }
        } else state.slow = Math.max(0, state.slow - 1);
        return true;
    }

    function reset(canvas) { if (canvas) states.delete(canvas); }
    function stats(canvas) {
        const s = canvas && states.get(canvas);
        return s ? { scale: s.scale, disabled: s.disabled, lastMs: s.lastMs, frames: s.frames } : null;
    }

    globalThis.CashArcadeNeon = Object.freeze({ apply, reset, stats, DEFAULTS });
})();

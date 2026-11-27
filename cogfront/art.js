// 蒸汽前線 CG slots. The game ships with procedural Canvas art; each slot below can be replaced
// by a generated image in cogfront/art/. Only files listed in CogfrontArtFiles (cogfront/art/files.js)
// are requested, so missing art never produces network errors. Full specs and prompts:
// docs/COGFRONT_ART_SPEC.md.
(() => {
    'use strict';
    // sprite: horizontal strip, `frames` cells of `w`×`h`, anchor = feet (or hull centre) in cell px.
    const sprite = (file, w, h, frames, fps, anchorX, anchorY, loop = true) => Object.freeze({ type: 'sprite', file, w, h, frames, fps, anchorX, anchorY, loop });
    const image = (file, w, h, extra = {}) => Object.freeze({ type: 'image', file, w, h, ...extra });
    const SLOTS = {};
    const character = (id, size, anims, anchorY = Math.round(size * .92)) => {
        for (const [anim, frames, fps, loop = true] of anims) SLOTS[`${id}.${anim}`] = sprite(`${id}-${anim}.png`, size, size, frames, fps, size / 2, anchorY, loop);
    };
    character('hero', 192, [['idle', 6, 8], ['run', 8, 14], ['slash1', 5, 18, false], ['slash2', 5, 18, false], ['slash3', 7, 16, false], ['burst', 7, 16, false], ['charge', 4, 16], ['dodge', 5, 15, false], ['hurt', 3, 12, false], ['down', 6, 10, false]]);
    for (const id of ['sword', 'lancer', 'musket', 'shield', 'mechanic']) character(`troop-${id}`, 128, [['walk', 8, 12], ['attack', 6, 14, false], ['down', 5, 10, false]]);
    for (const [id, size] of [['drone', 128], ['saw', 128], ['brute', 160], ['walker', 160], ['beetle', 112]]) character(`enemy-${id}`, size, [['walk', 8, 12], ['attack', 6, 14, false], ['down', 5, 10, false]]);
    character('boss-colossus', 512, [['idle', 6, 8], ['slam', 8, 10, false], ['vent', 6, 10], ['down', 8, 8, false]], 488);
    for (const [anim, frames, fps, loop = true] of [['idle', 6, 8], ['bombs', 6, 10, false], ['down', 8, 8, false]]) SLOTS[`boss-airship.${anim}`] = sprite(`boss-airship-${anim}.png`, 768, 384, frames, fps, 384, 372, loop);
    SLOTS.train = image('train.png', 480, 300, { anchorX: 240, anchorY: 288 });
    SLOTS.gate = image('gate.png', 360, 420, { anchorX: 180, anchorY: 410 });
    SLOTS['gate.damaged'] = image('gate-damaged.png', 360, 420, { anchorX: 180, anchorY: 410 });
    for (const zone of ['outskirts', 'works', 'foundry']) {
        SLOTS[`bg.${zone}.sky`] = image(`bg-${zone}-sky.jpg`, 1920, 1080, { layer: 'sky', parallax: 0 });
        SLOTS[`bg.${zone}.far`] = image(`bg-${zone}-far.png`, 2400, 600, { layer: 'far', parallax: .15, tile: true });
        SLOTS[`bg.${zone}.mid`] = image(`bg-${zone}-mid.png`, 2400, 700, { layer: 'mid', parallax: .45, tile: true });
        SLOTS[`bg.${zone}.ground`] = image(`bg-${zone}-ground.png`, 1024, 256, { layer: 'ground', parallax: 1, tile: true });
        SLOTS[`bg.${zone}.front`] = image(`bg-${zone}-front.png`, 2048, 400, { layer: 'front', parallax: 1.3, tile: true });
    }
    for (const id of ['sword', 'lancer', 'musket', 'shield', 'mechanic', 'burst', 'charge', 'overdrive', 'dodge']) SLOTS[`icon.${id}`] = image(`icon-${id}.png`, 96, 96);
    const ZONES = Object.freeze(['outskirts', 'works', 'foundry']);

    const images = new Map();
    function load(base = './art/') {
        const files = new Set(globalThis.CogfrontArtFiles || []);
        if (typeof globalThis.Image !== 'function' || !files.size) return 0;
        let requested = 0;
        for (const [key, slot] of Object.entries(SLOTS)) {
            if (!files.has(slot.file) || images.has(key)) continue;
            const img = new Image(); img.decoding = 'async'; img.src = base + slot.file; images.set(key, img); requested++;
        }
        return requested;
    }
    const ready = key => { const img = images.get(key); return Boolean(img && img.complete && img.naturalWidth > 0); };
    // Draw frame `t` (seconds) of a sprite slot at world point (x, y) facing ±1; returns false when no art.
    function drawSprite(ctx, key, t, x, y, facing = 1, scale = 1, alpha = 1) {
        const slot = SLOTS[key]; if (!slot || !ready(key)) return false;
        const img = images.get(key);
        ctx.save(); ctx.translate(x, y); ctx.scale(facing * scale, scale); if (alpha !== 1) ctx.globalAlpha *= alpha;
        if (slot.type === 'sprite') {
            const raw = Math.floor(Math.max(0, t) * slot.fps), frame = slot.loop ? raw % slot.frames : Math.min(slot.frames - 1, raw);
            ctx.drawImage(img, frame * slot.w, 0, slot.w, slot.h, -slot.anchorX, -slot.anchorY, slot.w, slot.h);
        } else ctx.drawImage(img, -(slot.anchorX ?? 0), -(slot.anchorY ?? 0), slot.w, slot.h);
        ctx.restore(); return true;
    }
    function drawLayer(ctx, key, camera, viewW, viewH, y, height) {
        const slot = SLOTS[key]; if (!slot || !ready(key)) return false;
        const img = images.get(key), scale = height / slot.h, w = slot.w * scale;
        if (!slot.tile) { ctx.drawImage(img, 0, 0, viewW, viewH); return true; }
        let x = -((camera * slot.parallax) % w); if (x > 0) x -= w;
        for (; x < viewW; x += w) ctx.drawImage(img, x, y, w + 1, height);
        return true;
    }
    globalThis.CogfrontArt = Object.freeze({ SLOTS: Object.freeze(SLOTS), ZONES, load, ready, drawSprite, drawLayer });
    if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.CogfrontArt;
})();

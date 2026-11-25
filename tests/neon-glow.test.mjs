import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../neon-glow.js', import.meta.url), 'utf8');

function fakeContext(log, name) {
    const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, imageSmoothingQuality: 'low', depth: 0 };
    ctx.drawImage = (img, ...args) => { for (const a of args) assert.ok(Number.isFinite(a)); log.push([name, 'drawImage', ctx.globalCompositeOperation, ctx.globalAlpha, img.id]); };
    ctx.setTransform = (...args) => log.push([name, 'setTransform', ...args]);
    ctx.fillRect = (...args) => log.push([name, 'fillRect', ctx.globalCompositeOperation, ctx.fillStyle, ...args]);
    ctx.save = () => { ctx.depth++; ctx.saved = { op: ctx.globalCompositeOperation, alpha: ctx.globalAlpha }; log.push([name, 'save']); };
    ctx.restore = () => { ctx.depth--; ctx.globalCompositeOperation = ctx.saved.op; ctx.globalAlpha = ctx.saved.alpha; log.push([name, 'restore']); };
    return ctx;
}

function harness({ clock } = {}) {
    const log = [];
    let created = 0;
    const document = { createElement: () => { const id = `layer${++created}`; const c = { id, width: 0, height: 0 }; const ctx = fakeContext(log, id); c.getContext = () => ctx; return c; } };
    const scope = { document, performance: { now: clock || (() => 0) } };
    vm.createContext(scope); vm.runInContext(source, scope);
    const main = { id: 'main', width: 1440, height: 1440 }, mainCtx = fakeContext(log, 'main');
    main.getContext = () => mainCtx;
    return { neon: scope.CashArcadeNeon, main, mainCtx, log, created: () => created };
}

test('dark theme downsamples, thresholds, blurs and adds three glow layers back with state restored', () => {
    const { neon, main, mainCtx, log } = harness();
    assert.equal(neon.apply(main, { theme: 'dark' }), true);
    const ops = log.filter(e => e[1] === 'drawImage');
    assert.equal(ops[0][0], 'layer1'); assert.equal(ops[0][4], 'main'); assert.equal(ops[0][2], 'copy');
    assert.ok(log.some(e => e[1] === 'fillRect' && e[2] === 'darken' && e[3] === 'rgb(115,115,115)'), 'threshold clamps with darken');
    assert.ok(ops.some(e => e[0] === 'layer1' && e[2] === 'difference'), 'threshold subtracts with difference');
    assert.ok(ops.some(e => e[0] !== 'main' && e[2] === 'lighter'), 'gain uses lighter');
    const back = ops.filter(e => e[0] === 'main');
    assert.equal(back.length, 3);
    for (const e of back) { assert.equal(e[2], 'lighter'); assert.ok(e[3] > 0 && e[3] <= 1); }
    assert.ok(log.some(e => e[0] === 'main' && e[1] === 'setTransform' && e.slice(2).join() === '1,0,0,1,0,0'));
    assert.equal(mainCtx.depth, 0); assert.equal(mainCtx.globalCompositeOperation, 'source-over'); assert.equal(mainCtx.globalAlpha, 1);
});

test('light theme, missing DOM and unusable contexts are silent no-ops', () => {
    const { neon, main, log } = harness();
    assert.equal(neon.apply(main, { theme: 'light' }), false);
    assert.equal(neon.apply(main, { light: true }), false);
    assert.equal(neon.apply(null), false);
    assert.equal(neon.apply({ width: 100, height: 100, getContext: () => null }), false);
    assert.equal(neon.apply({ width: 100, height: 100 }), false);
    assert.equal(log.length, 0);
    const bare = vm.createContext({}); vm.runInContext(source, bare);
    assert.equal(bare.CashArcadeNeon.apply(main, { theme: 'dark' }), false);
});

test('offscreen layers are cached and rebuilt only when the canvas size changes', () => {
    const { neon, main, created } = harness();
    neon.apply(main, {}); const first = created(); assert.equal(first, 4);
    neon.apply(main, {}); assert.equal(created(), first);
    main.width = 720; neon.apply(main, {}); assert.equal(created(), first + 4);
    assert.equal(neon.stats(main).scale, 4);
});

test('slow frames first halve the glow resolution, then disable the effect', () => {
    let t = 0;
    const { neon, main } = harness({ clock: () => (t += 10) });
    for (let i = 0; i < 24; i++) neon.apply(main, {});
    assert.equal(neon.stats(main).scale, 8); assert.equal(neon.stats(main).disabled, false);
    for (let i = 0; i < 24; i++) neon.apply(main, {});
    assert.equal(neon.stats(main).disabled, true);
    assert.equal(neon.apply(main, {}), false);
    neon.reset(main); assert.equal(neon.stats(main), null); assert.equal(neon.apply(main, {}), true);
});

test('every Canvas game page loads the shared glow before its controller and calls it after drawing', () => {
    const games = ['arena', 'assault', 'asteroids', 'aurora', 'breakout', 'bubbles', 'circuit', 'drift', 'flappy', 'gravity', 'missile', 'prism', 'pulse', 'reactor'];
    for (const game of games) {
        const html = readFileSync(new URL(`../${game}/index.html`, import.meta.url), 'utf8');
        const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
        const glow = scripts.indexOf('../neon-glow.js'), controller = scripts.findIndex(s => /^\.\/game\.m?js$/.test(s));
        assert.ok(glow >= 0 && glow < controller, game);
        const file = game === 'circuit' ? 'game.mjs' : 'game.js';
        assert.match(readFileSync(new URL(`../${game}/${file}`, import.meta.url), 'utf8'), /CashArcadeNeon\?\.apply\(/, game);
    }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('cogfront/index.html'), controller = read('cogfront/game.js');

test('page loads local scripts in dependency order, free of payment SDKs, with every controller id present', () => {
    const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
    assert.deepEqual(scripts, ['../audio.js', '../music.js', '../arcade-fx.js', './data.js', './engine.js', './storage.js', './art/files.js', './art.js', './renderer.js', './input.js', './music.js', './game.js']);
    for (const src of scripts) assert.ok(existsSync(new URL('../cogfront/' + src, import.meta.url)), src);
    assert.doesNotMatch(html, /linkincash|cashlink/i);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
    for (const [, id] of controller.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(id), `#${id}`);
    for (const id of ['t-left', 't-right', 't-attack', 't-burst', 't-charge', 't-over', 't-dodge', 't-order', 'troops', 'steam']) assert.ok(ids.has(id), id);
    assert.match(controller, /visibilitychange/); assert.match(controller, /'blur'/);
});

test('storage: corrupt or missing data starts fresh; records stars, best time, coins and unlocks; workshop purchases are bounded', () => {
    require('../cogfront/data.js'); const S = require('../cogfront/storage.js'), D = globalThis.CogfrontData;
    const failing = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
    let failed = 0; const broken = S.create(failing, () => failed++);
    assert.deepEqual(broken.load(), S.fresh()); assert.equal(broken.save(S.fresh()), false); assert.ok(failed >= 2);
    const map = new Map([[S.KEY, '{"version":1,"unlocked":99}']]), store = S.create({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) });
    assert.deepEqual(store.load(), S.fresh());
    const d = S.fresh();
    S.record(d, { state: 'won', level: 1, stars: 3, time: 88.4, reward: 300 });
    assert.equal(d.unlocked, 2); assert.equal(d.stars[0], 3); assert.equal(d.best[0], 88.4); assert.equal(d.coins, 300);
    S.record(d, { state: 'lost', level: 2, stars: 0, time: 30, reward: 20 }); assert.equal(d.unlocked, 2); assert.equal(d.coins, 320);
    assert.equal(S.buy(d, 'heroHp'), true); assert.equal(d.upgrades.heroHp, 1); assert.equal(d.coins, 320 - D.cost(D.UPGRADES[0], 0));
    assert.equal(S.buy(d, 'troop:shield'), false, 'shield upgrades wait for its unlock stage');
    d.coins = 0; assert.equal(S.buy(d, 'heroAtk'), false);
    assert.ok(store.save(d)); assert.deepEqual(store.load(), d);
});

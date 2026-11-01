import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { fresh, clean, create, complete, KEY } = require('../gravity/storage.js');
const memory = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };
const delivery = (stars = 3, time = 12) => ({ state: 'delivered', stars, time, collected: [0, 1, 2] });
test('fresh progress unlocks only the first of ten levels', () => { const data = fresh(); assert.equal(data.unlocked, 1); assert.equal(data.records.length, 10); assert.equal(data.selected, 0); });
test('completion preserves best stars/time, counts deliveries and unlocks next level', () => {
    const data = fresh(); complete(data, 0, delivery()); complete(data, 0, delivery(1, 15));
    assert.equal(data.records[0].stars, 3); assert.equal(data.records[0].best, 12); assert.equal(data.records[0].deliveries, 2); assert.equal(data.unlocked, 2);
    assert.equal(complete(data, 1, { state: 'lost' }), false); assert.equal(data.unlocked, 2);
    for (let i = 1; i < 10; i++) complete(data, i, delivery()); assert.equal(data.unlocked, 10);
});
test('progress/preferences survive save and reload without keeping a running attempt', () => {
    const storage = memory(), store = create(storage), data = fresh(); complete(data, 0, delivery()); data.selected = 1; data.reducedMotion = true;
    assert.equal(store.save(data), true); assert.deepEqual(store.load(), data); assert.equal(store.load().state, undefined);
});
test('corrupt values and unknown versions fail safely; unlock count is derived from records', () => {
    assert.deepEqual(clean({ version: 9 }), fresh());
    const data = clean({ version: 1, selected: 9, unlocked: 1000, reducedMotion: 'yes', records: [{ stars: 99, best: -8, shards: NaN, deliveries: Infinity }] });
    assert.deepEqual(data, fresh());
    const repaired = clean({ version: 1, selected: 4, unlocked: 10, records: [{ stars: 1, best: 15 }] }); assert.equal(repaired.unlocked, 2); assert.equal(repaired.selected, 0);
});
test('invalid JSON, denied storage and silently failed writes remain playable', () => {
    const storage = memory(); storage.setItem(KEY, '{broken'); const store = create(storage); assert.deepEqual(store.load(), fresh()); assert.equal(store.available, false);
    const denied = create({ getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } }); assert.deepEqual(denied.load(), fresh()); assert.equal(denied.save(fresh()), false);
    const noWrite = create({ getItem: () => null, setItem() {} }); assert.equal(noWrite.save(fresh()), false);
});

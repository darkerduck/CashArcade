import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const scope = vm.createContext({ devicePixelRatio: 1, matchMedia: () => ({ matches: false }) });
vm.runInContext(readFileSync(new URL('../missile/engine.js', import.meta.url), 'utf8'), scope);
vm.runInContext(readFileSync(new URL('../missile/renderer.js', import.meta.url), 'utf8'), scope);
const ground = scope.NeonDefense.GROUND;

function cityDrawing(hp, light = false, shield = false) {
    const operations = [];
    const context = new Proxy({}, {
        get: (_, name) => (...args) => operations.push([name, ...args]),
        set: (_, name, value) => { operations.push([name, value]); return true; },
    });
    const canvas = { getContext: () => context };
    const renderer = new scope.NeonDefenseRenderer(canvas);
    renderer.city({ x: 150, hp, shield }, light);
    return operations;
}

test('city silhouette changes across all four damage states in both themes', () => {
    for (const light of [false, true]) {
        const states = [3, 2, 1, 0].map(hp => cityDrawing(hp, light));
        assert.equal(new Set(states.map(s => JSON.stringify(s))).size, 4);
        assert.ok(states[0].some(([name, , y]) => name === 'lineTo' && y === ground - 55)); // intact tower top
        assert.ok(states[1].some(([name, , y]) => name === 'lineTo' && y === ground - 49)); // damaged roof
        assert.ok(states[2].some(([name, , y]) => name === 'lineTo' && y === ground - 35)); // collapsed roof
        assert.ok(!states[3].some(([name, , y]) => name === 'lineTo' && y < ground - 20)); // rubble only
    }
});

test('shield is separate from damage and repair redraws the intact city', () => {
    const intact = cityDrawing(3);
    const damaged = cityDrawing(1);
    assert.notDeepEqual(damaged, intact);
    assert.deepEqual(cityDrawing(3), intact);
    assert.ok(cityDrawing(2, false, true).some(([name, , , radius]) => name === 'arc' && radius === 43));
    assert.ok(!cityDrawing(0, false, true).some(([name, , , radius]) => name === 'arc' && radius === 43));
});

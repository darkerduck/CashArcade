import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('CG spec documents every art slot with its file name, and the cover prompt is saved', () => {
    const scope = vm.createContext({}); vm.runInContext(read('cogfront/art.js'), scope);
    const doc = read('docs/COGFRONT_ART_SPEC.md');
    for (const slot of Object.values(scope.CogfrontArt.SLOTS)) assert.ok(doc.includes('`' + slot.file + '`'), slot.file);
    for (const rule of ['透明', '面向右', 'cogfront/art/files.js', 'no text']) assert.ok(doc.includes(rule), rule);
    assert.ok(existsSync(new URL('../assets/covers/cogfront-prompt.txt', import.meta.url)));
});

test('listed generated files are real slots that exist on disk (empty list keeps procedural art)', () => {
    const scope = vm.createContext({}); vm.runInContext(read('cogfront/art/files.js'), scope); vm.runInContext(read('cogfront/art.js'), scope);
    const files = new Set(Object.values(scope.CogfrontArt.SLOTS).map(s => s.file));
    for (const name of scope.CogfrontArtFiles) {
        assert.ok(files.has(name), `${name} is not a defined slot`);
        assert.ok(existsSync(new URL(`../cogfront/art/${name}`, import.meta.url)), `${name} missing`);
    }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const pages = [
    ['homepage', '../app.js', null],
    ['snake', '../snake/game.js', 'applyStoredTheme'],
    ['breakout', '../breakout/game.js', 'applyTheme'],
    ['flappy', '../flappy/game.js', 'applyTheme'],
];

function selectedTheme(path, initializer, storedTheme, storageFails = false) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const script = initializer
        ? `${source.match(new RegExp(`function ${initializer}\\(\\) \\{[\\s\\S]*?\\n    \\}`))[0]}\n${initializer}();`
        : source;
    const document = {
        documentElement: { dataset: {} },
        querySelector: () => ({ addEventListener() {} }),
    };
    const localStorage = {
        getItem(key) {
            assert.equal(key, 'casharcade-theme');
            if (storageFails) throw new Error('Storage unavailable');
            return storedTheme;
        },
    };
    const matchMedia = () => ({ matches: true });
    vm.runInNewContext(script, { document, localStorage, matchMedia, window: { matchMedia } });
    return document.documentElement.dataset.theme;
}

for (const [name, path, initializer] of pages) {
    test(`${name} defaults to dark even when the device prefers light`, () => {
        assert.equal(selectedTheme(path, initializer, null), 'dark');
        assert.equal(selectedTheme(path, initializer, null, true), 'dark');
    });

    test(`${name} preserves an explicit light preference`, () => {
        assert.equal(selectedTheme(path, initializer, 'light'), 'light');
    });
}

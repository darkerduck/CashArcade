import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

test('homepage resolves five raster covers, including the approved text-free Assault artwork', () => {
    const covers = [...html.matchAll(/<img\b[^>]*src="(\.\/assets\/covers\/[^"?]+)(?:\?[^"\s]*)?"[^>]*>/g)];
    assert.equal(covers.length, 5);
    for (const [tag, src] of covers) {
        assert.match(src, /\.jpg$/);
        assert.match(tag, /width="1672" height="941"/);
        const bytes = readFileSync(new URL(src, root));
        assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
    }
    assert.ok(html.includes('./assets/covers/assault.jpg?v=1'));
    assert.ok(!html.includes('./assets/covers/assault.svg'));
});

test('both documents retain the same no-text cover rule and published asset provenance', () => {
    const rule = '所有現有與未來的遊戲封面不得包含文字、字母、數字、標題、標語、Logo、介面或水印。';
    for (const file of ['README.md', 'docs/DEVELOPMENT.md']) {
        const doc = readFileSync(new URL(file, root), 'utf8');
        assert.ok(doc.includes(rule), file);
        assert.ok(doc.includes('assault.jpg'), file);
        assert.ok(doc.includes('assault-prompt.txt'), file);
    }
    assert.ok(existsSync(new URL('assets/covers/assault-prompt.txt', root)));
});

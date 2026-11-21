import test from 'node:test';
import assert from 'node:assert/strict';
import { playShot, solve } from './bubbles-replays.mjs';
import '../bubbles/storage.js';
import '../bubbles/input.js';
import '../bubbles/music.js';

const { Game, key, position, neighbors, aimAt, MAX_ANGLE, LEFT, RIGHT, TOP, ORIGIN, LINE, ROW, R } = Lightbubble;
const { levels } = LightbubbleLevels;
const step = 1 / 120;
const radians = d => d * Math.PI / 180;
function finish(game) {
    for (let i = 0; i < 320 && game.mode === 'flight'; i++) game.update(step);
    return game.drain();
}
const tile = (game, r, c, type, hp = 1) => game.board.set(key(r, c), { r, c, type, hp });

test('all eighteen starting maps are anchored and have a winning normal-input replay', () => {
    const actions = new Set();
    for (const level of levels) {
        const game = new Game(level.id), visited = new Set(), stack = [...game.board.values()].filter(b => !b.r);
        level.rows.forEach((row, i) => assert.equal(row.length, 11 - i % 2, 'row shape: level ' + level.id));
        while (stack.length) {
            const cell = stack.pop(), id = key(cell.r, cell.c);
            if (visited.has(id)) continue;
            visited.add(id);
            for (const [r, c] of neighbors(cell.r, cell.c)) {
                const adjacent = game.board.get(key(r, c));
                if (adjacent) stack.push(adjacent);
            }
        }
        assert.equal(visited.size, game.board.size, 'floating initial cluster: level ' + level.id);
        const replay = solve(level.id);
        assert.ok(replay?.length, 'level ' + level.id + ' has no replay');
        for (const shot of replay) { actions.add(shot[1]); playShot(game, shot); }
        assert.equal(game.mode, 'won', 'level ' + level.id);
        assert.equal(game.remaining, 0);
        assert.equal(game.shots, replay.length);
    }
    assert.deepEqual([...actions].sort(), ['drill', 'keep', 'pulse', 'rainbow', 'swap']);
});

test('direct and banked guide share the exact snap point with animated shots', () => {
    for (const angle of [0, radians(-71), radians(42), MAX_ANGLE]) {
        const game = new Game(1), route = game.preview(angle);
        assert.ok(route.points.every(p => p.x >= LEFT - 1e-5 && p.x <= RIGHT + 1e-5 && p.y <= ORIGIN.y + 1e-5));
        assert.ok(route.points.every(p => p.y >= TOP - 1e-5));
        assert.ok(game.shoot(angle));
        assert.deepEqual(game.projectile.path, route);
        assert.equal(game.shoot(angle), false);
        const events = finish(game);
        assert.equal(events.filter(e => e.type === 'bounce').length, route.bounces);
        const attached = events.find(e => e.type === 'attach');
        assert.deepEqual({ r: attached.r, c: attached.c }, { r: route.cell.r, c: route.cell.c });
    }
});

test('matching severs a supported mixed-color branch and tallies a cascade once', () => {
    const game = new Game(4);
    assert.equal(game.shoot(radians(-28)), true);
    const events = finish(game), pop = events.find(event => event.type === 'pop'), drop = events.find(event => event.type === 'drop');
    assert.ok(pop.bubbles.length >= 3);
    assert.ok(drop.bubbles.length >= 3);
    assert.ok(new Set(drop.bubbles.map(b => b.type)).size > 1);
    assert.equal(new Set([...pop.bubbles, ...drop.bubbles].map(b => key(b.r, b.c))).size, pop.bubbles.length + drop.bubbles.length);
    assert.equal(game.score, pop.bubbles.length * 100 + drop.bubbles.length * 180);
});

test('waiting does not move the board or spend shots, and successful shots preserve previous misses', () => {
    const game = new Game(1);
    game.misses = game.level.missLimit - 1;
    for (let i = 0; i < 1500; i++) game.update(.05);
    assert.equal(game.shots, 0);
    assert.equal(game.descent, 0);
    assert.equal(game.shoot(radians(-71)), true);
    assert.ok(finish(game).some(e => e.type === 'pop'));
    assert.equal(game.misses, game.level.missLimit - 1);
    assert.ok(game.shoot(aimAt(LEFT + 1, TOP)));
    assert.ok(finish(game).some(e => e.type === 'descend'));
    assert.equal(game.misses, 0);
    assert.equal(game.descent, 1);
});

test('pressure loss happens at the danger line only after resolution', () => {
    const game = new Game(1), bubble = [...game.board.values()].at(-1);
    game.descent = Math.ceil((LINE - R - position(bubble.r, bubble.c).y) / ROW) - 1;
    game.misses = game.level.missLimit - 1;
    assert.equal(game.mode, 'ready');
    game.shoot(aimAt(LEFT, TOP + game.descent * ROW));
    const events = finish(game);
    assert.ok(events.some(e => e.type === 'descend'));
    assert.equal(game.mode, 'lost');
});

test('tools have one deterministic shot per charge; crystal damage is deduplicated', () => {
    const game = new Game(14);
    game.board.clear();
    tile(game, 0, 5, 'X', 2);
    tile(game, 0, 4, 'C');
    tile(game, 1, 4, 'P');
    tile(game, 1, 5, 'P');
    assert.ok(game.select('pulse'));
    assert.ok(game.select('pulse'));
    assert.equal(game.inventory.pulse, 2);
    assert.ok(game.select('pulse'));
    game.shoot(0);
    finish(game);
    assert.equal(game.inventory.pulse, 1);
    assert.equal(game.board.get(key(0, 5)).hp, 1);
    assert.ok(game.select('pulse'));
    game.shoot(0);
    finish(game);
    assert.equal(game.mode, 'won');
    assert.equal(game.unlocked, 1);
});

test('rainbow chooses the supported color near the snap point and preserves normal ammo', () => {
    const game = new Game(4);
    game.board.clear();
    tile(game, 0, 5, 'C');
    tile(game, 0, 4, 'C');
    assert.ok(game.select('rainbow'));
    game.shoot(0);
    assert.ok(finish(game).find(e => e.type === 'pop').bubbles.every(b => b.type === 'C'));
    assert.equal(game.mode, 'won');
});

test('drill previews the unique pierced bubbles in travel order and damages each only once', () => {
    const game = new Game(18);
    game.board.clear();
    for (let r = 0; r < 6; r++) tile(game, r, r % 2 ? 4 : 5, 'X', 2);
    game.select('drill');
    const path = game.preview(0);
    assert.equal(path.pierced.length, 3);
    assert.deepEqual(path.pierced.map(id => Math.floor(id / 11)), [5, 4, 3]);
    game.shoot(0); finish(game);
    assert.equal(game.board.get(key(5, 4)).hp, 1);
    assert.equal(game.board.get(key(4, 5)).hp, 1);
    assert.equal(game.board.get(key(0, 5)).hp, 2);
});

test('records retain independent bests, lock unopened stages and survive reload or denied storage', () => {
    const memory = new Map(), storage = { getItem: id => memory.get(id) ?? null, setItem: (id, value) => memory.set(id, value) };
    const get = () => storage, a = LightbubbleStorage.create(get);
    assert.equal(a.visit(2), false);
    assert.equal(a.finish(2, 300, 4), false);
    assert.ok(a.finish(1, 1700, 8));
    assert.ok(a.finish(1, 1420, 4));
    assert.ok(a.visit(2));
    const restored = LightbubbleStorage.create(get);
    assert.deepEqual(restored.state, { version: 1, open: 2, last: 2, records: { 1: { score: 1700, shots: 4 } } });
    const denied = LightbubbleStorage.create(() => { throw new Error('denied'); });
    assert.ok(denied.finish(1, 420, 2));
    assert.equal(denied.state.open, 2);
    assert.equal(denied.unavailable, true);
});

test('scaled drag previews before release, fires once, and cancellation, second finger or focus clear never shoot', () => {
    const mock = new EventTarget(), root = new EventTarget(), shots = [], updates = [];
    mock.getBoundingClientRect = () => ({ left: 4, top: 20, width: 202, height: 282.5 });
    const input = LightbubbleInput.create({ canvas: mock, target: root, enabled: () => true,
        fire: a => shots.push(a), changed: state => updates.push(state) });
    function send(type, x, y, pointerId = 1) {
        mock.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), {
            clientX: 4 + x / 2, clientY: 20 + y / 2, pointerId, pointerType: 'touch', button: 0
        }));
    }
    send('pointerdown', 202, 300);
    send('pointermove', 80, 301);
    send('pointerup', 200, 200, 2);
    assert.equal(shots.length, 0);
    assert.equal(updates.at(-1).dragging, true);
    send('pointerup', 80, 301);
    assert.deepEqual(shots, [aimAt(80, 301)]);
    send('pointerdown', 152, 200); send('pointermove', 202, 552);
    assert.equal(updates.at(-1).cancel, true);
    send('pointerup', 202, 552);
    send('pointerdown', 98, 200); send('pointercancel', 108, 210); send('pointerup', 116, 215);
    send('pointerdown', 202, 300); input.clear(); send('pointerup', 185, 250);
    assert.equal(shots.length, 1);
});

test('original sector scores provide different eight-bar phrases with a pressure arrangement', () => {
    const tracks = [1, 7, 13].map(n => LightbubbleScore.profile(n));
    assert.equal(new Set(tracks.map(track => track.bpm)).size, 3);
    for (const track of tracks) {
        const notes = Array.from({ length: 128 }, (_, i) => LightbubbleScore.notesForStep(track, i)).flat();
        assert.equal(notes.filter(note => note.voice === 'lead').length, 48);
        assert.ok(notes.every(note => Number.isFinite(note.note)));
    }
    assert.equal(LightbubbleScore.profile(13, 'pressure').intensity, 1);
});

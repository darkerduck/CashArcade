import { DIRECTIONS, add, key, equal } from '../snake/engine.mjs';

// A player-like, deterministic navigator. No teleports, grants, score edits or powers.
// Every returned input is played through the real fixed-step simulation.
export function nextInput(game) {
    const target = game.collected >= game.level.quota ? game.level.exit : game.food;
    const blocked = new Set([...game.walls, ...game.snake.slice(1, game.growth ? undefined : -1).map(key),
        ...game.bombs.map(key), ...game.level.gates.flatMap(g => g.cells.map(key)),
        ...[game.power, game.dessert].filter(Boolean).map(key)]);
    const queue = [{ p: game.snake[0], direction: game.direction, first: null }], visited = new Set();
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (equal(node.p, target) && node.first) return node.first;
        for (const [name, d] of Object.entries(DIRECTIONS)) {
            if (d.x === -node.direction.x && d.y === -node.direction.y && d.z === -node.direction.z) continue;
            const entry = add(node.p, d), p = game.portal(entry) || entry;
            const k = key(p), v = `${k}:${name}`;
            if (!game.inside(p) || blocked.has(k) || visited.has(v)) continue;
            visited.add(v); queue.push({ p, direction: d, first: node.first || name });
        }
    }
    throw new Error(`No route in level ${game.levelIndex + 1} at step ${game.steps}`);
}
export function stepInput(game, name) {
    game.input(name);
    const step = game.steps;
    for (let i = 0; i < 100 && game.steps === step && game.state === 'running'; i++) game.advance(10);
    return game.drain();
}
export function finishLevel(game) {
    game.start(); const actions = [], events = [];
    while (game.state === 'running' && actions.length < 2000) {
        const name = nextInput(game); actions.push(name); events.push(...stepInput(game, name));
    }
    return { actions, events };
}

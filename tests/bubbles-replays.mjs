import '../bubbles/levels.js';
import '../bubbles/engine.js';

const { Game } = globalThis.Lightbubble;
const radians = degrees => degrees * Math.PI / 180;
const toolTypes = Object.keys(globalThis.LightbubbleLevels.tools);
const angles = Array.from({ length: 151 }, (_, i) => i - 75);

export function playShot(game, [degree, action = 'keep']) {
    if (action === 'swap' && !game.swap()) throw new Error('Swap unavailable');
    if (toolTypes.includes(action) && !game.select(action)) throw new Error('Tool unavailable');
    if (!game.shoot(radians(degree))) throw new Error('Shot unavailable');
    for (let i = 0; game.mode === 'flight' && i < 320; i++) game.update(1 / 120);
    game.drain();
    return game;
}

// Sample unique landings in both directions and choose from normal player actions.
// A bounded beam explores misses that are useful for setting up a later match.
export function solve(level, width = 7, maxShots = 42) {
    let candidates = [{ game: new Game(level), replay: [], value: 0 }];
    const utility = (game, initial) => {
        const remaining = initial - game.remaining;
        const tools = Object.values(game.inventory).reduce((a, b) => a + b, 0);
        return remaining * 52 - game.board.size * 9 + Math.min(game.score, 80000) * 0.004 +
            tools * 23 - game.misses * 5 - game.descent * 30;
    };
    const initial = candidates[0].game.remaining;
    for (let shot = 0; shot < maxShots; shot++) {
        const next = new Map();
        for (const { game, replay } of candidates) {
            const available = ['keep', ...(game.current !== game.next ? ['swap'] : []),
                ...toolTypes.filter(name => game.inventory[name])];
            for (const action of available) {
                const aimed = game.clone();
                if (action === 'swap') aimed.swap();
                else if (action !== 'keep') aimed.select(action);
                const landings = new Set();
                for (const angle of angles) {
                    const path = aimed.preview(radians(angle));
                    const signature = JSON.stringify([path.cell?.r, path.cell?.c, path.hit?.r, path.hit?.c, path.pierced]);
                    if (landings.has(signature)) continue;
                    landings.add(signature);
                    const demo = aimed.clone();
                    demo.shoot(radians(angle));
                    demo.settle();
                    const sequence = [...replay, [angle, action]];
                    if (demo.mode === 'won') return sequence;
                    if (demo.mode !== 'ready') continue;
                    const value = utility(demo, initial);
                    const state = JSON.stringify([...demo.board].sort(([a], [b]) => a - b)
                        .map(([id, cell]) => [id, cell.type, cell.hp]).concat([[demo.current, demo.next, demo.stockIndex, demo.misses, demo.descent, demo.inventory]]));
                    if (!next.has(state) || next.get(state).value < value) next.set(state, { game: demo, replay: sequence, value });
                }
            }
        }
        candidates = [...next.values()].sort((a, b) => b.value - a.value).slice(0, width);
        if (!candidates.length) return null;
    }
    return null;
}

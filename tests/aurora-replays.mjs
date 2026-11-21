import '../aurora/levels.js';
import '../aurora/engine.js';

const { LANES, roadAt } = AuroraRoutes;
const { Game, STEP, bodies } = AuroraSprint;
const bound = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function drive(game, lane) {
    const options = LANES.map((x, i) => {
        let cost = Math.abs(i - lane) * 0.7;
        for (const object of game.objects) {
            const gap = object.z - game.distance, closing = Math.max(0, game.speed - object.speed);
            if (gap < -6 || gap > 125) continue;
            const t = gap / Math.max(10, closing);
            const change = object.change;
            let ox = object.x;
            if (change && object.age + t > change.delay) ox = LANES[change.lane];
            if (Math.abs(x - ox) > 2.25 && Math.abs(x - object.x) > 2.25) continue;
            if (object.type === 'cell') cost -= Math.max(.1, 1.5 - t * .27);
            else cost += 12 / Math.max(.34, t) + bodies[object.type].width;
        }
        return { i, cost };
    });
    const chosen = options.sort((a, b) => a.cost - b.cost)[0].i;
    const target = LANES[chosen], drift = roadAt(game.level, game.distance).curve * game.speed ** 2 * .00105;
    const danger = game.objects.some(o => o.type !== 'cell' && o.z - game.distance > -3 &&
        o.z - game.distance < 13 && Math.abs(o.x - game.x) < 2.2);
    const clear = !game.objects.some(o => o.type !== 'cell' && o.z > game.distance &&
        o.z - game.distance < 78 && Math.abs(LANES[chosen] - o.x) < 2.6);
    return {
        lane: chosen, steer: bound(((target - game.x) * 4.3 - game.lateral * .45 + drift) /
            (3.2 + game.speed * .113), -1, 1),
        brake: danger, nitro: clear && !danger && game.speed > 42 && Math.abs(game.x - target) < .95
    };
}
export function replay(level) {
    const game = new Game(level);
    game.start();
    let lane = 1, action = {};
    const events = {};
    for (let frame = 0; frame < 120 * 125 && game.mode === 'running'; frame++) {
        if (frame % 6 === 0) { action = drive(game, lane); lane = action.lane; }
        game.update(STEP, action);
        for (const { type } of game.drain()) events[type] = (events[type] ?? 0) + 1;
    }
    return { game, events };
}

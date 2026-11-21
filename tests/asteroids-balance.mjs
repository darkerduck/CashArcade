import '../asteroids/data.js';
import '../asteroids/storage.js';
import '../asteroids/engine.js';

const { Game, STEP, wrap, direction, distance, TURN } = NeonAsteroids;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
// This pilot can only send the same four buttons as the regular controller.
function pilot(game) {
    const p = game.player;
    const speed = Math.hypot(p.vx, p.vy);
    const threats = game.targets.filter(t => !t.dead);
    const targets = threats.filter(t => !game.locked(t));
    targets.sort((a, b) => distance(p, a) - distance(p, b));
    let angle = p.angle, aim = p.angle, thrust = false;
    const target = targets[0];
    const nearest = threats.reduce((best, t) => !best || distance(p, t) < distance(p, best) ? t : best, null);
    const preferred = game.loot.filter(item => item.type === 'repair' && p.hull < 3 ||
        item.type === 'shield' && !p.shield || item.type === 'escort' && p.escorts < 2 ||
        item.type === 'laser' || item.type === 'spread' && !p.laser)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
    if (target) {
        const flight = distance(p, target) / (p.weapon === 'laser' ? 800 : 510);
        aim = direction(p, { x: wrap(target.x + ((target.vx ?? 0) - p.vx * .35) * flight),
            y: wrap(target.y + ((target.vy ?? 0) - p.vy * .35) * flight) });
        angle = aim;
    }
    const danger = game.fields.find(field => field.lethal && distance(field, p) < 153);
    const predicted = { x: wrap(p.x + p.vx * .55), y: wrap(p.y + p.vy * .55) };
    const crossing = game.projectiles.find(shot => shot.hostile &&
        distance(predicted, { x: wrap(shot.x + shot.vx * .55), y: wrap(shot.y + shot.vy * .55) }) < 39);
    if (danger) {
        angle = direction(danger, p);
        thrust = true;
    } else if (nearest && distance(p, nearest) < nearest.radius + 78) {
        angle = direction(nearest, p);
        thrust = true;
    } else if (crossing && speed < 175) {
        const ballistic = Math.atan2(crossing.vy, crossing.vx);
        const a = ballistic + Math.PI / 2, b = ballistic - Math.PI / 2;
        angle = Math.abs(angleDelta(p.angle, a)) < Math.abs(angleDelta(p.angle, b)) ? a : b;
        thrust = true;
    } else if (preferred && distance(p, preferred) < 220) {
        const aimAt = { x: wrap(preferred.x + ((preferred.vx ?? 0) - p.vx) * .7),
            y: wrap(preferred.y + ((preferred.vy ?? 0) - p.vy) * .7) };
        angle = direction(p, aimAt);
        thrust = true;
    } else if (game.data.boss && !game.boss && distance({ x: 360, y: 190 }, p) < 260) {
        angle = direction({ x: 360, y: 190 }, p); thrust = true;
    } else if (speed > (game.boss ? 165 : 90)) {
        angle = Math.atan2(-p.vy, -p.vx);
        thrust = true;
    } else if (game.boss && speed < 72) {
        angle = direction(p, game.boss) + Math.PI / 2 + Math.sin(game.time * .25) * .55;
        thrust = true;
    }
    const turn = angleDelta(p.angle, angle);
    return { left: turn < -TURN * STEP / 2, right: turn > TURN * STEP / 2,
        thrust: thrust && Math.abs(turn) < .30, fire: Boolean(target) && Math.abs(angleDelta(p.angle, aim)) < .08 };
}
for (const seed of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [91, 719, 2026])) {
    let checkpoint = NeonAsteroidsStorage.fresh(seed);
    const run = [];
    while (checkpoint) {
        const game = new Game(checkpoint);
        let hits = 0;
        for (let step = 0; step < 120 * 210 && game.mode === 'running'; step++) {
            game.update(STEP, pilot(game));
            hits += game.drain().filter(event => ['hurt', 'shield'].includes(event.type)).length;
        }
        run.push({ level: game.level, result: game.mode, time: Number(game.time.toFixed(1)),
            hits, hull: game.player.hull, weapon: game.player.weapon, failure: game.failure });
        checkpoint = game.nextCheckpoint();
    }
    console.log(JSON.stringify({ seed, totalSeconds: Number(run.reduce((sum, level) => sum + level.time, 0).toFixed(1)), run }));
}

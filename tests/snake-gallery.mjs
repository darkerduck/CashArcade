import { SnakeGame, LEVELS, POWERS } from '../snake/engine.mjs';
import { SnakeRenderer } from '../snake/renderer.mjs';
import { finishLevel } from './snake-replay-helper.mjs';
import { playEvents } from '../snake/audio-events.mjs';
const $ = id => document.getElementById(id);
let game, replay = [], nextStep = -1, playing = false, previousFrame = 0, frames = [], draws = [], lost = false;
const renderer = new SnakeRenderer($('scene'), {
    onLost() { lost = true; playing = false; game.pause(); $('result').textContent = 'Context lost: simulation paused.'; },
    onRestored() { lost = false; renderer.survey(true); $('result').textContent = 'Context restored: remains paused, explicit resume required.'; },
});
const sound = CashArcadeAudio.create({ storageKey: 'casharcade-snake-gallery-sound-muted', toggleButton: document.createElement('button'), musicMix: true });
const silenceMusic = { duck() {}, pause() {} };
LEVELS.forEach((level, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1} · ${level.name}`; $('level').append(o); });
function load(showcase = false) {
    playing = false; replay = []; nextStep = -1; game = new SnakeGame(Number($('level').value));
    if (showcase) {
        game.snake = [{ x: 7, y: 0, z: 7 }, { x: 6, y: 0, z: 7 }, { x: 5, y: 0, z: 7 }, { x: 4, y: 0, z: 7 },
            { x: 3, y: 0, z: 7 }, { x: 3, y: 0, z: 6 }, { x: 3, y: 1, z: 6 }, { x: 3, y: 1, z: 5 },
            { x: 4, y: 1, z: 5 }, { x: 5, y: 1, z: 5 }, { x: 6, y: 1, z: 5 }, { x: 6, y: 1, z: 4 },
            { x: 6, y: 2, z: 4 }, { x: 6, y: 2, z: 3 }, { x: 5, y: 2, z: 3 }, { x: 4, y: 2, z: 3 }];
        game.previous = structuredClone(game.snake); game.food = { x: 8, y: 0, z: 7 }; game.dessert = { x: 7, y: 0, z: 2 }; game.bombs = [{ x: 1, y: 0, z: 5 }];
    }
    renderer.load(game); frames = []; draws = [];
}
$('level').addEventListener('change', () => load()); $('showcase').addEventListener('click', () => load(true));
$('replay').addEventListener('click', () => {
    const index = Number($('level').value), result = finishLevel(new SnakeGame(index)); load();
    replay = result.actions; game.start(); playing = true; sound.resume();
    $('result').textContent = `回放 ${replay.length} 個方向輸入；無修改分數、碰撞、時間或道具。`;
});
$('pause').addEventListener('click', () => { playing = !playing; if (playing) { game.start(); renderer.survey(false); } else { game.pause(); renderer.survey(true); } });
$('theme').addEventListener('click', () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; });
$('low').addEventListener('click', () => renderer.setLow());
$('context').addEventListener('click', () => {
    const extension = renderer.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!extension) { $('result').textContent = 'WEBGL_lose_context unavailable'; return; }
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 800);
});
for (const [kind, power] of Object.entries(POWERS)) {
    const b = document.createElement('button'); b.textContent = `${power.glyph} ${power.name}`;
    b.addEventListener('click', () => { game.collectPower(kind, game.snake[0]); const e = game.drain(); renderer.events(e, game); sound.resume(); playEvents(e, sound, silenceMusic); }); $('powers').append(b);
}
function loop(now) {
    requestAnimationFrame(loop); if (!game || lost || document.hidden) { previousFrame = now; return; }
    const delta = previousFrame ? Math.min(100, now - previousFrame) : 0; previousFrame = now;
    if (playing && game.state === 'running') {
        if (nextStep !== game.steps && replay[game.steps]) { game.input(replay[game.steps]); nextStep = game.steps; }
        game.advance(delta); const events = game.drain(); renderer.events(events, game); playEvents(events, sound, silenceMusic);
        if (game.state !== 'running') { playing = false; $('result').textContent += `\n${game.state}: ${game.score} points; ${game.steps} steps; ${game.time} ms`; }
    }
    const start = performance.now(); renderer.draw(game, game.state === 'paused' ? 0 : delta / 1000); draws.push(performance.now() - start); frames.push(delta);
    if (draws.length > 240) { draws.shift(); frames.shift(); }
    if (draws.length % 30 === 0) {
        const percentile = a => a.slice().sort((a, b) => a - b)[Math.floor(a.length * .95)];
        $('metrics').textContent = JSON.stringify({ state: game.state, level: game.levelIndex + 1, height: game.snake[0].y, score: game.score,
            mode: renderer.low ? 'low' : 'high', fps: +(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1),
            renderP95ms: +percentile(draws).toFixed(2), frameP95ms: +percentile(frames).toFixed(2),
            calls: renderer.renderer.info.render.calls, particles: renderer.particles.length, rings: renderer.rings.length, bolts: renderer.bolts.length });
    }
}
$('listen').addEventListener('click', () => { sound.resume(); sound.play('food'); });
$('measure').addEventListener('click', async () => {
    const names = ['food', 'dessert', 'snakeShield', 'snakeSlow', 'snakeShrink', 'snakeMagnet', 'snakeEmp', 'snakePortal', 'snakeShieldHit', 'snakeWarning'];
    const results = []; $('measure').disabled = true;
    try {
        for (const name of names) {
            const context = new OfflineAudioContext(1, 44100 * 2, 44100), Original = window.AudioContext;
            window.AudioContext = function () { return new Proxy(context, { get(target, k) { if (k === 'state') return 'running'; const v = Reflect.get(target, k, target); return typeof v === 'function' ? v.bind(target) : v; } }); };
            try { const engine = CashArcadeAudio.create({ storageKey: 'casharcade-snake-gallery-offline', toggleButton: document.createElement('button'), musicMix: true }); engine.play(name, .03); }
            finally { window.AudioContext = Original; }
            const buffer = await context.startRendering(), data = buffer.getChannelData(0);
            let peak = 0, sum = 0, first = -1, last = 0, clipped = 0;
            data.forEach((v, i) => { peak = Math.max(peak, Math.abs(v)); if (Math.abs(v) > .001) { if (first === -1) first = i; last = i; } if (Math.abs(v) >= 1) clipped++; });
            for (let i = Math.max(0, first); i <= last; i++) sum += data[i] ** 2;
            results.push({ name, duration: +(Math.max(0, last - first) / 44100).toFixed(3), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, last - first)).toFixed(3), clipped });
        }
        $('result').textContent = `${results.every(r => r.duration > .08 && r.rms > .01 && r.peak < 1 && r.clipped === 0) ? 'PASS' : 'FAIL'} · 原生 OfflineAudioContext\n${JSON.stringify(results, null, 2)}`;
    } catch (error) { $('result').textContent = `FAIL ${error.message}`; }
    finally { $('measure').disabled = false; }
});
load(true); await renderer.ready(); requestAnimationFrame(loop);

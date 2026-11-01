import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { musicStub } from './music-stub.mjs';

const gateSource = readFileSync(new URL('../breakout/payment-gate.js', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../breakout/game.js', import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, `
window.inspect = {
    state: () => ({ gameState: pending ? 'replay-pending' : game.state, score: game.score, lives: game.lives, levelIndex: game.levelIndex, paidReady, storageBlocked, charging: game.paddle.charging }),
    set: (state, points = game.score) => { pending = false; game.state = state; game.score = points; },
    game: () => game,
    setBall: value => { Object.assign(game.balls[0], value); },
    setBricks: value => { game.bricks = value.map((b,i) => ({...b,id:i+1,bx:b.x,by:b.y,w:b.width,h:b.height,type:b.maxHp>1?'armor':'normal'})); },
    setLevel: value => { game.levelIndex = value; },
    checkpoint, handleStart, requestNewGame, processEvents,
    update: dt => { game.tick(dt); processEvents(); },
    collideWithBricks: () => { const b=game.balls[0]; const brick=game.bricks.find(x=>b.x>=x.x&&b.x<=x.x+x.w&&b.y>=x.y&&b.y<=x.y+x.h&&x.hp>0); game.hitBrick(brick,1,{ball:b}); game.checkComplete(); processEvents(); },
    completeLevel: () => { game.levelIndex=29; game.level.boss=null; game.bricks.forEach(b=>b.hp=0); game.checkComplete(); processEvents(); },
    loseLife: () => { game.loseLife(); processEvents(); }
};
})();`);
const KEY = 'clgame_1B2urqXhsmgm1tz3HmqppmCd3VElMeIXOUDGV5HUpwmSTReR';
const PENDING = 'casharcade.breakout.replay-pending.v1';
const SDK_KEY = `cashlink.arcade.v1.${KEY}`;
const flush = () => new Promise(resolve => setImmediate(resolve));
function storage() {
    const map = new Map();
    return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}
function element() {
    const handlers = new Map();
    return {
        handlers, textContent: '', disabled: false, hidden: true, dataset: {}, focus() {},
        addEventListener: (name, handler) => handlers.set(name, handler),
        removeAttribute(name) { delete this[name]; },
        click() { if (!this.disabled) return handlers.get('click')?.({}); },
        getBoundingClientRect: () => ({ left: 0, width: 720 }),
        setPointerCapture() {}, releasePointerCapture() {},
        getContext: () => new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {} }),
    };
}
async function harness({ session = storage(), local = storage(), handshakeError = false, purpose = '再來一局' } = {}) {
    const elements = new Map();
    const events = new Map();
    const sdkEvents = new Map();
    const attempts = [];
    const audioEvents = [];
    const musicEvents = [];
    let failHandshake = handshakeError;
    const sdk = {
        on: (name, handler) => sdkEvents.set(name, handler),
        handshake: async () => { if (failHandshake) throw new Error('offline'); return { origin: 'https://darkerduck.github.io', unlock_description: purpose }; },
        unlock: () => new Promise((resolve, reject) => attempts.push({ resolve, reject })),
        cancel: () => attempts.at(-1)?.reject({ code: 'cancelled' }),
    };
    const sandbox = {
        ...musicStub(musicEvents),
        sessionStorage: session, localStorage: local, URL,
        CashLinkArcade: { create: options => { assert.equal(options.publishableKey, KEY); return sdk; } },
        CashArcadeAudio: { create: () => ({ play: name => audioEvents.push(name), resume() {} }) },
        performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
        matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ getPropertyValue: () => '#000' }),
        addEventListener: (name, handler) => events.set(`window:${name}`, handler),
        document: {
            documentElement: { dataset: {} },
            querySelector: selector => { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
            addEventListener: (name, handler) => events.set(name, handler),
        },
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    for (const file of ['levels.js','engine.js','storage.js']) vm.runInContext(readFileSync(new URL(`../breakout/${file}`,import.meta.url),'utf8'),context);
    context.NeonBreakout.Renderer = class { draw() {} accept() {} };
    vm.runInContext(gateSource, context);
    vm.runInContext(gameSource, context);
    await flush();
    return {
        context, session, local, attempts, sdkEvents, audioEvents, musicEvents,
        click: selector => elements.get(selector).click(),
        el: selector => elements.get(selector),
        key(key, code = '', repeat = false) { let prevented = false; events.get('keydown')({ key, code, repeat, preventDefault() { prevented = true; } }); return prevented; },
        keyUp(key) { events.get('keyup')({ key, preventDefault() {} }); },
        state: () => context.inspect.state(), set: (...args) => context.inspect.set(...args),
        inspect: context.inspect,
        checkpoint: () => context.inspect.checkpoint(),
        connect: () => { failHandshake = false; },
        hidden(value) { context.document.hidden=value; events.get('visibilitychange')(); },
    };
}

function failStage(h, levelIndex) {
    h.click('#start-button');
    const game = h.inspect.game();
    game.levelIndex = levelIndex;
    game.wave = levelIndex === 28 ? 2 : 0;
    game.bossPhase = levelIndex === 29 ? 2 : 0;
    game.loadLevel();
    game.bricks.find(b => b.hp > 0).hp = 0;
    game.score = 345;
    game.lives = 1;
    game.loseLife();
    h.inspect.processEvents();
    assert.equal(h.state().gameState, 'over');
}

function replayControl(h, control) {
    if (control === 'space') return h.key(' ', 'Space');
    if (control === 'enter') return h.key('Enter');
    if (control === 'r') return h.key('r');
    return h.click(control);
}

function assertFreshStage(h, levelIndex) {
    const game = h.inspect.game();
    assert.equal(game.levelIndex, levelIndex);
    assert.equal(game.state, 'running');
    assert.equal(game.lives, 3);
    assert.equal(game.score, 0);
    assert.equal(game.wave, 0);
    assert.equal(game.bossPhase, 0);
    assert.equal(game.items.length, 0);
    assert.equal(Object.keys(game.effects).length, 0);
    assert.equal(game.balls.length, 1);
    const expected = h.context.NeonBreakout.createLevel(levelIndex);
    const layout = bricks => JSON.stringify(bricks.map(b => [b.id, b.bx, b.by, b.w, b.h, b.type, b.hp, b.maxHp]));
    assert.equal(layout(game.bricks), layout(expected.bricks));
    assert.equal(h.musicEvents.filter(e => e[0] === 'start').at(-1)[1], levelIndex + 1);
}

for (const levelIndex of [6, 9, 19, 28, 29]) {
    for (const control of ['#start-button', '#restart-button', '#payment-retry', 'space', 'enter', 'r']) {
        test(`paid ${control} retries failed stage ${levelIndex + 1} with fresh lives, layout and music`, async () => {
            const h = await harness();
            failStage(h, levelIndex);
            replayControl(h, control);
            assert.equal(h.attempts.length, 1);
            assert.equal(h.state().levelIndex, levelIndex);
            assert.equal(h.state().score, 345);
            assert.match(h.el('#payment-retry').textContent, new RegExp(`第 ${levelIndex + 1} 關`));
            assert.match(h.el('#overlay-message').textContent, new RegExp(`第 ${levelIndex + 1} 關`));
            h.attempts[0].resolve({ credit_status: 'consumed' });
            await flush();
            assertFreshStage(h, levelIndex);
        });
    }
}

test('cancelled replay retains the failed stage through reload and serializes the resumed unlock', async () => {
    const h = await harness();
    failStage(h, 18);
    h.key('r');
    h.attempts[0].reject({ code: 'cancelled' });
    await flush();
    const reload = await harness({ session: h.session, local: h.local });
    assert.equal(reload.state().levelIndex, 18);
    assert.equal(reload.attempts.length, 0);
    reload.click('#payment-retry');
    reload.key('r'); reload.click('#start-button');
    assert.equal(reload.attempts.length, 1);
    reload.attempts[0].resolve({ credit_status: 'consumed' });
    await flush();
    assertFreshStage(reload, 18);
    const paidReload = await harness({ session: reload.session, local: reload.local });
    assert.equal(paidReload.state().levelIndex, 18);
    assert.equal(paidReload.state().gameState, 'paused');
    paidReload.click('#start-button');
    assert.equal(paidReload.attempts.length, 0);
    assert.equal(paidReload.state().levelIndex, 18);
});

test('consumed replay survives a failed save at the same late stage without a second charge', async () => {
    for (const reload of [false, true]) {
        const h = await harness();
        failStage(h, 29);
        h.click('#restart-button');
        const write = h.local.setItem;
        h.local.setItem = () => { throw Error('quota'); };
        h.attempts[0].resolve({ credit_status: 'consumed' });
        await flush();
        assert.equal(h.state().levelIndex, 29);
        assert.equal(h.state().score, 345);
        h.local.setItem = write;
        if (reload) {
            const restored = await harness({ session: h.session, local: h.local });
            assert.equal(restored.state().gameState, 'paused');
            assert.equal(restored.state().levelIndex, 29);
            restored.click('#start-button');
            assert.equal(restored.attempts.length, 0);
            assertFreshStage(restored, 29);
        } else {
            await h.click('#payment-retry');
            assert.equal(h.attempts.length, 1);
            assertFreshStage(h, 29);
        }
    }
});

test('voluntary replay stays at the current stage, while completed campaign replay returns to stage one', async () => {
    for (const state of ['running', 'paused', 'won']) {
        const h = await harness();
        failStage(h, 29);
        h.set(state, 345);
        h.key('r');
        assert.equal(h.attempts.length, 1);
        h.attempts[0].resolve({ credit_status: 'consumed' });
        await flush();
        assertFreshStage(h, state === 'won' ? 0 : 29);
    }
});

test('first play, pause/resume, lost-life relaunch and level transition are free', async () => {
    const h = await harness();
    h.click('#start-button');
    assert.equal(h.state().gameState, 'running');
    h.click('#pause-button');
    h.click('#start-button');
    h.set('life-lost'); h.click('#start-button');
    h.set('level-clear'); h.click('#start-button');
    assert.equal(h.state().levelIndex, 1);
    assert.equal(h.state().gameState, 'running');
    assert.equal(h.attempts.length, 0);
    assert.equal(h.key(' ', 'Space'), true);
    assert.equal(h.state().charging, true);
    h.keyUp(' '); h.key('p');
    assert.equal(h.state().gameState, 'paused');
});

test('music follows committed stages and freezes through checkout, cancellation, storage failure and reload',async()=>{
    const h=await harness(); assert.equal(h.musicEvents.length,0);
    h.click('#start-button'); assert.equal(h.musicEvents.filter(e=>e[0]==='start').length,1);
    assert.equal(h.musicEvents.find(e=>e[0]==='start')[1],1);
    h.click('#pause-button'); assert.equal(h.musicEvents.at(-1)[0],'pause');
    h.click('#start-button'); assert.ok(h.musicEvents.some(e=>e[0]==='resume'));
    h.set('level-clear'); h.inspect.processEvents(); assert.equal(h.musicEvents.at(-1)[0],'pause');
    h.click('#start-button'); assert.equal(h.musicEvents.filter(e=>e[0]==='start').at(-1)[1],2);
    h.click('#restart-button'); assert.equal(h.musicEvents.at(-1)[0],'pause');
    const starts=h.musicEvents.filter(e=>e[0]==='start').length;
    h.click('#start-button'); h.key('r'); assert.equal(h.attempts.length,1);
    h.attempts[0].reject({code:'cancelled'}); await flush();
    assert.equal(h.musicEvents.filter(e=>e[0]==='start').length,starts);
    const restored=await harness({local:h.local,session:h.session}); assert.equal(restored.musicEvents.length,0);
    restored.click('#payment-retry'); restored.attempts[0].resolve({credit_status:'consumed'}); await flush();
    assert.equal(restored.musicEvents.filter(e=>e[0]==='start').length,1);
    restored.hidden(true); assert.equal(restored.musicEvents.at(-1)[0],'pause');
});

test('all new-game controls serialize one awaited unlock; events do not authorize play', async () => {
    const h = await harness();
    h.click('#start-button'); h.set('running', 125);
    const restart = h.click('#restart-button');
    h.key('R'); h.click('#payment-retry'); h.click('#start-button');
    assert.equal(h.attempts.length, 1);
    assert.equal(h.state().gameState, 'replay-pending');
    assert.equal(h.state().score, 125);
    assert.deepEqual(h.audioEvents, ['start']);
    h.sdkEvents.get('payment_status')({ credit_status: 'available' });
    h.sdkEvents.get('unlocked')({ credit_status: 'consumed' });
    assert.equal(h.state().gameState, 'replay-pending');
    h.attempts[0].resolve({ credit_status: 'consumed' }); await restart;
    assert.equal(h.state().score, 0);
    assert.equal(h.state().gameState, 'running');
    assert.deepEqual(h.audioEvents, ['start', 'start']);
    assert.equal(h.session.getItem(PENDING), null);
});

for (const [state, control] of [['over', 'button'], ['won', 'button'], ['over', 'space'], ['running', 'r']]) {
    test(`${state}/${control} enters the same paid gate`, async () => {
        const h = await harness(); h.set(state, 50);
        if (control === 'button') h.click('#start-button');
        else h.key(control === 'space' ? ' ' : 'r', control === 'space' ? 'Space' : 'KeyR');
        assert.equal(h.attempts.length, 1);
        assert.equal(h.state().score, 50);
        h.attempts[0].reject({ code: 'cancelled' }); await flush();
    });
}

for (const code of ['cancelled', 'network_error', 'temporarily_unavailable', 'popup_blocked']) {
    test(`${code} keeps original order and does not start a replacement`, async () => {
        const h = await harness(); h.set('over', 95);
        h.local.setItem(SDK_KEY, 'original-sdk-state');
        const promise = h.click('#restart-button');
        h.attempts[0].reject({ code, checkoutUrl: 'https://linkincash.cc/arcade/checkout/12345678-abcd#secret=test-only' });
        await promise;
        assert.equal(h.state().gameState, 'replay-pending');
        assert.equal(h.state().score, 95);
        assert.equal(h.session.getItem(PENDING), '1');
        assert.equal(h.local.getItem(SDK_KEY), 'original-sdk-state');
        if (code === 'popup_blocked') assert.equal(h.el('#payment-link').hidden, false);
        const reloaded = await harness({ session: h.session, local: h.local });
        assert.equal(reloaded.state().gameState, 'replay-pending');
        assert.equal(reloaded.attempts.length, 0);
        const retry = reloaded.click('#payment-retry');
        assert.equal(reloaded.attempts.length, 1);
        reloaded.attempts[0].resolve({ credit_status: 'consumed' }); await retry;
        assert.equal(reloaded.state().gameState, 'running');
    });
}

test('cancel button settles pending unlock without resetting game', async () => {
    const h = await harness(); h.set('over', 20);
    const promise = h.click('#restart-button'); h.click('#payment-cancel'); await promise;
    assert.equal(h.state().score, 20);
    assert.equal(h.el('#restart-button').disabled, false);
});

test('active round reload restores paused checkpoint and continues without payment', async () => {
    const h = await harness(); h.click('#start-button'); h.set('running', 135); h.checkpoint();
    const reload = await harness({ session: h.session, local: h.local });
    assert.equal(reload.state().gameState, 'paused');
    assert.equal(reload.state().score, 135);
    reload.click('#start-button');
    assert.equal(reload.state().gameState, 'running');
    assert.equal(reload.attempts.length, 0);
});

test('committed paid checkpoint closes crash window before pending marker cleanup', async () => {
    const h = await harness(); const promise = h.click('#restart-button');
    h.attempts[0].resolve({ credit_status: 'consumed' }); await promise;
    h.session.setItem(PENDING, '1');
    const reload = await harness({ session: h.session, local: h.local });
    assert.equal(reload.state().gameState, 'paused');
    assert.equal(reload.session.getItem(PENDING), null);
    reload.click('#start-button'); assert.equal(reload.attempts.length, 0);
    const next = reload.click('#restart-button');
    reload.attempts[0].reject({ code: 'cancelled' }); await next;
    const again = await harness({ session: h.session, local: h.local });
    assert.equal(again.state().gameState, 'replay-pending');
});

test('failed handshake needs a fresh gesture after reconnect, preserving popup activation', async () => {
    const h = await harness({ handshakeError: true });
    h.connect(); await h.click('#restart-button');
    assert.equal(h.attempts.length, 0);
    const promise = h.click('#restart-button'); assert.equal(h.attempts.length, 1);
    h.attempts[0].reject({ code: 'cancelled' }); await promise;
});

test('wrong payment purpose, unavailable intent storage and unconsumed results fail closed', async () => {
    const mismatch = await harness({ purpose: 'wrong purpose' });
    await mismatch.click('#restart-button'); assert.equal(mismatch.attempts.length, 0);
    const h = await harness();
    h.session.setItem = () => { throw new Error('storage denied'); };
    await h.click('#restart-button'); assert.equal(h.attempts.length, 0);
    const invalid = await harness(); invalid.set('over', 44);
    const promise = invalid.click('#restart-button'); invalid.attempts[0].resolve({ credit_status: 'available' }); await promise;
    assert.equal(invalid.state().score, 44);
    assert.equal(invalid.state().gameState, 'replay-pending');
});

test('untrusted popup fallback URLs are never displayed', async () => {
    const h = await harness();
    const promise = h.click('#restart-button');
    h.attempts[0].reject({ code: 'popup_blocked', checkoutUrl: 'https://evil.example/arcade/checkout/123#secret' }); await promise;
    assert.equal(h.el('#payment-link').hidden, true);
    assert.equal(h.el('#payment-link').href, undefined);
});

test('breakout collision and transition sounds follow gameplay, not redraws', async () => {
    const h = await harness(); h.click('#start-button');
    h.inspect.setBricks([
        { x: 100, y: 100, width: 64, height: 22, hp: 2, maxHp: 2, row: 0 },
        { x: 210, y: 100, width: 64, height: 22, hp: 1, maxHp: 1, row: 0 },
    ]);
    h.inspect.setBall({ x: 110, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    h.inspect.setBall({ x: 110, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    h.inspect.setBall({ x: 220, y: 110, vx: 0, vy: 200 }); h.inspect.collideWithBricks(.016);
    assert.deepEqual(h.audioEvents.slice(0, 5), ['start', 'crack', 'reinforced', 'brick', 'level']);
    h.inspect.setBricks([{ x: 100, y: 100, width: 64, height: 22, hp: 1, maxHp: 1, row: 0 }]);
    h.set('running'); h.inspect.setBall({ x: 9, y: 320, vx: -100, vy: -100 }); h.inspect.update(.025);
    h.inspect.setBall({ x: 360, y: 490, vx: 0, vy: 200 }); h.inspect.update(.025);
    assert.ok(h.audioEvents.includes('wall'));
    assert.ok(h.audioEvents.includes('paddle'));
    h.inspect.loseLife();
    assert.ok(h.audioEvents.includes('life'));
    h.set('running'); h.inspect.setLevel(29); h.inspect.completeLevel();
    assert.equal(h.audioEvents.at(-1), 'win');
});

test('denied durable intent storage never opens checkout or overwrites the active game', async () => {
    const h=await harness();h.click('#start-button');h.set('running',88);h.checkpoint();
    const original=h.local.getItem('casharcade.breakout.round.v2');h.local.setItem=()=>{throw Error('quota');};
    await h.click('#restart-button');assert.equal(h.attempts.length,0);assert.equal(h.state().score,88);assert.equal(h.local.getItem('casharcade.breakout.round.v2'),original);assert.equal(h.state().storageBlocked,true);
});

test('consumed credit plus failed commit retains a candidate; retry and reload never charge twice', async () => {
    for(const reload of [false,true]) {
        const h=await harness();h.click('#start-button');h.set('over',123);
        const promise=h.click('#restart-button'), write=h.local.setItem;
        h.local.setItem=()=>{throw Error('quota');};h.attempts[0].resolve({credit_status:'consumed'});await promise;
        assert.equal(h.state().score,123);assert.ok(h.session.getItem('casharcade.breakout.paid-backup.v2'));assert.equal(h.audioEvents.filter(n=>n==='start').length,1);
        h.local.setItem=write;
        if(reload){const r=await harness({session:h.session,local:h.local});assert.equal(r.state().gameState,'paused');assert.equal(r.state().score,0);assert.equal(r.audioEvents.length,0);r.click('#start-button');assert.equal(r.attempts.length,0);}
        else {await h.click('#payment-retry');assert.equal(h.attempts.length,1);assert.equal(h.state().score,0);assert.equal(h.state().gameState,'running');}
    }
});

test('reload with an old finished or payment-pending checkpoint cannot obtain a free upgraded round', async () => {
    for(const state of ['over','won']) {
        const session=storage();session.setItem('casharcade.breakout.round.v1',JSON.stringify({version:1,gameState:state,score:72,lives:state==='over'?0:2,levelIndex:2,paidReady:false,bricks:[{x:100,y:100,width:64,height:22,hp:1,maxHp:1}],ball:{x:200,y:300,vx:100,vy:100,attached:false},paddle:{x:280}}));
        const h=await harness({session});assert.equal(h.state().gameState,state);const promise=h.click('#start-button');assert.equal(h.attempts.length,1);h.attempts[0].reject({code:'cancelled'});await promise;assert.equal(h.state().score,72);
    }
    const session=storage();session.setItem(PENDING,'1');const h=await harness({session});assert.equal(h.state().gameState,'replay-pending');assert.equal(h.attempts.length,0);
});

test('charge repeats, touch charge and sound test do not enter payment gate; hidden tab pauses silently', async () => {
    const h=await harness();h.click('#start-button');h.key(' ','Space');h.key(' ','Space',true);assert.equal(h.audioEvents.filter(x=>x==='breakoutCharge').length,1);h.keyUp(' ');
    const g=h.inspect.game();g.time=1;
    const touch={pointerId:32,pointerType:'touch',button:0,clientX:610,preventDefault(){}};
    h.el('#game-canvas').handlers.get('pointerdown')(touch);assert.equal(g.paddle.x+g.paddle.w/2,610);assert.equal(g.paddle.charging,false);
    h.el('#game-canvas').handlers.get('pointermove')({...touch,clientX:470});assert.equal(g.paddle.x+g.paddle.w/2,470);
    h.el('#charge-button').handlers.get('pointerdown')(touch);assert.equal(g.paddle.charging,true);g.time+=.45;
    h.el('#charge-button').handlers.get('pointerup')(touch);assert.ok(g.paddle.releasePower>.99);assert.equal(g.paddle.charging,false);
    h.click('#sound-test');assert.equal(h.attempts.length,0);assert.equal(h.audioEvents.at(-1),'breakoutStrong');
    const before=h.audioEvents.length;h.hidden(true);assert.equal(g.state,'paused');assert.equal(h.audioEvents.length,before);
    h.hidden(false);assert.equal(g.state,'paused');h.click('#start-button');assert.equal(g.state,'running');assert.equal(h.attempts.length,0);
});

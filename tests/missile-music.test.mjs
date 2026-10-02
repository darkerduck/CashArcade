import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = name => readFileSync(new URL(`../missile/${name}.js`, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
    const storage = options.storage || new Map(), contexts = [], timers = new Map(), nodes = [];
    let nextTimer = 0;
    const resumeResolvers=[];
    class Param {
        value = 0; events = [];
        setValueAtTime(v,t) { this.value=v; this.events.push(['set',v,t]); }
        linearRampToValueAtTime(v,t) { this.events.push(['linear',v,t]); }
        exponentialRampToValueAtTime(v,t) { this.events.push(['exp',v,t]); }
        setTargetAtTime(v,t,c) { this.events.push(['target',v,t,c]); }
        cancelScheduledValues(t) { this.events.push(['cancel',t]); }
    }
    class Node {
        constructor(kind) { this.kind=kind; this.gain=new Param(); this.frequency=new Param(); this.Q=new Param(); nodes.push(this); }
        connect() {} disconnect() { this.disconnected=true; }
        start(time) { if (options.nodeFailure) throw Error('node failure'); this.started=time; }
        stop(time) { this.stopped=time; }
    }
    class Context {
        currentTime=0; sampleRate=44100; state=options.suspended ? 'suspended' : 'running'; destination={};
        constructor() { if (options.constructorFailure) throw Error('no device'); contexts.push(this); }
        resume() { return options.delayedResume ? new Promise(resolve => { resumeResolvers.push(() => { this.state='running'; resolve(); }); }) : (this.state='running', Promise.resolve()); }
        createGain() { return new Node('gain'); } createBiquadFilter() { return new Node('filter'); }
        createWaveShaper() { return new Node('limiter'); }
        createDynamicsCompressor() { const n=new Node('compressor'); for (const p of ['threshold','knee','ratio','attack','release']) n[p]=new Param(); return n; }
        createOscillator() { return new Node('oscillator'); } createBufferSource() { return new Node('noise'); }
        createBuffer(channels,length) { return { getChannelData: () => new Float32Array(length) }; }
    }
    function element() { const listeners={}; return { textContent:'', value:'', setAttribute(n,v) { this[n]=v; }, addEventListener(n,fn) { listeners[n]=fn; }, fire(n) { listeners[n](); } }; }
    const toggleButton=element(), volumeInput=element(), volumeLabel=element(), trackLabel=element();
    const scope=vm.createContext({ AudioContext:options.unsupported ? undefined : Context,
        localStorage: { getItem: k => { if (options.badStorage) throw Error(); return storage.get(k) ?? null; }, setItem: (k,v) => { if (options.badStorage) throw Error(); storage.set(k,v); } },
        setInterval: fn => { const id=++nextTimer; timers.set(id,fn); return id; }, clearInterval: id => timers.delete(id),
    });
    scope.window=scope;
    vm.runInContext(readFileSync(new URL('../music.js',import.meta.url),'utf8'),scope);
    for (const f of ['score','music']) vm.runInContext(source(f),scope);
    vm.runInContext(readFileSync(new URL('../music-scores.js',import.meta.url),'utf8'),scope);
    vm.runInContext(readFileSync(new URL('../audio.js',import.meta.url),'utf8'),scope);
    const sound=options.game ? scope.CashArcadeAudio.create({storageKey:`casharcade-${options.game}-sound-muted`,toggleButton:element(),musicMix:true}) : null;
    const music=options.game ? scope.CashArcadeMusic.create({toggleButton,volumeInput,volumeLabel,trackLabel,
        score:scope.CashArcadeScores[options.game],storagePrefix:`casharcade-${options.game}-music`,audioOutput:sound.musicOutput})
        : scope.NeonDefenseMusic.create({toggleButton,volumeInput,volumeLabel,trackLabel});
    return { scope,music,sound,storage,contexts,nodes,timers,toggleButton,volumeInput,trackLabel,
        advance(dt) { if (contexts[0]) contexts[0].currentTime+=dt; for (const fn of [...timers.values()]) fn(); },
        resolveResume(index=0) { resumeResolvers[index](); }, notes: () => nodes.filter(n => n.started !== undefined),
    };
}

test('twenty sectors have authored themes, harmonic phrases, distinct keys/tempos and two boss scores', () => {
    const {scope}=harness(); const {profile,notesForStep}=scope.NeonDefenseScore;
    const themes=new Set();
    for (let level=1;level<=20;level++) {
        const p=profile(level); themes.add(p.id); assert.equal(p.level,level); assert.equal(p.harmony.length,8);
        const all=Array.from({length:128},(_,step)=>notesForStep(p,step)).flat();
        for (const voice of ['lead','bass','arp','kick','snare','hat']) assert.ok(all.some(n=>n.voice===voice));
        assert.ok(all.every(n=>Number.isFinite(n.note)&&n.length>0&&n.level>0));
        assert.ok(p.bpm>=160&&p.bpm<=208);
        assert.notDeepEqual(JSON.parse(JSON.stringify(notesForStep(p,0))),JSON.parse(JSON.stringify(notesForStep(p,64))));
    }
    assert.equal(themes.size,8);
    assert.notEqual(profile(10).id,profile(20).id);
    for (const level of [10,20]) {
        assert.equal(profile(level,'core').bpm,profile(level).bpm+16);
        assert.equal(profile(level,'rage').bpm,profile(level).bpm+32);
        assert.ok(notesForStep(profile(level,'rage'),0).some(n=>n.voice==='echo'));
    }
    assert.equal(profile(1,'rage').bpm,profile(1).bpm);
});
test('load is silent and lazy; start uses scheduled chip voices, envelopes and one reusable context', () => {
    const h=harness(); assert.equal(h.contexts.length,0); assert.equal(h.notes().length,0);
    assert.equal(h.toggleButton['aria-pressed'],'true'); assert.equal(h.volumeInput.value,'65');
    h.music.start(1); assert.equal(h.contexts.length,1); assert.equal(h.timers.size,1);
    const notes=h.notes(); assert.ok(notes.length>=5);
    assert.ok(notes.every(n=>n.started>=.025&&n.stopped>n.started));
    assert.ok(notes.some(n=>n.type==='square')); assert.ok(notes.some(n=>n.type==='triangle'));
    assert.ok(h.nodes.some(n=>n.kind==='gain'&&n.gain.events.some(e=>e[0]==='exp')));
    h.music.start(20); assert.equal(h.contexts.length,1); assert.equal(h.timers.size,1);
    assert.match(h.trackLabel.textContent,/終焉方舟/);
});
test('pause cancels scheduled notes, freezes the clock and resumes without duplicate timers', () => {
    const h=harness(); h.music.start(3); h.advance(.12);
    h.music.pause(); const count=h.notes().length;
    assert.equal(h.timers.size,0);
    assert.ok(h.notes().every(n=>n.stopped<=h.contexts[0].currentTime+.014));
    h.advance(10); assert.equal(h.notes().length,count);
    h.music.resume(); h.music.wake(); h.music.wake(); assert.equal(h.timers.size,1);
    h.advance(.12); // A resumed sixteenth may be a written rest, not a missing voice.
    assert.ok(h.notes().length>count); assert.equal(h.contexts.length,1);
});
test('delayed AudioContext resume cannot restart after pause, mute or a superseding start', async () => {
    for (const action of ['pause','mute','restart']) {
        const h=harness({suspended:true,delayedResume:true}); h.music.start(1);
        if (action==='pause') h.music.pause();
        if (action==='mute') h.toggleButton.fire('click');
        if (action==='restart') h.music.start(20);
        h.resolveResume(); await flush();
        assert.equal(h.notes().length,0); assert.equal(h.timers.size,0);
        if (action==='restart') { h.resolveResume(1); await flush(); assert.equal(h.timers.size,1); assert.match(h.trackLabel.textContent,/終焉方舟/); }
    }
});
test('music mute and volume persist independently of sound effects and are safe without storage', () => {
    const h=harness(); h.music.start(1); h.toggleButton.fire('click');
    assert.equal(h.timers.size,0); assert.equal(h.toggleButton['aria-pressed'],'false');
    h.volumeInput.value='80'; h.volumeInput.fire('input'); assert.equal(h.timers.size,0);
    const restored=harness({storage:h.storage}); restored.music.start(6);
    assert.equal(restored.contexts.length,0); assert.equal(restored.volumeInput.value,'80');
    restored.toggleButton.fire('click'); assert.equal(restored.timers.size,1);
    restored.volumeInput.value='0'; restored.volumeInput.fire('input'); assert.equal(restored.timers.size,0);
    restored.volumeInput.value='100'; restored.volumeInput.fire('input'); assert.equal(restored.timers.size,1);
    assert.deepEqual([...h.storage.keys()].sort(),['casharcade-missile-music-muted','casharcade-missile-music-volume']);
    const blocked=harness({badStorage:true}); assert.doesNotThrow(()=> { blocked.music.start(1); blocked.toggleButton.fire('click'); });
});
test('boss transitions land on the next bar, intensify only once and preserve the melodic clock', () => {
    const h=harness(); h.music.start(20); h.music.phase('core');
    h.advance(.1); assert.match(h.trackLabel.textContent,/護盾防衛/);
    for (let i=0;i<100;i++) h.advance(.025);
    assert.match(h.trackLabel.textContent,/200 BPM.*核心暴露/);
    h.music.phase('rage'); h.music.phase('rage');
    for (let i=0;i<100;i++) h.advance(.025);
    assert.match(h.trackLabel.textContent,/216 BPM.*狂暴/);
    h.music.phase('core'); for (let i=0;i<100;i++) h.advance(.025);
    assert.match(h.trackLabel.textContent,/狂暴/); assert.equal(h.timers.size,1);
});
test('stalled scheduling skips catch-up bursts, ducking recovers, unsupported and failing audio stay safe', () => {
    const h=harness(); h.music.start(1); const count=h.notes().length;
    h.advance(120); assert.ok(h.notes().length-count<12);
    h.music.duck(); h.advance(.025);
    const gainEvents=()=>h.nodes.filter(n=>n.kind==='gain').flatMap(n=>n.gain.events).filter(e=>e[0]==='target');
    assert.ok(gainEvents().some(e=>Math.abs(e[1]-.65*.55)<1e-6));
    h.advance(.5); assert.equal(gainEvents().at(-1)[1],.65);
    for (const option of ['unsupported','constructorFailure','nodeFailure']) {
        const broken=harness({[option]:true}); assert.doesNotThrow(()=> { broken.music.start(20); broken.music.pause(); broken.music.resume(); });
        assert.equal(broken.timers.size,0); assert.match(broken.trackLabel.textContent,/無法播放/);
    }
});

test('all thirty breakout stages map to authored themes and three distinct adaptive boss scores',()=>{
    const {scope}=harness(), score=scope.CashArcadeScores.breakout;
    const expected=['prism','prism','orbit','foundry','orbit','inferno','foundry','magnet','foundry','wing',
        'prism','orbit','rift','foundry','orbit','inferno','inferno','magnet','foundry','warden',
        'storm','foundry','prism','rift','orbit','foundry','rift','magnet','storm','nova'];
    for(let level=1;level<=30;level++) {
        const p=score.profile(level); assert.equal(p.id,expected[level-1]); assert.equal(p.level,level);
        const notes=Array.from({length:128},(_,i)=>score.notesForStep(p,i)).flat();
        assert.ok(notes.every(n=>Number.isFinite(n.note)&&n.length>0));
        for(const voice of ['lead','bass','arp','kick','snare','hat'])assert.ok(notes.some(n=>n.voice===voice));
    }
    assert.equal(new Set([10,20,30].map(n=>score.profile(n).id)).size,3);
    for(const n of [10,20,30])assert.equal(score.profile(n,2).bpm,score.profile(n).bpm+16);
    assert.equal(score.profile(30,2).bpm,216); assert.equal(score.profile(29,2).intensity,2);
    assert.equal(score.profile(28,2).intensity,0);
});

for(const game of ['breakout','snake','flappy'])test(`${game} music shares one context with SFX but not their mute preference`,()=>{
    const storage=new Map([[`casharcade-${game}-sound-muted`,'1']]);
    const h=harness({game,storage}); assert.equal(h.contexts.length,0);
    h.music.start(1); assert.equal(h.contexts.length,1); assert.ok(h.notes().length>0); assert.equal(h.sound.isMuted(),true);
    h.sound.toggleMuted(); h.sound.play('food'); assert.equal(h.contexts.length,1);
    h.toggleButton.fire('click'); assert.equal(h.timers.size,0); assert.equal(h.sound.isMuted(),false);
    const count=h.notes().length; h.sound.play('start'); assert.ok(h.notes().length>count);
    const restored=harness({game,storage}); restored.music.start(1); assert.equal(restored.contexts.length,0);
    const other=harness({game:game==='snake'?'flappy':'snake',storage}); other.music.start(1); assert.equal(other.contexts.length,1);
});

test('snake and flappy retain different original melodies and bounded acceleration arrangements',()=>{
    const {scope}=harness();
    for(const game of ['snake','flappy']) {
        const score=scope.CashArcadeScores[game];
        assert.equal(score.profile(1,999).intensity,3);
        assert.equal(score.profile(1,3).bpm,score.profile(1).bpm+24);
        assert.ok(score.notesForStep(score.profile(1,3),0).some(n=>n.voice==='echo'));
    }
    assert.notDeepEqual(JSON.parse(JSON.stringify(scope.CashArcadeScores.snake.profile(1).melody)),JSON.parse(JSON.stringify(scope.CashArcadeScores.flappy.profile(1).melody)));
});

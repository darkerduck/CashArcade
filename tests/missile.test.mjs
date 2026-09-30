import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const scope = vm.createContext({});
vm.runInContext(readFileSync(new URL('../missile/engine.js', import.meta.url), 'utf8'), scope);
const { Game, fresh, valid, upgrade, canUpgrade, LEVELS, schedule, touches } = scope.NeonDefense;
const game = (level = 1) => new Game({ ...fresh(), level, seed: 12345 });
const advance = (g, seconds) => { for (let t = 0; t < seconds; t += .025) g.update(.025); };

test('nearest ready turret fires once with cooldown; unsuccessful shots are silent', () => {
    const g = game(); assert.equal(g.fire(100, 200), true); assert.equal(g.shots[0].x, 70);
    g.fire(100, 200); assert.equal(g.shots[1].x, 480);
    g.fire(100, 200); assert.equal(g.shots[2].x, 890);
    assert.equal(g.fire(100, 200), false); assert.equal(g.shots.length, 3);
    assert.equal(g.drain().filter(e => e.type === 'launch').length, 3);
    advance(g, .7); assert.equal(g.fire(100, 200), true);
});
test('armor takes only one hit from a single blast and then chains once', () => {
    const g = game(); const e = g.spawn('armored', 400, 300); e.speed = 0;
    g.explode(400, 300); advance(g, .4); assert.equal(e.hp, 1);
    g.explode(400, 300); advance(g, .1); assert.equal(e.hp, 0);
    assert.equal(g.kills, 1); assert.equal(g.drain().filter(e => e.type === 'chain').length, 1);
});
test('all five pickups apply, refresh instead of multiply and are collected once', () => {
    const g = game(); g.items.push({ type: 'rapid', x: 400, y: 300, life: 8 });
    g.explode(400, 300); advance(g, .2);
    assert.equal(g.drain().filter(e => e.type === 'pickup').length, 1);
    g.pickup('rapid'); assert.equal(g.effects.rapid, 10);
    g.pickup('wide'); assert.equal(g.effects.wide, 10);
    g.pickup('slow'); assert.equal(g.effects.slow, 8);
    g.pickup('shield'); g.pickup('shield'); assert.ok(g.cities.every(c => c.shield === true));
    const enemy = g.spawn('normal', 200, 300); g.pickup('emp'); assert.equal(enemy.dead, true);
    g.state = 'paused'; const time = g.time; g.update(.05); assert.equal(g.time, time); assert.equal(g.effects.slow, 8);
});
test('city shield absorbs one hit; destroyed cities cause failure without bonus', () => {
    const g = game(); const city = g.cities[0]; city.shield = true;
    g.hitCity({ target: city.x }); assert.equal(city.hp, 3); assert.equal(city.shield, false);
    g.hitCity({ target: city.x }); assert.equal(city.hp, 2);
    g.cities.forEach(c => c.hp = 0); g.update(.01); assert.equal(g.state, 'lost'); assert.equal(g.score, 0);
});
test('checkpoint retries restore score/cities/upgrades; upgrade is not applied twice', () => {
    const g = game(); g.score = 700; g.cities[0].hp = 0; g.cities[1].hp = 1;
    const retry = new Game(g.checkpoint); assert.equal(retry.score, 0); assert.equal(retry.cities[0].hp, 3);
    g.state = 'upgrade'; const c = g.nextCheckpoint(); assert.ok(valid(c));
    const next = upgrade(c, 'repair'); assert.equal(next.level, 2); assert.equal(next.cities[0].hp, 1); assert.equal(next.cities[1].hp, 2);
    assert.equal(upgrade(next, 'repair'), null); assert.equal(next.score, 700);
    assert.equal(upgrade(c, 'radius').radius, 72); assert.ok(upgrade(c, 'reload').reload < .65);
    assert.equal(valid({ ...c, score: Infinity }), false); assert.equal(valid({ ...c, level: 99 }), false);
});
test('boss shields protect core, armor IDs deduplicate, rage starts once and EMP cannot kill boss', () => {
    const g = game(10); const b = g.boss;
    const hit = (x, key) => { const blast = { x, y: b.y, r: 30, hit: new Set() }; g.hitBoss(blast); g.hitBoss(blast); return blast.hit.has(key); };
    hit(b.x, 'core'); assert.equal(b.hp, 32);
    for (let i = 0; i < 8; i++) { assert.ok(hit(b.x - 95, 'node0')); assert.ok(hit(b.x + 95, 'node1')); }
    assert.equal(b.nodes[0], 0); assert.equal(b.nodes[1], 0);
    g.pickup('emp'); assert.equal(b.hp, 32);
    for (let i = 0; i < 16; i++) hit(b.x, 'core');
    assert.equal(b.hp, 16); assert.equal(b.rage, true);
    for (let i = 0; i < 16; i++) hit(b.x, 'core');
    assert.equal(b.dead, true); assert.equal(g.spawned, g.config.count);
    const events=g.drain();
    assert.equal(events.filter(e => e.type === 'bossPhase' && e.phase === 'rage').length,1);
    assert.equal(events.filter(e => e.type === 'bossPhase' && e.phase === 'core').length,1);
    assert.equal(events.filter(e => e.type === 'bossDeath').length,1);
});
test('twenty seeded simulations clear waves, drops, both bosses and all free upgrades', () => {
    let checkpoint = { ...fresh(), seed: 42 }; const names = new Set();
    for (let level = 1; level <= LEVELS.length; level++) {
        const g = new Game(checkpoint); names.add(g.config.name);
        // Deterministic perfect-defense fixture exercises actual spawn/movement/collision and transition clocks.
        for (let step = 0; step < 12000 && g.state === 'running'; step++) {
            for (const e of g.enemies) if (!e.dead) g.explode(e.x, e.y, 34);
            if (g.boss && !g.boss.dead && step % 10 === 0) {
                const b = g.boss;
                for (const offset of b.offsets) g.explode(b.x+offset,b.y,24);
                g.explode(b.x,b.y,24);
            }
            g.update(.025); g.drain();
        }
        assert.equal(g.state, level === LEVELS.length ? 'won' : 'upgrade', `level ${level}`);
        assert.equal(g.drops, g.boss || level > 10 ? 3 : 2); assert.ok(g.cities.some(c => c.hp));
        if (!g.boss) assert.equal(g.wave,g.config.waves);
        assert.ok(g.blasts.length <= 180);
        if (level < LEVELS.length) {
            const cp=g.nextCheckpoint(), preferred=level%2 ? 'radius' : 'reload';
            checkpoint=upgrade(cp,canUpgrade(cp,preferred) ? preferred : 'repair'); assert.ok(valid(checkpoint));
        }
    }
    assert.equal(names.size, 20); assert.equal(LEVELS[0].count, 24); assert.equal(LEVELS[8].count, 102);
});
test('split missiles branch, cruisers drop missiles, and untouched stages can be lost', () => {
    const g = game(7); g.spawn('split', 400, 290); g.update(.025);
    assert.ok(g.enemies.filter(e => e.type === 'normal').length >= 3);
    const cruiser = g.spawn('cruiser'); cruiser.dropAt = 0; g.update(.025);
    assert.ok(g.enemies.some(e => e.type === 'normal' && e.y < 180));
    const idle = game(9); advance(idle, 150); assert.equal(idle.state, 'lost');
});

test('all twenty level densities, waves, salvo spacing and speed multipliers match the design', () => {
    const counts=[24,32,40,48,58,66,76,88,102,32,110,118,126,134,142,150,158,166,178,60];
    const speeds=[72,80,88,96,106,116,126,138,150,150,158,164,170,176,182,188,194,200,208,208];
    const intervals=[1,.9,.82,.74,.68,.62,.57,.52,.46,1,.44,.43,.42,.41,.4,.39,.38,.37,.35,.7];
    for (let i=0;i<20;i++) {
        const config=LEVELS[i], entries=schedule(config), g=game(i+1);
        assert.equal(config.count,counts[i]); assert.equal(config.speed,speeds[i]); assert.equal(config.interval,intervals[i]);
        assert.equal(entries.length,counts[i]);
        assert.equal(new Set(entries.map(e => e.wave)).size,config.waves);
        for (let n=1;n<entries.length;n++) {
            const prev=entries[n-1], next=entries[n], delta=next.at-prev.at;
            if (next.slot) assert.ok(Math.abs(delta-.14) < 1e-9);
            else {
                const expected=prev.group*config.interval-(prev.group-1)*.14+(next.wave !== prev.wave ? 2 : 0);
                assert.ok(Math.abs(delta-expected) < 1e-8);
            }
        }
        assert.equal(g.spawn('normal').speed,speeds[i]); assert.equal(g.spawn('fast').speed,speeds[i]*1.5);
    }
    assert.ok(game(19).dropInterval() < game(6).dropInterval());
    assert.ok(Math.abs(game(19).spawn('cruiser').vx) > Math.abs(game(6).spawn('cruiser').vx));
});

test('upgrade caps, old level 10 saves, level 19 upgrade and final checkpoint validation', () => {
    const old={...fresh(),level:10,seed:7}; assert.ok(valid(old)); assert.ok(new Game(old).boss);
    const cp={...old,phase:'upgrade',radius:136,reload:.29};
    assert.equal(canUpgrade(cp,'radius'),false); assert.equal(canUpgrade(cp,'reload'),false);
    assert.equal(upgrade(cp,'radius'),null); assert.equal(upgrade(cp,'reload'),null);
    assert.equal(upgrade(cp,'repair').level,11);
    assert.equal(upgrade({...cp,level:19},'repair').level,20);
    assert.equal(valid({...cp,level:20}),false); assert.ok(valid({...old,level:20}));
    assert.equal(upgrade({...cp,radius:132},'radius').radius,136);
    assert.equal(upgrade({...cp,reload:.31},'reload').reload,.29);
});

test('final ark phases, volley telegraph/counts, core escorts, unique hits and remnant victory', () => {
    const g=game(20), b=g.boss; g.drain();
    assert.equal(b.maxHp,60); assert.equal(b.nodes.length,4); assert.ok(b.nodes.every(n => n === 8));
    b.nextAttack=.72; g.updateBoss(.03,1);
    assert.equal(g.drain().filter(e => e.type === 'bossCharge').length,1);
    g.updateBoss(.02,1); assert.equal(g.drain().filter(e => e.type === 'bossCharge').length,0);
    g.updateBoss(.7,1); assert.equal(g.enemies.length,4); assert.equal(b.nextAttack,2.4);
    for (let n=0;n<8;n++) for (const offset of b.offsets) {
        const blast={x:b.x+offset,y:b.y,r:1,hit:new Set()};
        g.hitBoss(blast); g.hitBoss(blast);
    }
    assert.equal(b.phase,'core'); assert.equal(b.hp,60);
    assert.equal(g.drain().filter(e => e.type === 'bossPhase' && e.phase === 'core').length,1);
    g.enemies=[]; b.nextAttack=0; g.updateBoss(.01,1);
    assert.equal(g.enemies.length,5); assert.equal(b.nextAttack,1.8);
    g.time=b.escortAt; g.updateBoss(0,1); assert.ok(g.enemies.some(e => e.type === 'cruiser'));
    for (let n=0;n<40;n++) {
        const blast={x:b.x,y:b.y,r:1,hit:new Set()}; g.hitBoss(blast); g.hitBoss(blast);
    }
    assert.equal(b.hp,20); assert.equal(b.phase,'rage');
    g.enemies=[]; b.nextAttack=0; g.updateBoss(.01,1);
    assert.equal(g.enemies.length,7); assert.equal(b.nextAttack,1.2);
    assert.ok(g.enemies.some(e => e.type === 'split')); assert.ok(g.enemies.some(e => e.type === 'armored'));
    g.pickup('emp'); assert.equal(b.hp,20); assert.ok(g.enemies.every(e => e.dead));
    for (let n=0;n<20;n++) g.hitBoss({x:b.x,y:b.y,r:1,hit:new Set()});
    assert.equal(b.dead,true);
    const events=g.drain(); assert.equal(events.filter(e => e.type === 'bossPhase' && e.phase === 'rage').length,1);
    assert.equal(events.filter(e => e.type === 'bossDeath').length,1);
    const survivor=g.spawn('armored',200,300); survivor.speed=0;
    advance(g,3); assert.equal(g.state,'running'); assert.equal(g.enemies.length,1);
    g.pickup('emp'); g.update(.025); assert.equal(g.state,'won');
});

test('event payloads carry pickup origin/EMP targets, launch turret and city destruction', () => {
    const g=game(); g.fire(100,200); let e=g.drain()[0];
    assert.equal(e.turret,0); assert.ok(Number.isFinite(e.angle));
    const target=g.spawn('armored',200,300); g.pickup('emp',360,270);
    e=g.drain().find(e => e.type === 'pickup');
    assert.equal(e.x,360); assert.equal(e.y,270); assert.equal(e.targets[0].x,target.x);
    assert.equal(e.targets.length,1); assert.equal(e.turrets.length,3); assert.equal(e.cities.length,6);
    g.pickup('wide'); g.explode(400,300); assert.ok(g.drain().some(e => e.type === 'explosion' && e.boosted));
    g.cities[0].hp=1; g.hitCity({target:g.cities[0].x});
    assert.ok(g.drain().some(e => e.type === 'damage' && e.destroyed && e.hp === 0));
});

test('aircraft needs three separate blast IDs and the painted body excludes exhaust', () => {
    const g=game(8), e=g.spawn('cruiser',400,200); e.vx=0; e.dropAt=Infinity;
    assert.ok(touches({x:430,y:200,r:0},e));
    assert.equal(touches({x:450,y:200,r:1},e),false);
    for (let n=0;n<3;n++) {
        g.explode(400,200,20); advance(g,.25); assert.equal(e.hp,2-n);
    }
    assert.equal(g.drain().filter(e => e.type === 'breakup').length,1);
    const missile=g.spawn('normal',200,200); missile.target=200;
    assert.equal(touches({x:200,y:170,r:1},missile),false);
    assert.equal(touches({x:200,y:210,r:1},missile),true);
});

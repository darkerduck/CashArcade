import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,STEP_SECONDS,CLOAK_TICKS,DIRECTIONS,isWalkable,laserState,tileAt} from '../circuit/engine.mjs';
import {LEVELS,buildLevel} from '../circuit/levels.mjs';
import {solveTopology} from './circuit-replay-helper.mjs';
const custom=(rows,patrols=[])=>buildLevel({rows,patrols,name:'Fixture',par:10});
const run=(level)=>{const game=new Game(0,level);game.start();game.drain();return game;};
const move=(game,direction,count=1)=>{game.turn(direction);for(let i=0;i<count;i++)game.tick();};
const snapshot=g=>JSON.stringify({state:g.state,tick:g.tickCount,player:g.player,previous:g.previous,patrols:g.patrols,phase:g.phase,charges:g.charges,cloak:g.cloakTicks,nodes:[...g.nodes],shards:[...g.shards],cloaks:[...g.cloaks],score:g.score,elapsed:g.elapsed,direction:g.direction,queued:g.queued});

test('ten authored bounded mazes have distinct geometry, safe spawns and real objectives',()=>{
  assert.equal(LEVELS.length,10);assert.equal(new Set(LEVELS.map(l=>l.rows.join('\n'))).size,10);
  for(const level of LEVELS){
    assert.equal(level.width,17);assert.equal(level.height,13);assert.ok(level.nodes.length>=5);assert.ok(level.shards.length>=1);
    assert.equal(level.rows[0],'#'.repeat(17));assert.equal(level.rows.at(-1),'#'.repeat(17));
    for(const row of level.rows){assert.equal(row[0],'#');assert.equal(row.at(-1),'#');assert.match(row,/^[#.o*+TAB!SE]+$/);}
    assert.ok(Object.isFrozen(level));assert.ok(Object.isFrozen(level.rows));
    for(const patrol of level.patrols){assert.notDeepEqual(patrol.path[patrol.offset],level.start);for(let j=1;j<patrol.path.length;j++)assert.equal(Math.abs(patrol.path[j].x-patrol.path[j-1].x)+Math.abs(patrol.path[j].y-patrol.path[j-1].y),1);}
  }
});


for(const level of LEVELS)test(`circuit ${level.id+1}: all nodes, bonuses and exit are reachable with actual alternating switches`,()=>{
  const route=solveTopology(level);assert.ok(route,level.name);assert.ok(route.length>30);
  // Topology replay deliberately isolates the map rules from timed hazards.
  // Hazard survival, edge collisions and pulse timing are tested independently.
  const clean={...level,patrols:[],lasers:[]},game=run(clean);
  for(const direction of route)move(game,direction);
  assert.equal(game.state,'won');assert.equal(game.nodes.size,0);assert.equal(game.shards.size,0);assert.equal(game.stars,3);
});

test('buffered turns survive blocked tiles, turn at first junction and continue automatically',()=>{
  const game=run(custom(['#######','#S....#','###.#E#','#..o..#','#######']));
  move(game,'right');assert.deepEqual(game.player,{x:2,y:1});game.turn('down');game.tick();assert.deepEqual(game.player,{x:3,y:1});assert.equal(game.queued,'down');game.tick();assert.deepEqual(game.player,{x:3,y:2});assert.equal(game.queued,null);game.tick();assert.deepEqual(game.player,{x:3,y:3});assert.equal(game.collected,1);
});
test('blocked buffered direction never clips a wall; brake clears both intents',()=>{
  const game=run(custom(['#######','#S...E#','#####o#','#######']));move(game,'up',10);assert.deepEqual(game.player,{x:1,y:1});assert.equal(game.queued,'up');move(game,'right',2);game.turn('up');game.brake();const position={...game.player};game.tick();assert.deepEqual(game.player,position);assert.equal(game.direction,null);assert.equal(game.queued,null);assert.equal(game.turn('diagonal'),false);
});
test('instant reverse applies at the next tile boundary',()=>{const game=run(custom(['#######','#S.o.E#','#######']));move(game,'right',2);move(game,'left');assert.deepEqual(game.player,{x:2,y:1});});
test('exit remains locked until every energy node has been collected',()=>{
  const game=run(custom(['#######','#SE.o.#','#######']));move(game,'right');assert.equal(game.state,'running');assert.equal(game.exitOpen,false);move(game,'right',2);assert.equal(game.exitOpen,true);move(game,'left',2);assert.equal(game.state,'won');assert.equal(game.stars,3);const score=game.score;game.complete();game.tick();assert.equal(game.score,score);assert.equal(game.drain().filter(e=>e.type==='win').length,1);
});
test('entering a switch alternates A/B once; waiting never retriggers it',()=>{
  const game=run(custom(['#########','#ST.Bo.E#','#..A....#','#########']));assert.equal(isWalkable(game.level,4,1,0),false);assert.equal(isWalkable(game.level,3,2,0),true);move(game,'right');assert.equal(game.phase,1);game.brake();game.tick();assert.equal(game.phase,1);move(game,'left');move(game,'right');assert.equal(game.phase,0);assert.equal(game.drain().filter(e=>e.type==='switch').length,2);
});
test('switch closure never kills an occupant and closed gate blocks entry',()=>{
  const game=run(custom(['#########','#SABo..E#','#########']));move(game,'right');assert.deepEqual(game.player,{x:2,y:1});game.phase=1;game.tick();assert.deepEqual(game.player,{x:3,y:1});assert.equal(game.state,'running');game.turn('left');game.tick();assert.deepEqual(game.player,{x:4,y:1});assert.equal(game.queued,'left');
});
test('standing on or swapping tiles with a patrol is lethal',()=>{
  let game=run(custom(['#######','#S.o.E#','#######'],[{from:[2,1],to:[4,1],every:4}]));move(game,'right');assert.equal(game.state,'dead');assert.equal(game.reason,'patrol');
  game=run(custom(['#######','#S.o.E#','#######'],[{from:[1,1],to:[2,1],every:1,offset:1}]));move(game,'right');assert.equal(game.state,'dead');assert.equal(game.reason,'patrol');assert.deepEqual(game.patrols[0].previous,{x:2,y:1});
});
test('patrols bounce deterministically and wait at closed circuit gates',()=>{
  const game=run(custom(['#########','#S....oE#','#..B....#','#########'],[{from:[2,2],to:[5,2],every:1}]));game.tick();assert.equal(game.patrols[0].x,2);game.phase=1;game.tick();assert.equal(game.patrols[0].x,3);game.tick();game.tick();assert.equal(game.patrols[0].x,5);game.tick();assert.equal(game.patrols[0].x,4);assert.equal(game.patrols[0].step,-1);
});
test('temporary invisibility lasts precisely 30 ticks and ignores patrol collisions only',()=>{
  const level=custom(['########','#S.o..E#','#......#','########'],[{from:[1,1],to:[2,1],every:1,offset:1}]);const game=run(level);assert.equal(game.cloak(),true);assert.equal(game.charges,0);assert.equal(game.cloak(),false);move(game,'right');assert.equal(game.state,'running');assert.equal(game.cloakTicks,CLOAK_TICKS-1);game.patrols=[];game.brake();for(let i=1;i<CLOAK_TICKS;i++)game.tick();assert.equal(game.cloaked,false);assert.equal(game.cloak(),false);
  const beam=run(custom(['#######','#S!o.E#','#######']));beam.cloak();move(beam,'right');assert.equal(beam.state,'dead');assert.equal(beam.reason,'laser');
});
test('laser cycle includes safe, warning and live periods; waiting on live tile kills',()=>{
  assert.equal(laserState(0),'active');assert.equal(laserState(8),'active');assert.equal(laserState(9),'safe');assert.equal(laserState(20),'safe');assert.equal(laserState(21),'warning');assert.equal(laserState(24),'active');assert.equal(laserState(1,8),'safe');
  const game=run(custom(['#######','#S!o.E#','#######']));for(let i=0;i<9;i++)game.tick();move(game,'right');assert.equal(game.state,'running');game.brake();while(game.tickCount<24)game.tick();assert.equal(game.state,'dead');
});
test('charge pickups cap at three and stay on the board while inventory is full',()=>{
  const game=run(custom(['#########','#S+++o.E#','#########']));move(game,'right',3);assert.equal(game.charges,3);assert.equal(game.cloaks.size,1);game.cloak();move(game,'left');move(game,'right');assert.equal(game.charges,3);assert.equal(game.cloaks.size,0);
});
test('optional shards affect score and star award without preventing escape',()=>{
  const level=custom(['########','#So.E*.#','########']);const game=run(level);move(game,'right',3);assert.equal(game.state,'won');assert.equal(game.shards.size,1);assert.equal(game.stars,2);assert.ok(game.score>=1100);
  const slow=run(level);for(let i=0;i<70;i++)slow.tick();move(slow,'right',3);assert.equal(slow.stars,1);
});
test('pause freezes patrol, invisibility and elapsed time and rejects controls',()=>{
  const game=run(LEVELS[3]);game.cloak();move(game,'right');game.pause();const before=snapshot(game);game.update(.25);game.tick();assert.equal(game.turn('down'),false);assert.equal(game.cloak(),false);assert.equal(snapshot(game),before);assert.equal(game.resume(),true);game.tick();assert.equal(game.tickCount,2);
});
test('restart fully restores the level after switches, death, pickups and partial tick',()=>{
  const game=run(LEVELS[9]);game.turn('right');game.update(.2);game.phase=1;game.charges=0;game.cloakTicks=17;game.nodes.clear();game.shards.clear();game.cloaks.clear();game.die('patrol');game.restart();const fresh=new Game(9);assert.equal(snapshot(game),snapshot(fresh));assert.equal(game.accumulator,0);assert.equal(game.events.length,0);assert.equal(game.state,'ready');
});
test('fixed-step update is frame-partition invariant and ignores bad deltas',()=>{
  const a=run(LEVELS[0]),b=run(LEVELS[0]);a.turn('right');b.turn('right');for(let i=0;i<30;i++)a.update(.01);for(let i=0;i<6;i++)b.update(.05);assert.equal(snapshot(a),snapshot(b));const before=snapshot(a);for(const dt of [0,-1,NaN,Infinity])a.update(dt);assert.equal(snapshot(a),before);a.update(1000);assert.ok(a.tickCount-b.tickCount<=2);
});
test('same inputs reproduce the exact simulation and no clock progresses after death',()=>{
  const a=run(LEVELS[8]),b=run(LEVELS[8]);for(let i=0;i<250;i++){const d=Object.keys(DIRECTIONS)[Math.floor(i/9)%4];a.turn(d);b.turn(d);if(i%41===0){a.cloak();b.cloak();}a.tick();b.tick();}assert.equal(snapshot(a),snapshot(b));a.die('patrol');const before=snapshot(a);for(let i=0;i<50;i++){a.tick();a.update(.2);}assert.equal(snapshot(a),before);
});
test('ready does not run or accept powers, out-of-range level indexes fall back safely',()=>{for(const index of [-1,NaN,999,'2']){const game=new Game(index);assert.equal(game.level.id,0);game.update(.25);game.tick();assert.equal(game.tickCount,0);assert.equal(game.cloak(),false);assert.equal(game.turn('left'),false);assert.equal(game.pause(),false);}});

for(const level of LEVELS)test(`circuit ${level.id+1}: verified real-hazard replay survives patrols, lasers and switches and earns three stars`,async()=>{
  const {REPLAYS,decodeReplay}=await import('./circuit-replays.mjs');const commands=decodeReplay(REPLAYS[level.id]),game=run(level);
  for(const command of commands){if(command.cloak)assert.equal(game.cloak(),true);if(command.direction)game.turn(command.direction);else game.brake();game.tick();assert.notEqual(game.state,'dead',`died at tick ${game.tickCount} of circuit ${level.id+1}`);}
  assert.equal(game.state,'won');assert.equal(game.nodes.size,0);assert.equal(game.shards.size,0);assert.equal(game.stars,3);assert.equal(game.moves,commands.filter(c=>c.direction).length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import '../drift/engine.js';
const {Game,TRACKS,CAR_RADIUS,nearestPoint,pointAt,wrapAngle,clamp}=NeonDrift;
const dt=1/60;
const drive=g=>{const p=nearestPoint(g.car.x,g.car.y,g.track),t=pointAt(p.progress+75/g.track.length,g.track);return {steer:clamp(wrapAngle(Math.atan2(t.y-g.car.y,t.x-g.car.x)-g.car.angle)*2.7,-1,1)};};
const contained=g=>assert.ok(nearestPoint(g.car.x,g.car.y,g.track).distance<=g.track.width/2-CAR_RADIUS+.01);

for(let index=0;index<3;index++){
 test(`track ${index+1}: fast impacts on both rails across the entire route cannot tunnel`,()=>{
  for(let i=0;i<128;i++)for(const side of [-1,1]){
   const g=new Game(index,true).start(),p=pointAt(i/128,g.track);
   Object.assign(g.car,{x:p.x,y:p.y,vx:p.nx*side*1200,vy:p.ny*side*1200,speed:1200,angle:p.angle+side*Math.PI/2});
   g._move(.1);contained(g);
   assert.ok(g.health>=76,'a single contact cannot instantly destroy the car');
   assert.ok(g.collisions<=1);
  }
 });
 test(`track ${index+1}: fair deterministic AI and an input-only player complete a 90 second race`,()=>{
  const g=new Game(index).start(), replay=new Game(index).start();
  assert.equal(g.rivals.length,2);
  for(let frame=0;frame<5401&&g.state==='running';frame++){
   const input=drive(g), previous=[g,...g.rivals].map(r=>({x:r.car.x,y:r.car.y}));
   g.update(dt,input);replay.update(dt,input);
   for(const [i,r] of [g,...g.rivals].entries()){
    contained(r);assert.ok(Math.hypot(r.car.x-previous[i].x,r.car.y-previous[i].y)<=345*dt+.1,'no rival teleport');
    assert.ok(r.car.speed<=215+.01,'AI/player normal speed uses the same capped physics');
   }
  }
  assert.equal(g.state,'finished');assert.equal(g.time,90);assert.ok(g.health>0);
  assert.equal(g.rank,1);assert.equal(g.won,true);assert.equal(g.result,'win');
  for(const r of g.rivals){assert.ok(r.laps>=5);assert.ok(r.health>0);assert.equal(r.state,'finished');}
  assert.equal(JSON.stringify(g),JSON.stringify(replay));
 });
}

test('slide along a rail and steer back into the road without sticking or contact damage spam',()=>{
 const g=new Game(0,true).start(),p=pointAt(.03,g.track),edge=g.track.width/2-CAR_RADIUS-.1;
 Object.assign(g.car,{x:p.x+p.nx*edge,y:p.y+p.ny*edge,angle:p.angle,vx:Math.cos(p.angle)*180,vy:Math.sin(p.angle)*180,speed:180});
 g._lastX=g.car.x;g._lastY=g.car.y;
 const start={...g.car};
 for(let i=0;i<90;i++){g.update(dt,drive(g));contained(g);}
 assert.ok(Math.hypot(g.car.x-start.x,g.car.y-start.y)>120);assert.ok(g.health>=76);
});

test('continuous hard rail pressure has a .9s damage cooldown; repeated impacts eventually explode exactly once',()=>{
 const g=new Game(0,true).start(),p=pointAt(.04,g.track),edge=g.track.width/2-CAR_RADIUS-.1;
 Object.assign(g.car,{x:p.x+p.nx*edge,y:p.y+p.ny*edge,angle:p.angle+Math.PI/2,vx:p.nx*300,vy:p.ny*300,speed:300});
 g._lastX=g.car.x;g._lastY=g.car.y;
 g.update(dt);assert.equal(g.collisions,1);const health=g.health;
 for(let i=0;i<40;i++)g.update(dt);assert.equal(g.health,health);
 // Re-launch distinct hard impacts through the physics fixture after each cooldown.
 for(let hit=0;hit<30&&g.state==='running';hit++){
  for(let i=0;i<60&&g.state==='running';i++)g.update(dt);
  const near=nearestPoint(g.car.x,g.car.y,g.track),dx=g.car.x-near.x,dy=g.car.y-near.y,len=Math.hypot(dx,dy)||1;
  Object.assign(g.car,{vx:dx/len*300,vy:dy/len*300,speed:300,angle:Math.atan2(dy,dx)});
  for(let i=0;i<6&&g.state==='running';i++)g.update(dt);
 }
 assert.equal(g.state,'destroyed');assert.equal(g.health,0);assert.equal(g.won,false);
 assert.equal(g.drain().filter(e=>e.type==='explosion').length,1);
 const frozen=JSON.stringify(g);g.update(1);g.pause().resume();assert.equal(JSON.stringify(g),frozen);
 g.start();assert.equal(g.health,100);assert.equal(g.collisions,0);assert.equal(g.state,'running');
});

test('invalid progress, skipped gates and reverse crossing cannot improve race distance or unlock',()=>{
 const g=new Game().start();
 for(const progress of [.5,.8,.95,.02]){const p=pointAt(progress,g.track);Object.assign(g.car,{x:p.x,y:p.y});g.update(dt);}
 assert.equal(g.laps,0);assert.equal(g.raceDistance(),0);assert.equal(g.won,false);
 const reverse=new Game().start();reverse.progress=.01;reverse._advanceLap(pointAt(.99,reverse.track),5);
 assert.equal(reverse.raceDistance(),0);assert.equal(reverse._invalidLap,true);
});

test('pause freezes the opponents, rank, health and player together',()=>{
 const g=new Game().start();for(let i=0;i<120;i++)g.update(dt,drive(g));g.pause();
 const snapshot=JSON.stringify(g);g.update(90,{steer:1,drift:true});assert.equal(JSON.stringify(g),snapshot);
 g.resume();g.update(dt,drive(g));assert.ok(g.rivals[0].time>2);
});

test('a faster AI wins legitimately and the player receives a loss',()=>{
 const g=new Game().start();g.pace=170;
 for(let i=0;i<5401&&g.state==='running';i++)g.update(dt,drive(g));
 assert.equal(g.state,'finished');assert.ok(g.laps>0);assert.ok(g.rank>1);assert.equal(g.won,false);assert.equal(g.result,'loss');
});


test('projection-only jumps cannot award a physical checkpoint, even on an adjacent hairpin branch',()=>{
 const g=new Game(2,true).start();g.progress=.124;
 g._advanceLap(pointAt(.126,g.track),1);
 assert.equal(g.checkpoint,0);assert.equal(g._nextCheckpoint,1);
});

test('ordered checkpoint requires a forward crossing within the usable road width',()=>{
 for(const index of [0,1,2]){
  const g=new Game(index,true).start(),gate=g.track.checkpoints[1],tx=Math.cos(gate.angle),ty=Math.sin(gate.angle);
  g._lastX=gate.x-tx;g._lastY=gate.y-ty;
  g.car.x=gate.x+tx;g.car.y=gate.y+ty;
  assert.equal(g._crossedGate(1),true);
  [g._lastX,g.car.x]=[g.car.x,g._lastX];[g._lastY,g.car.y]=[g.car.y,g._lastY];
  assert.equal(g._crossedGate(1),false);
  const offset=g.track.width/2-CAR_RADIUS+1;
  g._lastX=gate.x-tx+gate.nx*offset;g._lastY=gate.y-ty+gate.ny*offset;
  g.car.x=gate.x+tx+gate.nx*offset;g.car.y=gate.y+ty+gate.ny*offset;
  assert.equal(g._crossedGate(1),false);
 }
});


test('cloud-observed midnight hairpin projection ratios preserve valid continuous progress for all three cars',()=>{
 // Measurements from input-only cloud QA near progress .342 -> .344.
 // These are valid in-road sweeps with zero contact; checkpoint proof is
 // independently based on actual position crossings, not the projected jump.
 for(const [name,movement,arc] of [['PLAYER',1.174,4.078],['VIOLET',1.038,3.177],['AMBER',1.082,3.335]]){
  const g=new Game(2,true).start();g.progress=.342;g._legalDistance=.342*g.track.length;
  g.checkpoint=2;g._nextCheckpoint=3;
  const before=g._legalDistance;
  assert.ok(arc>movement*3,name+' reproduces the former false rejection');
  g._advanceLap(pointAt(g.progress+arc/g.track.length,g.track),movement);
  assert.equal(g._invalidLap,false,name);
  assert.ok(Math.abs(g._legalDistance-before-arc)<1e-8,name);
  assert.equal(g.checkpoint,2,'projection jump alone must not award the next gate');
 }
});


test('physical finish line is authoritative when nearest-point wrapping lags at an offset lane',()=>{
 const g=new Game(0,true).start(),gate=g.track.start,tx=Math.cos(gate.angle),ty=Math.sin(gate.angle);
 g.progress=.999;g._nextCheckpoint=8;g.checkpoint=7;g._legalDistance=g.track.length*.999;g.lapTime=10;
 g._lastX=gate.x-tx;g._lastY=gate.y-ty;g.car.x=gate.x+tx;g.car.y=gate.y+ty;
 g._advanceLap(pointAt(.9995,g.track),2);
 assert.equal(g.laps,1);assert.equal(g.checkpoint,0);assert.equal(g._legalDistance,0);
 assert.equal(g._invalidLap,false);
});


test('external relocation across the physical finish cannot clear invalid progress on that frame',()=>{
 const g=new Game(0,true).start(),before=pointAt(.95,g.track),after=pointAt(.02,g.track);
 Object.assign(g.car,{x:before.x,y:before.y,angle:before.angle});
 g._lastX=before.x;g._lastY=before.y;g.progress=.95;
 g._nextCheckpoint=8;g.checkpoint=7;g._legalDistance=.95*g.track.length;g.lapTime=10;
 Object.assign(g.car,{x:after.x,y:after.y,angle:after.angle});
 g.update(1/240);
 assert.equal(g._gateBlocked,true);assert.equal(g._crossedGate(0),false);
 assert.equal(g._invalidLap,true);assert.equal(g.laps,0);assert.equal(g.raceDistance(),0);
 assert.equal(g.drain().filter(e=>e.type==='lap').length,0);
 g.update(1/240);
 assert.equal(g._gateBlocked,false,'subsequent real sweeps resume gate checks');
 assert.equal(g._invalidLap,true,'moving normally after the jump does not forgive the invalid lap');
 assert.equal(g.raceDistance(),0);
});

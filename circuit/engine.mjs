import { LEVELS } from './levels.mjs';

export const STEP_SECONDS=.15;
export const CLOAK_TICKS=30;
export const LASER_PERIOD=24;
export const DIRECTIONS=Object.freeze({up:Object.freeze({x:0,y:-1}),right:Object.freeze({x:1,y:0}),down:Object.freeze({x:0,y:1}),left:Object.freeze({x:-1,y:0})});
export const pointKey=p=>`${p.x},${p.y}`;
const same=(a,b)=>a.x===b.x&&a.y===b.y;
export function tileAt(level,x,y){return level.rows[y]?.[x]||'#';}
export function isWalkable(level,x,y,phase=0){const c=tileAt(level,x,y);return c!=='#'&&(c!=='A'||phase===0)&&(c!=='B'||phase===1);}
export function laserState(tick,offset=0){const phase=((tick+offset)%LASER_PERIOD+LASER_PERIOD)%LASER_PERIOD;return phase<9?'active':phase>=21?'warning':'safe';}

// Pure deterministic simulation. Renderer, audio, DOM and persistent storage never
// affect the rules. One tick is one tile opportunity; the UI interpolates it.
export class Game {
  constructor(index=0, customLevel=null){
    this.level=customLevel||LEVELS[Number.isInteger(index)&&index>=0&&index<LEVELS.length?index:0];
    this.restart();
  }
  restart(){
    this.state='ready';this.tickCount=0;this.elapsed=0;this.accumulator=0;this.phase=0;
    this.player={...this.level.start};this.previous={...this.player};this.direction=null;this.queued=null;
    this.nodes=new Set(this.level.nodes.map(pointKey));this.shards=new Set(this.level.shards.map(pointKey));this.cloaks=new Set(this.level.cloaks.map(pointKey));
    this.patrols=this.level.patrols.map(p=>({...p,index:p.offset,step:1,x:p.path[p.offset].x,y:p.path[p.offset].y,previous:{...p.path[p.offset]}}));
    this.charges=1;this.cloakTicks=0;this.score=0;this.stars=0;this.reason='';this.moves=0;this.events=[];
    return this;
  }
  get collected(){return this.level.nodes.length-this.nodes.size;}
  get exitOpen(){return this.nodes.size===0;}
  get cloaked(){return this.cloakTicks>0;}
  get interpolation(){return Math.min(1,this.accumulator/STEP_SECONDS);}
  start(){if(this.state!=='ready')return false;this.state='running';this.events.push({type:'start'});return true;}
  pause(){if(this.state!=='running')return false;this.state='paused';this.events.push({type:'pause'});return true;}
  resume(){if(this.state!=='paused')return false;this.state='running';this.events.push({type:'resume'});return true;}
  turn(direction){if(this.state!=='running'||!Object.hasOwn(DIRECTIONS,direction))return false;this.queued=direction;return true;}
  brake(){if(this.state!=='running')return false;this.direction=null;this.queued=null;return true;}
  cloak(){if(this.state!=='running'||this.cloaked||this.charges<1)return false;this.charges--;this.cloakTicks=CLOAK_TICKS;this.events.push({type:'cloak'});return true;}
  canMove(direction){const d=DIRECTIONS[direction];return Boolean(d&&isWalkable(this.level,this.player.x+d.x,this.player.y+d.y,this.phase));}
  update(seconds){
    if(this.state!=='running'||!Number.isFinite(seconds)||seconds<=0)return;
    this.accumulator+=Math.min(seconds,.25);
    while(this.accumulator+1e-10>=STEP_SECONDS&&this.state==='running'){
      this.accumulator=Math.max(0,this.accumulator-STEP_SECONDS);this.tick();
    }
  }
  tick(){
    if(this.state!=='running')return;
    this.tickCount++;this.elapsed=this.tickCount*STEP_SECONDS;
    this.previous={...this.player};
    if(this.queued&&this.canMove(this.queued)){this.direction=this.queued;this.queued=null;}
    if(this.canMove(this.direction)){
      const d=DIRECTIONS[this.direction];this.player.x+=d.x;this.player.y+=d.y;this.moves++;
      this.collect();
    }
    for(const patrol of this.patrols){
      patrol.previous={x:patrol.x,y:patrol.y};
      if(this.tickCount%patrol.every!==0||patrol.path.length<2)continue;
      let next=patrol.index+patrol.step;
      if(next<0||next>=patrol.path.length){patrol.step*=-1;next=patrol.index+patrol.step;}
      const p=patrol.path[next];
      if(isWalkable(this.level,p.x,p.y,this.phase)){patrol.index=next;patrol.x=p.x;patrol.y=p.y;}
    }
    const beam=this.level.lasers.find(p=>same(p,this.player)&&laserState(this.tickCount,p.offset)==='active');
    const patrol=this.patrols.find(p=>same(p,this.player)||(same(p.previous,this.player)&&same(p,this.previous)));
    if(beam)this.die('laser');
    else if(patrol&&!this.cloaked)this.die('patrol');
    if(this.state==='running'&&this.exitOpen&&same(this.player,this.level.exit))this.complete();
    if(this.cloakTicks>0)this.cloakTicks--;
  }
  collect(){
    const key=pointKey(this.player);
    if(this.nodes.delete(key)){this.score+=100;this.events.push({type:'node',position:{...this.player}});if(this.exitOpen)this.events.push({type:'exitOpen'});}
    if(this.shards.delete(key)){this.score+=250;this.events.push({type:'shard',position:{...this.player}});}
    if(this.charges<3&&this.cloaks.delete(key)){this.charges++;this.score+=50;this.events.push({type:'charge',position:{...this.player}});}
    if(tileAt(this.level,this.player.x,this.player.y)==='T'){this.phase=1-this.phase;this.events.push({type:'switch',phase:this.phase});}
  }
  die(reason){if(this.state!=='running')return;this.state='dead';this.reason=reason;this.events.push({type:'death',reason});}
  complete(){
    if(this.state!=='running')return;
    this.state='won';this.stars=1+Number(this.shards.size===0)+Number(this.elapsed<=this.level.par);
    this.score+=1000+Math.max(0,Math.floor((this.level.par-this.elapsed)*10));
    this.events.push({type:'win',stars:this.stars,score:this.score});
  }
  drain(){const events=this.events;this.events=[];return events;}
}

import {Game,DIRECTIONS,isWalkable,tileAt} from '../circuit/engine.mjs';

// Topology solver includes optional shards and alternating gates.
export function solveTopology(level){
  const goals=[...level.nodes,...level.shards],bits=new Map(goals.map((p,i)=>[p.y*level.width+p.x,1<<i])),all=(1<<goals.length)-1;
  const encode=(x,y,phase,mask)=>((mask*2+phase)*level.height+y)*level.width+x;
  const q=[{x:level.start.x,y:level.start.y,phase:0,mask:0,parent:-1,dir:null}],seen=new Set([encode(level.start.x,level.start.y,0,0)]);
  for(let i=0;i<q.length;i++){
    const s=q[i];if(s.x===level.exit.x&&s.y===level.exit.y&&s.mask===all){const route=[];let j=i;while(q[j].parent!==-1){route.push(q[j].dir);j=q[j].parent;}return route.reverse();}
    for(const [dir,d] of Object.entries(DIRECTIONS)){
      const x=s.x+d.x,y=s.y+d.y;if(!isWalkable(level,x,y,s.phase))continue;
      const phase=tileAt(level,x,y)==='T'?1-s.phase:s.phase,mask=s.mask|(bits.get(y*level.width+x)||0),key=encode(x,y,phase,mask);
      if(!seen.has(key)){seen.add(key);q.push({x,y,phase,mask,parent:i,dir});}
    }
  }
  return null;
}

function clone(game){
  const copy=Object.assign(Object.create(Game.prototype),game);
  copy.player={...game.player};copy.previous={...game.previous};copy.nodes=new Set(game.nodes);copy.shards=new Set(game.shards);copy.cloaks=new Set(game.cloaks);copy.events=[];
  copy.patrols=game.patrols.map(p=>({...p,previous:{...p.previous}}));return copy;
}
// Bounded deterministic timing search follows a verified geometric route and
// chooses waits / available cloaks. It never suppresses a hazard or edits a game.
export function scheduleRoute(level,route=solveTopology(level),beamWidth=160,maxTicks=350){
  if(!route)return null;
  const initial=new Game(level.id,level);initial.start();let frontier=[{game:initial,progress:0,trail:null}];
  for(let tick=0;tick<maxTicks;tick++){
    const candidates=[],seen=new Set();
    for(const state of frontier)for(const moving of [true,false])for(const cloak of [false,true]){
      if(cloak&&(state.game.charges<1||state.game.cloaked))continue;
      if(moving&&state.progress>=route.length)continue;
      const game=clone(state.game);if(cloak)game.cloak();
      const direction=moving?route[state.progress]:null;if(direction)game.turn(direction);else game.brake();
      game.tick();if(game.state==='dead')continue;
      const moved=game.player.x!==state.game.player.x||game.player.y!==state.game.player.y;
      if(moving&&!moved)continue;
      const progress=state.progress+Number(moving),trail={parent:state.trail,command:{direction,cloak}};
      if(game.state==='won'&&game.shards.size===0){const result=[];for(let link=trail;link;link=link.parent)result.push(link.command);return result.reverse();}
      if(game.state==='won')continue;
      const key=[progress,game.phase,game.charges,game.cloakTicks,[...game.cloaks].join('/'),game.patrols.map(p=>p.index+':'+p.step).join('/')].join('|');
      if(seen.has(key))continue;seen.add(key);candidates.push({game,progress,trail});
    }
    if(!candidates.length)return null;
    candidates.sort((a,b)=>b.progress-a.progress||(b.game.charges*30+b.game.cloakTicks)-(a.game.charges*30+a.game.cloakTicks));
    frontier=candidates.slice(0,beamWidth);
  }
  return null;
}
export function replay(level,commands){const game=new Game(level.id,level);game.start();for(const command of commands){if(command.cloak)game.cloak();if(command.direction)game.turn(command.direction);else game.brake();game.tick();}return game;}

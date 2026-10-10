import { LEVELS } from './levels.mjs';
export const KEY='casharcade-circuit-v1';
export const fresh=()=>({version:1,selected:0,unlocked:1,reducedMotion:false,records:LEVELS.map(()=>({stars:0,score:0,time:null,clears:0}))});
export function clean(raw){
  const value=fresh();if(!raw||raw.version!==1)return value;
  if(Number.isInteger(raw.unlocked))value.unlocked=Math.min(LEVELS.length,Math.max(1,raw.unlocked));
  if(Number.isInteger(raw.selected))value.selected=Math.min(value.unlocked-1,Math.max(0,raw.selected));
  if(typeof raw.reducedMotion==='boolean')value.reducedMotion=raw.reducedMotion;
  value.records=value.records.map((base,i)=>{
    const r=raw.records?.[i];if(!r||typeof r!=='object')return base;
    return {stars:Number.isInteger(r.stars)&&r.stars>=0&&r.stars<=3?r.stars:0,
      score:Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=1e8?r.score:0,
      time:Number.isFinite(r.time)&&r.time>0&&r.time<=86400?r.time:null,
      clears:Number.isSafeInteger(r.clears)&&r.clears>=0&&r.clears<=1e6?r.clears:0};
  });
  return value;
}
export function recordWin(data,game){
  if(game.state!=='won'||!Number.isInteger(game.level.id)||!data.records[game.level.id])return false;
  const r=data.records[game.level.id];r.stars=Math.max(r.stars,game.stars);r.score=Math.max(r.score,Math.floor(game.score));
  r.time=r.time===null?game.elapsed:Math.min(r.time,game.elapsed);r.clears++;
  data.unlocked=Math.max(data.unlocked,Math.min(LEVELS.length,game.level.id+2));return true;
}
export function create(storage){
  let available=true;if(arguments.length===0){try{storage=globalThis.localStorage;}catch{available=false;}}
  return {load(){try{return clean(JSON.parse(storage.getItem(KEY)));}catch{available=false;return fresh();}},
    save(value){try{const serialized=JSON.stringify(clean(value));storage.setItem(KEY,serialized);available=storage.getItem(KEY)===serialized;return available;}catch{available=false;return false;}},
    get available(){return available;}};
}

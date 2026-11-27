import { DIRECTIONS, laserState, pointKey } from './engine.mjs';

export const WIDTH=850, HEIGHT=700, TILE=44, LEFT=51, TOP=58;
const center=p=>({x:LEFT+(p.x+.5)*TILE,y:TOP+(p.y+.5)*TILE});
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
// Board-edge traces (left and right) that live light pulses travel along.
const EDGE_TRACES=Array.from({length:6},(_,i)=>{const y=120+i*72;return [[[0,y],[17,y],[30,y+13],[30,y+34],[46,y+50]],[[WIDTH,y+25],[WIDTH-17,y+25],[WIDTH-31,y+39],[WIDTH-31,y+64]]];}).flat();
function along(points,t){const segs=[];let total=0;for(let i=1;i<points.length;i++){const l=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);segs.push(l);total+=l;}let d=((t%1)+1)%1*total;for(let i=0;i<segs.length;i++){if(d<=segs[i]){const k=d/segs[i];return [mix(points[i][0],points[i+1][0],k),mix(points[i][1],points[i+1][1],k)];}d-=segs[i];}return points.at(-1);}
function rounded(ctx,x,y,w,h,r=7){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function diamond(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
function hex(ctx,x,y,r,angle=0){ctx.beginPath();for(let i=0;i<6;i++){const a=angle+i*Math.PI/3;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cache=null;this.cacheKey='';this.ratio=1;
    this.fx=globalThis.CashArcadeFX?.createFx({maxParticles:300})??null;this.clock=0;this.last=0;this.afterimages=[];this.switchAt=-9;this.exitAt=-9;}
  get busy(){return Boolean(this.fx?.busy)||this.clock-this.switchAt<.6||this.clock-this.exitAt<1;}
  // Game events become on-board feedback: bursts, score popups, phase sweep and exit beam.
  event(event,game){
    const fx=this.fx,at=event.position?center(event.position):center(game.player);
    if(event.type==='switch')this.switchAt=this.clock;
    if(event.type==='exitOpen')this.exitAt=this.clock;
    if(!fx)return;
    if(event.type==='node'){fx.burst(at.x,at.y,{kind:'spark',color:'#73f0ff',count:12,speed:200,life:.45});fx.burst(at.x,at.y,{kind:'ring',color:'#73f0ff',size:46,life:.35});fx.popup(at.x,at.y-22,'+100',{color:'#9ff6ff',size:14});}
    else if(event.type==='shard'){fx.burst(at.x,at.y,{kind:'shard',color:'#ffd37b',count:12,speed:220,life:.6});fx.burst(at.x,at.y,{kind:'ring',color:'#ffd37b',size:64,life:.45});fx.popup(at.x,at.y-24,'+250',{color:'#ffe29a',size:16});fx.shake(.12);}
    else if(event.type==='charge'){fx.burst(at.x,at.y,{kind:'ring',color:'#91ffd0',size:52,life:.4});fx.popup(at.x,at.y-22,'CLOAK +1',{color:'#b5ffdb',size:13});}
    else if(event.type==='cloak'){fx.burst(at.x,at.y,{kind:'ring',color:'#9fffcc',size:80,life:.5});fx.burst(at.x,at.y,{kind:'spark',color:'#9fffcc',count:10,speed:140,life:.5});}
    else if(event.type==='exitOpen'){const e=center(game.level.exit);fx.burst(e.x,e.y,{kind:'ring',color:'#8cffbf',size:120,life:.7});fx.banner('EXIT OPEN','能量已收齊',{color:'#8cffbf',duration:1});}
    else if(event.type==='death'){fx.burst(at.x,at.y,{kind:'shard',color:'#ff9bae',count:22,speed:300,life:.9});fx.burst(at.x,at.y,{kind:'ring',color:'#ff658e',size:120,life:.6});fx.flash('#ff3d6a',.25,.3);fx.shake(.7);fx.hitStop(.1);}
    else if(event.type==='win'){const e=center(game.level.exit);fx.burst(e.x,e.y,{kind:'spark',color:'#8cffbf',count:30,speed:380,life:.9});fx.flash('#8cffbf',.15,.3);}
    else if(event.type==='start')fx.banner(`CIRCUIT ${String(game.level.id+1).padStart(2,'0')}`,game.level.zone,{color:game.level.accent||'#57edff',duration:1});
  }
  base(ctx,level,light){
    const gradient=ctx.createRadialGradient(WIDTH*.47,HEIGHT*.4,30,WIDTH*.47,HEIGHT*.4,650);
    gradient.addColorStop(0,light?'#e8f2fc':'#101c36');gradient.addColorStop(1,light?'#d5e3f2':'#030814');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.lineWidth=1;ctx.strokeStyle=light?'#37639412':'#5c83be10';
    for(let x=7;x<WIDTH;x+=22){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
    for(let y=14;y<HEIGHT;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.strokeStyle=light?'#5a84ab66':'#34669966';ctx.lineWidth=1.5;
    // Original board-edge traces, deliberately fixed rather than random noise.
    for(let i=0;i<6;i++){
      const y=120+i*72;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(17,y);ctx.lineTo(30,y+13);ctx.lineTo(30,y+34);ctx.lineTo(46,y+50);ctx.stroke();
      ctx.beginPath();ctx.arc(17,y,2.8,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(WIDTH,y+25);ctx.lineTo(WIDTH-17,y+25);ctx.lineTo(WIDTH-31,y+39);ctx.lineTo(WIDTH-31,y+64);ctx.stroke();
    }
    rounded(ctx,LEFT-10,TOP-10,level.width*TILE+20,level.height*TILE+20,14);
    ctx.fillStyle=light?'#cedeed':'#061023';ctx.fill();ctx.strokeStyle=light?'#6c94b8':'#2b5076';ctx.stroke();
    for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){
      const px=LEFT+x*TILE,py=TOP+y*TILE,tile=level.rows[y][x];
      if(tile==='#'){
        rounded(ctx,px+2,py+2,TILE-4,TILE-4,6);ctx.fillStyle=light?'#a6bed6':'#16253f';ctx.fill();
        ctx.strokeStyle=light?'#6b90b5':'#3d82c6';ctx.lineWidth=1.25;ctx.stroke();
        ctx.strokeStyle=light?'#e9f6ff':'#7fd4ff8c';ctx.beginPath();ctx.moveTo(px+8,py+5);ctx.lineTo(px+TILE-8,py+5);ctx.stroke();
        if((x+y*3)%5===0){ctx.fillStyle=light?'#789ab7':'#31516d';ctx.fillRect(px+11,py+17,4,9);ctx.fillRect(px+18,py+17,4,9);ctx.fillRect(px+25,py+17,4,9);}
      } else {
        ctx.fillStyle=light?'#eaf3fa':'#0a1830';ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
        ctx.fillStyle=light?'#b2c8de':'#28415c';ctx.beginPath();ctx.arc(px+TILE/2,py+TILE/2,1.25,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.font='600 12px ui-monospace, monospace';ctx.textAlign='left';ctx.fillStyle=light?'#436784':'#7293b6';
    ctx.fillText(`CIRCUIT ${String(level.id+1).padStart(2,'0')} / ${level.zone}`,LEFT,31);
    ctx.textAlign='right';ctx.fillText('SECURE LINK  •  17 × 13',WIDTH-LEFT,31);
    ctx.textAlign='left';ctx.font='600 11px ui-monospace, monospace';ctx.fillText('ROUTE / COLLECT / ESCAPE',LEFT,HEIGHT-25);
    ctx.textAlign='right';ctx.fillText('CASHARCADE LABS',WIDTH-LEFT,HEIGHT-25);
  }
  background(level,light){
    const r=this.ratio,key=level.id+':'+light+':'+r;
    if(key!==this.cacheKey){
      const create=this.canvas.ownerDocument?.createElement.bind(this.canvas.ownerDocument);
      this.cache=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(WIDTH*r,HEIGHT*r):create?create('canvas'):null;
      if(this.cache){this.cache.width=WIDTH*r;this.cache.height=HEIGHT*r;const c=this.cache.getContext('2d');c.setTransform?.(r,0,0,r,0,0);this.base(c,level,light);}
      this.cacheKey=key;
    }
    if(this.cache)this.ctx.drawImage(this.cache,0,0,WIDTH,HEIGHT);else this.base(this.ctx,level,light);
  }
  // Live layer over the cached board: pulses running the edge traces and the phase-switch sweep.
  ambience(game,light,reducedMotion){
    const ctx=this.ctx,color=light?'#2f78b0':'#57edff';
    if(!reducedMotion){ctx.save();ctx.globalCompositeOperation=light?'source-over':'lighter';ctx.fillStyle=color;
      EDGE_TRACES.forEach((trace,i)=>{const [x,y]=along(trace,this.clock*.45+i*.17);ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.2;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();});
      ctx.restore();}
    const sweep=this.clock-this.switchAt;
    if(sweep<.6&&!reducedMotion){const k=sweep/.6,col=game.phase===0?'#ffba63':'#b68aff';ctx.save();ctx.globalAlpha=(1-k)*.5;ctx.strokeStyle=col;ctx.lineWidth=10;const y=TOP+k*game.level.height*TILE;ctx.beginPath();ctx.moveTo(LEFT-6,y);ctx.lineTo(LEFT+game.level.width*TILE+6,y);ctx.stroke();ctx.restore();}
  }
  render(game,{theme='dark',reducedMotion=false}={}){
    const ctx=this.ctx,level=game.level,light=theme==='light',time=reducedMotion?0:game.elapsed;
    const now=globalThis.performance?.now?.()??0,dt=this.last?Math.min(.05,Math.max(0,(now-this.last)/1000)):0;this.last=now;this.clock+=dt;
    this.fx?.setReduced(reducedMotion);this.fx?.update(dt);
    this.ratio=globalThis.CashArcadeFX?.fitCanvas(this.canvas,WIDTH,HEIGHT)??1;ctx.setTransform?.(this.ratio,0,0,this.ratio,0,0);
    // Smoothstep easing turns each 0.15 s grid step into a glide rather than a linear slide.
    const alpha=game.state==='running'&&!reducedMotion?smooth(Math.max(0,Math.min(1,game.interpolation))):1;
    this.background(level,light);ctx.save();this.fx?.apply(ctx);this.ambience(game,light,reducedMotion);ctx.lineCap='round';ctx.lineJoin='round';
    const glow=(color,size=12)=>{ctx.shadowColor=color;ctx.shadowBlur=light||reducedMotion?0:size;};
    // Alternate routes retain a labeled outline when open.
    for(const gate of level.gates){
      const p=center(gate),open=gate.phase===game.phase,color=gate.phase===0?'#ffba63':'#b68aff';
      ctx.save();glow(color,open?4:14);rounded(ctx,p.x-18,p.y-18,36,36,7);ctx.fillStyle=light?(open?'#ffffff70':'#ffffff'):(open?'#14223980':'#20263b');ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=open?1.5:3;ctx.setLineDash(open?[3,4]:[]);ctx.stroke();ctx.setLineDash([]);
      if(!open){ctx.lineWidth=3;for(let i=-10;i<=10;i+=10){ctx.beginPath();ctx.moveTo(p.x+i-6,p.y-13);ctx.lineTo(p.x+i+6,p.y+13);ctx.stroke();}}
      ctx.shadowBlur=0;ctx.font='bold 9px ui-monospace, monospace';ctx.textAlign='center';ctx.fillStyle=light?'#425572':'#f3efff';ctx.fillText(gate.phase===0?'A':'B',p.x,p.y+3);ctx.restore();
    }
    for(const sw of level.switches){const p=center(sw),color=game.phase===0?'#ffba63':'#b68aff';ctx.save();glow(color);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,9,time,time+Math.PI*1.5);ctx.stroke();ctx.fillStyle=color;ctx.fillRect(p.x-3,p.y-3,6,6);ctx.restore();}
    for(const laser of level.lasers){
      const p=center(laser),state=laserState(game.tickCount,laser.offset),active=state==='active';ctx.save();ctx.fillStyle=light?'#cf965033':'#ff814d18';rounded(ctx,p.x-18,p.y-18,36,36,4);ctx.fill();ctx.strokeStyle=active?'#ff725d':state==='warning'?'#ffbd70':light?'#caa07c':'#885543';ctx.lineWidth=active?5:state==='warning'?3:2;glow(ctx.strokeStyle,active?17:state==='warning'?10:0);
      if(state==='warning'&&!reducedMotion){ctx.globalAlpha=.55+Math.sin(this.clock*30)*.45;}
      if(active&&!reducedMotion){const j=Math.sin(this.clock*80)*1.2;ctx.translate(j,-j);if(this.fx&&Math.sin(this.clock*13+laser.x)>.92)this.fx.burst(p.x,p.y,{kind:'spark',color:'#ffb08a',count:1,speed:160,life:.25,size:1.6});}
      if(!active)ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(p.x-17,p.y-15);ctx.lineTo(p.x+17,p.y+15);ctx.moveTo(p.x+17,p.y-15);ctx.lineTo(p.x-17,p.y+15);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.fillStyle=active?'#ffe7b2':'#b97953';for(const k of [-1,1])ctx.fillRect(p.x+k*16-3,p.y+k*15-3,6,6);ctx.restore();
    }
    const exit=center(level.exit);
    if(game.exitOpen&&!reducedMotion){const k=Math.min(1,(this.clock-this.exitAt)/.4),h=exit.y*k;ctx.save();ctx.globalCompositeOperation=light?'source-over':'lighter';ctx.fillStyle='#8cffbf18';ctx.fillRect(exit.x-14,exit.y-h,28,h);ctx.fillStyle='#8cffbf40';ctx.fillRect(exit.x-3,exit.y-h,6,h);ctx.restore();}
    ctx.save();const exitColor=game.exitOpen?'#8cffbf':light?'#8b98ae':'#516480';glow(exitColor,game.exitOpen?24:0);rounded(ctx,exit.x-17,exit.y-17,34,34,8);ctx.fillStyle=game.exitOpen?(light?'#baf2d3':'#123d33'):(light?'#d2deea':'#19283e');ctx.fill();ctx.strokeStyle=exitColor;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=exitColor;ctx.beginPath();ctx.moveTo(exit.x-7,exit.y);ctx.lineTo(exit.x+7,exit.y);ctx.lineTo(exit.x+1,exit.y-6);ctx.moveTo(exit.x+7,exit.y);ctx.lineTo(exit.x+1,exit.y+6);ctx.stroke();ctx.restore();
    for(const p0 of level.nodes){if(!game.nodes.has(pointKey(p0)))continue;const p=center(p0),pulse=1+Math.sin(time*4+p0.x+p0.y)*.09;ctx.save();glow('#43e6ff',14);ctx.strokeStyle=light?'#21a4bb':'#258aa5';ctx.lineWidth=1;diamond(ctx,p.x,p.y,12*pulse);ctx.stroke();diamond(ctx,p.x,p.y,6.5*pulse);ctx.fillStyle=light?'#087e9e':'#73f0ff';ctx.fill();ctx.restore();}
    for(const p0 of level.shards){if(!game.shards.has(pointKey(p0)))continue;const p=center(p0);ctx.save();glow('#ffd06e',17);ctx.fillStyle=light?'#b97709':'#ffd37b';diamond(ctx,p.x,p.y,10);ctx.fill();ctx.fillStyle=light?'#ffe6a1':'#fff2c9';diamond(ctx,p.x,p.y-1,4);ctx.fill();ctx.restore();}
    for(const p0 of level.cloaks){if(!game.cloaks.has(pointKey(p0)))continue;const p=center(p0);ctx.save();glow('#8effba',12);hex(ctx,p.x,p.y,12,Math.PI/6);ctx.strokeStyle=light?'#18955e':'#91ffd0';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=light?'#168e5c':'#b5ffdb';ctx.fillRect(p.x-6,p.y-2,12,4);ctx.fillRect(p.x-2,p.y-6,4,12);ctx.restore();}
    // Patrol drones: a faceted hull, bright optic and visible travel direction.
    for(const patrol of game.patrols){
      const p=center({x:mix(patrol.previous.x,patrol.x,alpha),y:mix(patrol.previous.y,patrol.y,alpha)});
      const target=patrol.path[Math.max(0,Math.min(patrol.path.length-1,patrol.index+patrol.step))],dx=Math.sign(target.x-patrol.x),dy=Math.sign(target.y-patrol.y);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(dy,dx));glow('#ff658e',15);hex(ctx,0,0,15);ctx.fillStyle=light?'#cf3560':'#501b3c';ctx.fill();ctx.strokeStyle=light?'#ad244d':'#ff79a6';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=light?'#fff4f8':'#ffe4f4';rounded(ctx,-3,-6,9,12,3);ctx.fill();ctx.fillStyle='#ff578c';ctx.fillRect(2,-3,4,6);ctx.strokeStyle=light?'#bc496480':'#ff63845c';ctx.beginPath();ctx.moveTo(19,-6);ctx.lineTo(25,0);ctx.lineTo(19,6);ctx.stroke();ctx.restore();
    }
    const player=center({x:mix(game.previous.x,game.player.x,alpha),y:mix(game.previous.y,game.player.y,alpha)}),before=center(game.previous);
    ctx.save();const color=game.cloaked?'#9fffcc':level.accent;glow(color,20);
    if(!reducedMotion&&game.state==='running'){ctx.lineWidth=12;ctx.strokeStyle=color+'45';ctx.beginPath();ctx.moveTo(before.x,before.y);ctx.lineTo(player.x,player.y);ctx.stroke();}
    if(!reducedMotion&&game.state==='running'){this.afterimages.push({x:player.x,y:player.y});if(this.afterimages.length>6)this.afterimages.shift();
      this.afterimages.forEach((a,i)=>{ctx.globalAlpha=(i+1)/this.afterimages.length*.18;rounded(ctx,a.x-12,a.y-12,24,24,6);ctx.fillStyle=color;ctx.fill();});ctx.globalAlpha=1;}
    ctx.translate(player.x,player.y);
    const breathe=reducedMotion?0:Math.sin(this.clock*5)*1.5;ctx.strokeStyle=color+'55';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,20+breathe,0,Math.PI*2);ctx.stroke();
    if(game.cloaked){ctx.globalAlpha=.6+(reducedMotion?0:Math.sin(this.clock*22)*.2);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,23,reducedMotion?0:this.clock*3,(reducedMotion?0:this.clock*3)+Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    ctx.scale(1.15,1.15);
    rounded(ctx,-12,-12,24,24,6);ctx.fillStyle=game.state==='dead'?'#843954':light?'#087c9a':'#176481';ctx.fill();ctx.strokeStyle=game.state==='dead'?'#ff9bae':color;ctx.lineWidth=2;ctx.stroke();diamond(ctx,0,0,7);ctx.fillStyle=game.state==='dead'?'#ffd6e1':'#efffff';ctx.fill();
    const dir=DIRECTIONS[game.direction];if(dir){ctx.fillStyle=game.state==='dead'?'#ff9bae':color;ctx.beginPath();ctx.arc(dir.x*16,dir.y*16,2.5,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    this.fx?.draw(ctx,WIDTH,HEIGHT);
    ctx.restore();
    if(!light)globalThis.CashArcadeFX?.crt(ctx,WIDTH,HEIGHT,.05);
  }
  destroy(){this.cache=null;}
}

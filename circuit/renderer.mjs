import { DIRECTIONS, laserState, pointKey } from './engine.mjs';

export const WIDTH=850, HEIGHT=700, TILE=44, LEFT=51, TOP=58;
const center=p=>({x:LEFT+(p.x+.5)*TILE,y:TOP+(p.y+.5)*TILE});
const mix=(a,b,t)=>a+(b-a)*t;
function rounded(ctx,x,y,w,h,r=7){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function diamond(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
function hex(ctx,x,y,r,angle=0){ctx.beginPath();for(let i=0;i<6;i++){const a=angle+i*Math.PI/3;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cache=null;this.cacheKey='';}
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
        ctx.strokeStyle=light?'#6b90b5':'#2c4970';ctx.lineWidth=1;ctx.stroke();
        ctx.strokeStyle=light?'#e9f6ff':'#4777a74d';ctx.beginPath();ctx.moveTo(px+8,py+5);ctx.lineTo(px+TILE-8,py+5);ctx.stroke();
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
    const key=level.id+':'+light;
    if(key!==this.cacheKey){
      const create=this.canvas.ownerDocument?.createElement.bind(this.canvas.ownerDocument);
      this.cache=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(WIDTH,HEIGHT):create?create('canvas'):null;
      if(this.cache){this.cache.width=WIDTH;this.cache.height=HEIGHT;this.base(this.cache.getContext('2d'),level,light);}
      this.cacheKey=key;
    }
    if(this.cache)this.ctx.drawImage(this.cache,0,0);else this.base(this.ctx,level,light);
  }
  render(game,{theme='dark',reducedMotion=false}={}){
    const ctx=this.ctx,level=game.level,light=theme==='light',time=reducedMotion?0:game.elapsed;
    const alpha=game.state==='running'&&!reducedMotion?game.interpolation:1;
    this.background(level,light);ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
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
      const p=center(laser),state=laserState(game.tickCount,laser.offset),active=state==='active';ctx.save();ctx.fillStyle=light?'#cf965033':'#ff814d18';rounded(ctx,p.x-18,p.y-18,36,36,4);ctx.fill();ctx.strokeStyle=active?'#ff725d':state==='warning'?'#ffbd70':light?'#caa07c':'#885543';ctx.lineWidth=active?5:2;glow(ctx.strokeStyle,active?17:0);
      if(!active)ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(p.x-17,p.y-15);ctx.lineTo(p.x+17,p.y+15);ctx.moveTo(p.x+17,p.y-15);ctx.lineTo(p.x-17,p.y+15);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;ctx.fillStyle=active?'#ffe7b2':'#b97953';for(const k of [-1,1])ctx.fillRect(p.x+k*16-3,p.y+k*15-3,6,6);ctx.restore();
    }
    const exit=center(level.exit);ctx.save();const exitColor=game.exitOpen?'#8cffbf':light?'#8b98ae':'#516480';glow(exitColor,game.exitOpen?24:0);rounded(ctx,exit.x-17,exit.y-17,34,34,8);ctx.fillStyle=game.exitOpen?(light?'#baf2d3':'#123d33'):(light?'#d2deea':'#19283e');ctx.fill();ctx.strokeStyle=exitColor;ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=exitColor;ctx.beginPath();ctx.moveTo(exit.x-7,exit.y);ctx.lineTo(exit.x+7,exit.y);ctx.lineTo(exit.x+1,exit.y-6);ctx.moveTo(exit.x+7,exit.y);ctx.lineTo(exit.x+1,exit.y+6);ctx.stroke();ctx.restore();
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
    ctx.translate(player.x,player.y);if(game.cloaked){ctx.globalAlpha=.76;ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    rounded(ctx,-12,-12,24,24,6);ctx.fillStyle=game.state==='dead'?'#843954':light?'#087c9a':'#176481';ctx.fill();ctx.strokeStyle=game.state==='dead'?'#ff9bae':color;ctx.lineWidth=2;ctx.stroke();diamond(ctx,0,0,7);ctx.fillStyle=game.state==='dead'?'#ffd6e1':'#efffff';ctx.fill();
    const dir=DIRECTIONS[game.direction];if(dir){ctx.fillStyle=game.state==='dead'?'#ff9bae':color;ctx.beginPath();ctx.arc(dir.x*16,dir.y*16,2.5,0,Math.PI*2);ctx.fill();}
    ctx.restore();ctx.restore();
  }
  destroy(){this.cache=null;}
}

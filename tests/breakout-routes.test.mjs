/* Spatial flood audit: progressively clear reachable faces and matching locks.
 * This proves geometry has no sealed required target, not that arbitrary AI play wins. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { Game }=createRequire(import.meta.url)('../breakout/engine.js');
const cell=2,nx=353,ny=238,r=8;
function accessible(g) {
    const solid=[...g.bricks.filter(b=>b.hp!==0),...g.level.gates.filter(b=>!b.open)];
    const blocked=new Uint8Array(nx*ny),seen=new Uint8Array(nx*ny),queue=new Int32Array(nx*ny);
    for(const b of solid){const x0=Math.max(0,Math.floor((b.x-r-8)/cell)),x1=Math.min(nx-1,Math.ceil((b.x+b.w+r-8)/cell));const y0=Math.max(0,Math.floor((b.y-r-8)/cell)),y1=Math.min(ny-1,Math.ceil((b.y+b.h+r-8)/cell));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*nx+x]=1;}
    let head=0,tail=0;for(let x=0;x<nx;x++){const p=(ny-1)*nx+x;if(!blocked[p]){seen[p]=1;queue[tail++]=p;}}
    const add=(x,y)=>{if(x<0||x>=nx||y<0||y>=ny)return;const p=y*nx+x;if(!blocked[p]&&!seen[p]){seen[p]=1;queue[tail++]=p;}};
    while(head<tail){const p=queue[head++],x=p%nx,y=Math.floor(p/nx);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);
        for(const port of g.level.portals){if(port.requires&&!g.level.gates.find(gate=>gate.id===port.requires)?.open)continue;const xx=8+x*cell,yy=8+y*cell;if(Math.hypot(xx-port.x,yy-port.y)<port.r+r+3)add(Math.round((port.tx+Math.cos(port.angle)*(port.r+r+3)-8)/cell),Math.round((port.ty+Math.sin(port.angle)*(port.r+r+3)-8)/cell));}
    }
    return (x,y)=>{const xx=Math.round((x-8)/cell),yy=Math.round((y-8)/cell);return xx>=0&&xx<nx&&yy>=0&&yy<ny&&seen[yy*nx+xx];};
}
function clearAudit(g) {
    for(let pass=0;pass<50;pass++) {
        let progress=0;
        // Independently phased moving gates must be sampled across their full opening cycle.
        for(let sample=0;sample<(g.level.gates.some(b=>b.motion)?24:1);sample++) {
        g.time=sample*.5;g.animateMechanisms();const reachable=accessible(g);
        for(const b of g.bricks) {
            if(b.hp<=0||(b.bossRole==='core'&&g.bricks.some(n=>n.bossRole==='node'&&n.hp>0)))continue;
            let touch=false;
            for(let x=b.x+3;x<b.x+b.w-2;x+=4){if(reachable(x,b.y-r-4))touch=true;if(b.type!=='directional'&&reachable(x,b.y+b.h+r+4))touch=true;}
            if(b.type!=='directional')for(let y=b.y+3;y<b.y+b.h-2;y+=4)if(reachable(b.x-r-4,y)||reachable(b.x+b.w+r+4,y))touch=true;
            if(touch){g.hitBrick(b,999,{ny:-1,strong:true,secondary:true});progress++;}
        }
        }
        if(!g.bricks.some(b=>b.hp>0)||g.level.boss&&!g.bricks.some(b=>b.bossRole==='core'&&b.hp>0))return [];
        if(!progress)return g.bricks.filter(b=>b.hp>0).map(b=>`${b.id}:${b.type}`);
    }
    return ['too many passes'];
}
for(let i=0;i<30;i++)test(`stage ${i+1}: every required target has a reachable damage face`,()=>{
    const g=new Game({levelIndex:i});
    for(let wave=0;wave<(i===28?3:1);wave++){g.wave=wave;g.loadLevel();assert.deepEqual(clearAudit(g),[],`wave ${wave+1}`);}
});

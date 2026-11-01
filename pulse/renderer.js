(() => {
  'use strict';
  const W=800,H=800,HIT=655,COLORS=['#51efd7','#fa78d1'];
  class Renderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.lastSize=0;}
    point(lane,delta,speed=2.4){const progress=Math.max(-.1,Math.min(1.2,1-delta/speed)),depth=Math.pow(Math.max(0,progress),1.55);return {x:400+(lane?1:-1)*(40+120*depth),y:110+545*depth,width:40+95*depth,depth};}
    line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
    text(text,x,y,size=12,color='#d3eafa',align='center'){const c=this.ctx;c.fillStyle=color;c.font=`${size>=22?800:600} ${size}px ui-monospace, monospace`;c.textAlign=align;c.fillText(text,x,y);}
    bar(lane,delta,color,thin=false){const c=this.ctx,p=this.point(lane,delta);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=thin?0:15;c.beginPath();c.moveTo(p.x-p.width/2,p.y-8);c.lineTo(p.x+p.width/2,p.y-8);c.lineTo(p.x+p.width/2+3,p.y+8);c.lineTo(p.x-p.width/2-3,p.y+8);c.closePath();c.fill();c.shadowBlur=0;if(!thin){c.fillStyle='#f0ffff';c.fillRect(p.x-p.width*.22,p.y-2,p.width*.44,3);}}
    render(game,{time=game.time,reducedMotion=false,calibration=null,countdown=0}={}){
      const c=this.ctx,dpr=Math.min(2,globalThis.devicePixelRatio||1),width=Math.round((this.canvas.clientWidth||800)*dpr);if(width!==this.lastSize){this.canvas.width=width;this.canvas.height=width;this.lastSize=width;}c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);
      const gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#0e1230');gradient.addColorStop(.52,'#071a2b');gradient.addColorStop(1,'#07101e');c.fillStyle=gradient;c.fillRect(0,0,W,H);
      const beat=time*game.track.bpm/60,phase=((beat%1)+1)%1,pulse=reducedMotion?.13:1-phase;
      // Dim architectural silhouettes preserve contrast behind the moving notes.
      for(let i=0;i<24;i++){const x=(i*137)%800,y=72+(i*43)%115;c.fillStyle=i%2?'#1b214833':'#21384c44';c.fillRect(x,y,14+i%5*7,340-y);this.line(x,y,x,y+50,COLORS[i%2]+'22');}
      c.save();c.globalAlpha=.16;for(let i=0;i<12;i++){const y=100+i*49;this.line(0,y,800,y,'#537d9f',1);}c.restore();
      for(let lane=0;lane<2;lane++){const top=this.point(lane,2.4),bottom=this.point(lane,-.3);c.fillStyle=lane?'#46234140':'#18464644';c.beginPath();c.moveTo(top.x-26,105);c.lineTo(top.x+26,105);c.lineTo(bottom.x+bottom.width/2+18,790);c.lineTo(bottom.x-bottom.width/2-18,790);c.closePath();c.fill();this.line(top.x-26,105,bottom.x-bottom.width/2-18,790,COLORS[lane]+'66',2);this.line(top.x+26,105,bottom.x+bottom.width/2+18,790,COLORS[lane]+'66',2);}
      this.text('P U L S E   S W I T C H',400,46,12,'#87a4bd');this.text(game.track.subtitle,400,76,10,game.track.color);
      for(let b=Math.ceil(beat-.5);b<beat+2.4*game.track.bpm/60;b++){const at=b*60/game.track.bpm-time,p0=this.point(0,at),p1=this.point(1,at);if(p0.y<105||p0.y>760)continue;this.line(p0.x-p0.width/2,p0.y,p1.x+p1.width/2,p1.y,b%4===0?'#b5d4ec39':'#b5d4ec16',b%4===0?2:1);}
      const visible=game.notes.filter(n=>n.status!=='done'&&n.end-time>-.25&&n.time-time<2.6).sort((a,b)=>b.time-a.time);
      for(const n of visible){const color=n.kind==='gate'?'#ffce79':COLORS[n.lane],head=n.status==='holding'?0:n.time-time;
        if(n.kind==='hold'){const bottom=this.point(n.lane,head),top=this.point(n.lane,n.end-time);c.fillStyle=n.status==='holding'?color+'bb':color+'65';c.beginPath();c.moveTo(top.x-top.width*.23,top.y);c.lineTo(top.x+top.width*.23,top.y);c.lineTo(bottom.x+bottom.width*.23,bottom.y);c.lineTo(bottom.x-bottom.width*.23,bottom.y);c.closePath();c.fill();this.bar(n.lane,n.end-time,color,true);this.text('放',top.x,top.y-16,11,'#f1f9ff');if(n.status==='holding'){const charge=Math.max(0,Math.min(1,(time-n.time)/(n.end-n.time)));this.text('CHARGE '+Math.round(charge*100)+'%',bottom.x,bottom.y+45,12,color);}}
        if(n.time-time>-.3||n.status==='holding')this.bar(n.lane,head,color);
        if(n.kind==='gate'&&n.lane===0){const a=this.point(0,n.time-time),b=this.point(1,n.time-time);this.line(a.x,a.y,b.x,b.y,'#ffce7988',2);this.text('◆',400,a.y+5,17,'#ffce79');}
      }
      for(let lane=0;lane<2;lane++){const p=this.point(lane,0),active=game.held[lane];c.shadowColor=COLORS[lane];c.shadowBlur=active?24:8;c.fillStyle=active?COLORS[lane]+'70':'#142b40';c.strokeStyle=COLORS[lane];c.lineWidth=active?4:2;c.beginPath();c.roundRect(p.x-p.width*.58,HIT-20,p.width*1.16,40,10);c.fill();c.stroke();c.shadowBlur=0;this.line(p.x-p.width*.42,HIT,p.x+p.width*.42,HIT,'#f0f9ff',3);if(!reducedMotion){c.strokeStyle=COLORS[lane]+Math.round(pulse*65).toString(16).padStart(2,'0');c.lineWidth=2;c.beginPath();c.arc(p.x,HIT,30+(1-pulse)*32,0,Math.PI*2);c.stroke();}this.text(lane?'J / →':'F / ←',p.x,740,17,COLORS[lane]);}
      this.text('H I T   L I N E',400,697,9,'#819aae');
      if(game.last&&time-game.last.time<.65&&game.state==='running'){const labels={perfect:'PERFECT',good:'GREAT',ok:'GOOD',miss:'MISS',empty:'空拍'},color={perfect:'#a2fff0',good:'#a7caff',ok:'#ffd986',miss:'#ff769c',empty:'#9ab3c9'}[game.last.result];this.text(labels[game.last.result],400,370,30,color);if(Number.isFinite(game.last.delta)&&game.last.result!=='miss')this.text(Math.abs(game.last.delta)<.015?'JUST IN TIME':(game.last.delta<0?'EARLY ':'LATE ')+Math.round(Math.abs(game.last.delta)*1000)+' ms',400,398,11,'#adc2d7');}
      if(game.combo>=3){this.text(String(game.combo).padStart(3,'0'),400,466,43,'#e7f5ff');this.text('C O M B O',400,489,9,'#8da6bd');}
      if(countdown>0&&game.state==='running'){this.text(String(Math.min(time<0?4:2,Math.ceil(countdown/(60/game.track.bpm)))),400,269,64,'#f0f9ff');this.text(time<0?'跟著拍點，準備出發':'按回長音軌道，準備接續',400,305,13,'#b7d6ea');}
      if(calibration){c.fillStyle='#091529e8';c.fillRect(70,140,660,450);const amount=((calibration.position%1)+1)%1,r=45+(1-amount)*25;c.strokeStyle='#63ecd7';c.lineWidth=4;c.beginPath();c.arc(400,315,r,0,Math.PI*2);c.stroke();this.text('跟著聲音點拍',400,208,27,'#e8f6ff');this.text(calibration.count+' / 12',400,324,24,'#a2fff0');this.text('先聽 3 拍，再按任一軌或空白鍵',400,435,15,'#a8c4da');this.text('不要追著光圈，專心聽每個節拍',400,468,13,'#91aac1');}
      const progress=Math.max(0,Math.min(1,time/game.chart.duration));c.fillStyle='#3a526055';c.fillRect(0,795,800,5);c.fillStyle=game.track.color;c.fillRect(0,795,800*progress,5);
    }
  }
  globalThis.PulseRenderer={Renderer};
})();

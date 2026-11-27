(() => {
  'use strict';
  const W=800,H=800,HIT=655,COLORS=['#51efd7','#fa78d1'];
  class Renderer{
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.lastSize=0;this.fx=globalThis.CashArcadeFX?.createFx({maxParticles:260,maxShake:8})??null;this.glowLane=[0,0];this.miss=[0,0];this.heat=0;this.last=0;}
    get busy(){return Boolean(this.fx?.busy)||this.glowLane[0]>0||this.glowLane[1]>0||this.miss[0]>0||this.miss[1]>0;}
    // Hit rewards: lane bursts, perfect stars, gate flashes and combo milestones. No hit-stop: the chart follows the music clock.
    event(e,game){
      if(e.type==='judgement'){const lane=e.lane===1?1:0,p=this.point(lane,0),color=COLORS[lane];
        if(e.result==='miss'){this.miss[lane]=1;this.fx?.shake(.12);return;}
        this.glowLane[lane]=1;const fx=this.fx;if(!fx)return;
        fx.burst(p.x,HIT,{color,count:e.result==='perfect'?16:9,speed:e.result==='perfect'?420:300,angle:-Math.PI/2,spread:1.6,life:.45,size:2.2});
        fx.burst(p.x,HIT,{kind:'ring',color:e.result==='perfect'?'#fff6c8':color,size:e.result==='perfect'?120:80,life:.35});
        if(e.result==='perfect')fx.burst(p.x,HIT,{kind:'shard',color:'#ffe9a6',count:6,speed:260,angle:-Math.PI/2,spread:2.2,life:.5});
        const combo=game?.combo||0;if(combo>0&&combo%25===0){fx.popup(400,540,combo+' COMBO!',{color:'#ffe9a6',size:30,life:1.1,rise:30});fx.flash(game.track.color,.1,.25);fx.shake(.18);}
      }
      if(e.type==='gate'&&this.fx){this.fx.flash('#ffce79',.14,.22);this.fx.shake(.22);for(const lane of [0,1]){const p=this.point(lane,0);this.fx.burst(p.x,HIT,{color:'#ffce79',count:12,speed:380,angle:-Math.PI/2,spread:1.8,life:.5});}this.fx.popup(400,600,'GATE',{color:'#ffce79',size:22});}
      if(e.type==='empty'){this.miss[e.lane===1?1:0]=.7;}
      if(e.type==='finish'&&this.fx)this.fx.banner('TRACK COMPLETE',game?.track?.name??'',{color:game?.track?.color??'#a2fff0',duration:1.6});
    }
    point(lane,delta,speed=2.4){const progress=Math.max(-.1,Math.min(1.2,1-delta/speed)),depth=Math.pow(Math.max(0,progress),1.55);return {x:400+(lane?1:-1)*(40+120*depth),y:110+545*depth,width:40+95*depth,depth};}
    line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
    text(text,x,y,size=12,color='#d3eafa',align='center'){const c=this.ctx;c.fillStyle=color;c.font=`${size>=22?800:600} ${size}px ui-monospace, monospace`;c.textAlign=align;c.fillText(text,x,y);}
    bar(lane,delta,color,thin=false){const c=this.ctx,p=this.point(lane,delta);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=thin?0:15;c.beginPath();c.moveTo(p.x-p.width/2,p.y-8);c.lineTo(p.x+p.width/2,p.y-8);c.lineTo(p.x+p.width/2+3,p.y+8);c.lineTo(p.x-p.width/2-3,p.y+8);c.closePath();c.fill();c.shadowBlur=0;if(!thin){c.fillStyle='#f0ffff';c.fillRect(p.x-p.width*.22,p.y-2,p.width*.44,3);}}
    render(game,{time=game.time,reducedMotion=false,calibration=null,countdown=0}={}){
      const c=this.ctx,dpr=Math.min(2,globalThis.devicePixelRatio||1),width=Math.round((this.canvas.clientWidth||800)*dpr);if(width!==this.lastSize){this.canvas.width=width;this.canvas.height=width;this.lastSize=width;}c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);
      const now=globalThis.performance?.now?.()??0,dt=this.last?Math.min(.1,Math.max(0,(now-this.last)/1000)):0;this.last=now;
      this.fx?.setReduced(reducedMotion);this.fx?.update(dt);for(const k of [0,1]){this.glowLane[k]=Math.max(0,this.glowLane[k]-dt*4);this.miss[k]=Math.max(0,this.miss[k]-dt*3);}
      this.heat+=((Math.min(1,(game.combo||0)/60))-this.heat)*Math.min(1,dt*3);
      const gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#0e1230');gradient.addColorStop(.52,'#071a2b');gradient.addColorStop(1,'#07101e');c.fillStyle=gradient;c.fillRect(0,0,W,H);
      const beat=time*game.track.bpm/60,phase=((beat%1)+1)%1,pulse=reducedMotion?.13:1-phase,live=!reducedMotion&&game.state==='running';
      const kick=live?Math.pow(1-phase,3):0,bar=Math.floor(beat);
      // Beat-reactive skyline: a sky bloom on every beat, twinkling stars and window lights that switch on the bar.
      if(kick>0){c.save();c.globalAlpha=kick*(.06+this.heat*.08);c.fillStyle=game.track.color;c.fillRect(0,0,W,360);c.restore();}
      for(let i=0;i<40;i++){const x=(i*211.7+time*(4+i%3*3))%800,y=(i*97)%180+8,tw=live?.25+.35*Math.abs(Math.sin(time*1.7+i)):.3;c.fillStyle='#cfe8ff';c.globalAlpha=tw;c.fillRect(x,y,i%6?1:2,i%6?1:2);}c.globalAlpha=1;
      for(let i=0;i<24;i++){const x=(i*137)%800,y=72+(i*43)%115,w=14+i%5*7;c.fillStyle=i%2?'#1b214833':'#21384c44';c.fillRect(x,y,w,340-y);this.line(x,y,x,y+50,COLORS[i%2]+(live&&(bar+i)%4===0?'88':'22'));
        for(let r=0;r<6;r++)for(let k=0;k+3<w;k+=7){const on=((i*7+r*3+k+(live?bar:0))%5)===0;if(on){c.fillStyle=COLORS[(i+r)%2]+(live?Math.round(40+kick*90).toString(16).padStart(2,'0'):'33');c.fillRect(x+k+2,y+12+r*14,3,5);}}}
      // Equalizer bars along the top breathe with the beat and swell with combo heat.
      for(let i=0;i<32;i++){const v=live?(.25+.75*Math.abs(Math.sin(i*1.7+bar*2.3)))*(.35+kick*.65)*(.6+this.heat*.6):.2,h=8+v*42;c.fillStyle=COLORS[i%2]+'55';c.fillRect(20+i*24.4,96-h,14,h);}
      c.save();c.globalAlpha=.16+kick*.08;for(let i=0;i<12;i++){const y=100+i*49;this.line(0,y,800,y,'#537d9f',1);}c.restore();
      c.save();this.fx?.apply(c);
      for(let lane=0;lane<2;lane++){const top=this.point(lane,2.4),bottom=this.point(lane,-.3);c.fillStyle=this.miss[lane]>0?'#ff4f7a'+Math.round(20+this.miss[lane]*60).toString(16).padStart(2,'0'):lane?'#46234140':'#18464644';c.beginPath();c.moveTo(top.x-26,105);c.lineTo(top.x+26,105);c.lineTo(bottom.x+bottom.width/2+18,790);c.lineTo(bottom.x-bottom.width/2-18,790);c.closePath();c.fill();const edge=COLORS[lane]+Math.round(102+this.heat*120+this.glowLane[lane]*30).toString(16).padStart(2,'0');this.line(top.x-26,105,bottom.x-bottom.width/2-18,790,edge,2+this.heat*1.5);this.line(top.x+26,105,bottom.x+bottom.width/2+18,790,edge,2+this.heat*1.5);
        // A hit lights a column of energy up the lane.
        if(this.glowLane[lane]>0){const g=this.glowLane[lane],p=this.point(lane,0);c.save();c.globalAlpha=g*.35;c.fillStyle=COLORS[lane];c.beginPath();c.moveTo(p.x-p.width*.5,HIT);c.lineTo(p.x+p.width*.5,HIT);c.lineTo(top.x+8,HIT-420*g);c.lineTo(top.x-8,HIT-420*g);c.closePath();c.fill();c.restore();}}
      this.text('P U L S E   S W I T C H',400,46,12,'#87a4bd');this.text(game.track.subtitle,400,76,10,game.track.color);
      for(let b=Math.ceil(beat-.5);b<beat+2.4*game.track.bpm/60;b++){const at=b*60/game.track.bpm-time,p0=this.point(0,at),p1=this.point(1,at);if(p0.y<105||p0.y>760)continue;this.line(p0.x-p0.width/2,p0.y,p1.x+p1.width/2,p1.y,b%4===0?'#b5d4ec39':'#b5d4ec16',b%4===0?2:1);}
      const visible=game.notes.filter(n=>n.status!=='done'&&n.end-time>-.25&&n.time-time<2.6).sort((a,b)=>b.time-a.time);
      for(const n of visible){const color=n.kind==='gate'?'#ffce79':COLORS[n.lane],head=n.status==='holding'?0:n.time-time;
        if(n.kind==='hold'){const bottom=this.point(n.lane,head),top=this.point(n.lane,n.end-time);c.fillStyle=n.status==='holding'?color+'bb':color+'65';c.beginPath();c.moveTo(top.x-top.width*.23,top.y);c.lineTo(top.x+top.width*.23,top.y);c.lineTo(bottom.x+bottom.width*.23,bottom.y);c.lineTo(bottom.x-bottom.width*.23,bottom.y);c.closePath();c.fill();this.bar(n.lane,n.end-time,color,true);this.text('放',top.x,top.y-16,11,'#f1f9ff');if(n.status==='holding'){const charge=Math.max(0,Math.min(1,(time-n.time)/(n.end-n.time)));this.text('CHARGE '+Math.round(charge*100)+'%',bottom.x,bottom.y+45,12,color);}}
        if(n.time-time>-.3||n.status==='holding')this.bar(n.lane,head,color);
        if(n.kind==='gate'&&n.lane===0){const a=this.point(0,n.time-time),b=this.point(1,n.time-time);this.line(a.x,a.y,b.x,b.y,'#ffce7988',2);this.text('◆',400,a.y+5,17,'#ffce79');}
      }
      for(let lane=0;lane<2;lane++){const p=this.point(lane,0),active=game.held[lane];const flare=this.glowLane[lane];c.shadowColor=COLORS[lane];c.shadowBlur=active?24:8+flare*20;c.fillStyle=active||flare>.3?COLORS[lane]+'70':'#142b40';c.strokeStyle=COLORS[lane];c.lineWidth=active?4:2;c.beginPath();c.roundRect(p.x-p.width*.58,HIT-20,p.width*1.16,40,10);c.fill();c.stroke();c.shadowBlur=0;this.line(p.x-p.width*.42,HIT,p.x+p.width*.42,HIT,'#f0f9ff',3);if(!reducedMotion){c.strokeStyle=COLORS[lane]+Math.round(pulse*65).toString(16).padStart(2,'0');c.lineWidth=2;c.beginPath();c.arc(p.x,HIT,30+(1-pulse)*32,0,Math.PI*2);c.stroke();}this.text(lane?'J / →':'F / ←',p.x,740,17,COLORS[lane]);}
      this.text('H I T   L I N E',400,697,9,'#819aae');
      this.fx?.draw(c,W,H);c.restore();
      if(game.last&&time-game.last.time<.65&&game.state==='running'){const labels={perfect:'PERFECT',good:'GREAT',ok:'GOOD',miss:'MISS',empty:'空拍'},color={perfect:'#a2fff0',good:'#a7caff',ok:'#ffd986',miss:'#ff769c',empty:'#9ab3c9'}[game.last.result];this.text(labels[game.last.result],400,370,30,color);if(Number.isFinite(game.last.delta)&&game.last.result!=='miss')this.text(Math.abs(game.last.delta)<.015?'JUST IN TIME':(game.last.delta<0?'EARLY ':'LATE ')+Math.round(Math.abs(game.last.delta)*1000)+' ms',400,398,11,'#adc2d7');}
      if(game.combo>=3){const bump=live?1+kick*.08:1;this.text(String(game.combo).padStart(3,'0'),400,466,Math.round(43*bump),this.heat>.6?'#ffe9a6':'#e7f5ff');this.text('C O M B O',400,489,9,'#8da6bd');}
      if(countdown>0&&game.state==='running'){this.text(String(Math.min(time<0?4:2,Math.ceil(countdown/(60/game.track.bpm)))),400,269,64,'#f0f9ff');this.text(time<0?'跟著拍點，準備出發':'按回長音軌道，準備接續',400,305,13,'#b7d6ea');}
      if(calibration){c.fillStyle='#091529e8';c.fillRect(70,140,660,450);const amount=((calibration.position%1)+1)%1,r=45+(1-amount)*25;c.strokeStyle='#63ecd7';c.lineWidth=4;c.beginPath();c.arc(400,315,r,0,Math.PI*2);c.stroke();this.text('跟著聲音點拍',400,208,27,'#e8f6ff');this.text(calibration.count+' / 12',400,324,24,'#a2fff0');this.text('先聽 3 拍，再按任一軌或空白鍵',400,435,15,'#a8c4da');this.text('不要追著光圈，專心聽每個節拍',400,468,13,'#91aac1');}
      const progress=Math.max(0,Math.min(1,time/game.chart.duration));c.fillStyle='#3a526055';c.fillRect(0,795,800,5);c.fillStyle=game.track.color;c.fillRect(0,795,800*progress,5);
      if(!reducedMotion)globalThis.CashArcadeFX?.crt(c,W,H,.05);
    }
  }
  globalThis.PulseRenderer={Renderer};
})();

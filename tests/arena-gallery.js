(() => {
    'use strict';
    const $=id=>document.getElementById(id);let theme='dark',reduced=false;const scenes=[];
    function reach(wave){const g=new NeonArena.Game(NeonArenaStorage.fresh(2026));while(g.wave<wave){g.complete();const preference=['damage','deathBlast','armor','shield','cooldown','reach','jumps','speed','trail','blastDamage','radius','charge'];g.chooseUpgrade(preference.find(id=>g.choices.includes(id)));}g.drain();return g;}
    function draw(){for(const {canvas,sector} of scenes){const kind=$('scene').value,g=reach(sector*4+(kind==='battle'?3:4)),r=new NeonArenaRenderer(canvas);r.reduced=reduced;g.player.x=340;g.player.y=490;g.player.shield=true;
        if(kind==='battle'){
            ['swarm','charger','shooter','guard','splitter','swarm','shard','charger'].forEach((type,i)=>{const angle=i*Math.PI/4;g.addEnemy(type,360+Math.cos(angle)*210,350+Math.sin(angle)*195);});
            g.enemies[1].windup=.6;g.enemies[1].dx=-.7;g.enemies[1].dy=.7;
            g.player.aimX=-.6;g.player.aimY=-.8;g.fire();g.warn('swarm');
            r.consume([{type:'arc',points:[{x:340,y:490},{x:211,y:212},{x:360,y:155},{x:508,y:212}]},{type:'explode',x:520,y:500,radius:125}]);
        }else if(kind==='debris'){
            g.boss.dead=true;g.enemies=[];r.consume([{type:'bossDown',x:360,y:280}]);
        }else {
            g.boss.x=360;g.boss.y=280;g.boss.hp*=kind==='overload'?.25:.67;g.boss.overload=kind==='overload';
            if(sector===0){g.boss.windup=.8;g.boss.dx=.45;g.boss.dy=.9;g.shoot(g.boss,Math.PI/2,9,.25,160);for(const b of g.bullets){b.x+=b.vx*.8;b.y+=b.vy*.8;}}
            else {g.beam(g.boss,Math.PI/4,sector===1);g.beam(g.boss,Math.PI*1.25,sector===1);g.warn('guard');if(kind==='overload')g.beams.forEach(b=>b.warning=0);}
            g.addEnemy('guard',180,180);g.addEnemy('shooter',560,350);
        }
        r.consume([{type:'ghost',x:285,y:515,angle:-1},{type:'ghost',x:310,y:502,angle:-1}]);r.update(kind==='debris'?.35:.1);r.draw(g,theme);
    }}
    for(let sector=0;sector<3;sector++){const card=document.createElement('section'),heading=document.createElement('h2'),canvas=document.createElement('canvas'),p=document.createElement('p');heading.textContent=NeonArenaData.sectors[sector];p.textContent=`${sector*4+1}–${sector*4+4} 波 · ${NeonArenaData.waves[sector*4+3].boss}`;canvas.width=canvas.height=720;canvas.setAttribute('aria-label',heading.textContent+'驗收畫面');card.append(heading,canvas,p);$('scenes').append(card);scenes.push({canvas,sector});}
    $('scene').addEventListener('change',draw);$('theme').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;draw();});$('motion').addEventListener('click',()=>{reduced=!reduced;$('motion').textContent=`減少動態：${reduced?'開':'關'}`;draw();});draw();
    function wav(buffer){const samples=buffer.getChannelData(0),data=new ArrayBuffer(44+samples.length*2),v=new DataView(data);const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
        str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);return new Blob([data],{type:'audio/wav'});}
    const urls=[];
    $('audio-check').addEventListener('click',async()=>{
        const button=$('audio-check');button.disabled=true;$('audio-result').textContent='量測中…';urls.splice(0).forEach(URL.revokeObjectURL);$('audio-previews').replaceChildren();
        try{
            const results=[];
            for(const [wave,phase,mixed] of [[1,0],[4,0],[5,0],[8,0],[9,0],[12,0],[4,'overload'],[8,'overload'],[12,'overload'],[12,'overload',true]]){
                const profile=NeonArenaScore.profile(wave,phase),seconds=128*60/profile.bpm/4+.8,ctx=new OfflineAudioContext(1,Math.ceil(seconds*22050),22050);let destination=ctx.destination;
                if(mixed){const Native=window.AudioContext;let s;
                    try{window.AudioContext=function(){return ctx;};s=CashArcadeAudio.create({storageKey:'casharcade-arena-qa-sfx',toggleButton:{setAttribute(){},addEventListener(){}},outputLevel:.6,musicMix:true});destination=s.musicOutput().destination;}
                    finally{window.AudioContext=Native;}
                    for(const name of ['arenaArc','arenaChain','arenaDash','arenaExplosion','arenaShield','arenaHurt','arenaUpgrade','arenaBoss','arenaBossDown'])s.play(name,.3);
                }
                const instrument=CashArcadeMusic.synth(ctx,destination);instrument.volume(1);for(let i=0;i<128;i++)instrument.step(profile,i,.05+i*60/profile.bpm/4,NeonArenaScore);
                const buffer=await ctx.startRendering(),samples=buffer.getChannelData(0);let peak=0,sum=0,finite=true;for(const sample of samples){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;finite&&=Number.isFinite(sample);}const rms=Math.sqrt(sum/samples.length),ok=finite&&peak<.99&&rms>.003;
                results.push(`${ok?'PASS':'FAIL'} ${profile.name}${phase?' / 過載':''}${mixed?' + 9 音效同時混音':''} | peak ${peak.toFixed(4)} | RMS ${rms.toFixed(4)}`);$('audio-result').textContent=results.join('\n');
                const card=document.createElement('div'),label=document.createElement('p'),audio=document.createElement('audio');label.textContent=results.at(-1);audio.controls=true;const url=URL.createObjectURL(wav(buffer));urls.push(url);audio.src=url;card.append(label,audio);$('audio-previews').append(card);
            }
        }catch(e){$('audio-result').textContent+=`\n無法量測：${e.message}`;}finally{button.disabled=false;}
    });
})();

(() => {
    'use strict';
    const $=id=>document.getElementById(id);
    let previewUrl;
    function choices() {
        $('sector').replaceChildren();
        const game=$('game').value;
        for(let level=1;level<=(game==='breakout'?30:1);level++) {
            const option=document.createElement('option'); option.value=String(level);
            option.textContent=`${level} · ${CashArcadeScores[game].profile(level).name}`; $('sector').append(option);
        }
    }
    $('game').addEventListener('change',choices); choices();
    function stats(buffer) {
        let sum=0,peak=0,clipped=0;
        const data=buffer.getChannelData(0);
        for(const sample of data) {sum+=sample*sample;peak=Math.max(peak,Math.abs(sample));if(Math.abs(sample)>=1)clipped++;}
        return {seconds:+buffer.duration.toFixed(2),rms:+Math.sqrt(sum/data.length).toFixed(4),peak:+peak.toFixed(4),clipped};
    }
    async function render(game,level=1,phase=0,mix=false) {
        const score=CashArcadeScores[game],p=score.profile(level,phase),step=60/p.bpm/4;
        const context=new OfflineAudioContext(1,Math.ceil((128*step+.5)*44100),44100);
        const Original=window.AudioContext;
        window.AudioContext=function() {return new Proxy(context,{get(target,key){
            if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
        }});};
        try {
            const sound=CashArcadeAudio.create({storageKey:'casharcade-music-qa-unused',toggleButton:document.createElement('button'),musicMix:true,outputLevel:game==='breakout'?.9:1});
            const output=sound.musicOutput(), instrument=CashArcadeMusic.synth(output.context,output.destination);
            instrument.volume(mix?1:.65);
            for(let i=0;i<128;i++)instrument.step(p,i,.03+i*step,score);
            if(mix) {
                const sounds=game==='breakout'?['breakoutStrong','breakoutHeavy','breakoutPower','breakoutExplosion','breakoutLightning','breakoutBossDown','brick','paddle']
                    :game==='snake'?['food','dessert','speed','bomb','win']:['flap','pass','speed','lose'];
                for(const name of sounds)sound.play(name,.2);
            }
        } finally {window.AudioContext=Original;}
        const buffer=await context.startRendering();return {buffer,result:{game,level,phase,bpm:p.bpm,mix,...stats(buffer)}};
    }
    function wav(buffer) {
        const samples=buffer.getChannelData(0),bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
        const text=(offset,value)=>[...value].forEach((ch,i)=>view.setUint8(offset+i,ch.charCodeAt(0)));
        text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
        view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*2,true);
        view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
        samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true));return new Blob([bytes],{type:'audio/wav'});
    }
    async function run(work) {
        $('measure').disabled=$('render').disabled=true;$('result').textContent='正在合成實際音訊…';
        try {await work();}catch(error){$('result').textContent=`FAIL: ${error.message}`;}
        finally {$('measure').disabled=$('render').disabled=false;}
    }
    $('render').addEventListener('click',()=>run(async()=>{
        const {buffer,result}=await render($('game').value,Number($('sector').value),Number($('phase').value));
        if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(wav(buffer));
        $('preview').src=previewUrl;$('download').href=previewUrl;$('download').hidden=false;$('result').textContent=JSON.stringify(result,null,2);
    }));
    $('measure').addEventListener('click',()=>run(async()=>{
        const results=[];
        for(let level=1;level<=30;level++){results.push((await render('breakout',level)).result);$('result').textContent=`完成 ${level}/30 關…`;}
        for(const level of [10,20,29,30])for(const phase of [1,2])results.push((await render('breakout',level,phase)).result);
        for(const game of ['snake','flappy'])for(let phase=0;phase<=3;phase++)results.push((await render(game,1,phase)).result);
        for(const game of ['breakout','snake','flappy'])results.push((await render(game,game==='breakout'?30:1,2,true)).result);
        const pass=results.every(r=>r.rms>.025&&r.peak<1&&r.clipped===0);
        $('result').textContent=`${pass?'PASS':'FAIL'} · ${results.length} 組實際輸出\n${JSON.stringify(results,null,2)}`;
    }));
})();

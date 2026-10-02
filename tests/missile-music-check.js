(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    let previewUrl;
    for (let level=1;level<=20;level++) {
        const option=document.createElement('option'); option.value=String(level);
        option.textContent=`${level} · ${NeonDefenseScore.profile(level).name}`; $('sector').append(option);
    }
    function stats(buffer) {
        let sum=0,peak=0,clipped=0;
        const data=buffer.getChannelData(0);
        for (const sample of data) { sum+=sample*sample; peak=Math.max(peak,Math.abs(sample)); if (Math.abs(sample)>=1) clipped++; }
        return { seconds:+buffer.duration.toFixed(2),rms:+Math.sqrt(sum/data.length).toFixed(4),peak:+peak.toFixed(4),clipped };
    }
    async function render(level,phase='shield',volume=.65,mix=false) {
        const p=NeonDefenseScore.profile(level,phase), step=60/p.bpm/4, duration=128*step+.5;
        const context=new OfflineAudioContext(1,Math.ceil(duration*44100),44100);
        const instrument=NeonDefenseMusic.synth(context); instrument.volume(volume,mix);
        for (let i=0;i<128;i++) instrument.step(p,i,.03+i*step);
        if (mix) {
            // Route unmodified production SFX into the same offline destination, no payment or game state.
            const Original=window.AudioContext;
            window.AudioContext=function() { return new Proxy(context,{get(target,key) {
                if (key==='state') return 'running';
                const value=Reflect.get(target,key,target); return typeof value==='function' ? value.bind(target) : value;
            }}); };
            try {
                const sound=CashArcadeAudio.create({storageKey:'casharcade-missile-music-qa-unused',toggleButton:document.createElement('button'),outputLevel:.8});
                for (const name of ['defenseLaunch','defenseBlast','defenseChain','defenseDamage','defenseAlarm','defenseBoss','defensePickup']) sound.play(name,.2);
            } finally { window.AudioContext=Original; }
        }
        const buffer=await context.startRendering(); return {buffer,result:{level,phase,bpm:p.bpm,volume,mix,...stats(buffer)}};
    }
    function wav(buffer) {
        const samples=buffer.getChannelData(0), bytes=new ArrayBuffer(44+samples.length*2), view=new DataView(bytes);
        const text=(offset,value)=>[...value].forEach((ch,i)=>view.setUint8(offset+i,ch.charCodeAt(0)));
        text(0,'RIFF'); view.setUint32(4,bytes.byteLength-8,true); text(8,'WAVE'); text(12,'fmt ');
        view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,buffer.sampleRate,true);
        view.setUint32(28,buffer.sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,samples.length*2,true);
        samples.forEach((sample,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,sample))*32767,true)); return new Blob([bytes],{type:'audio/wav'});
    }
    async function run(work) {
        $('measure').disabled=true; $('render').disabled=true; $('result').textContent='正在合成實際音訊…';
        try { await work(); } catch (error) { $('result').textContent=`FAIL: ${error.message}`; }
        finally { $('measure').disabled=false; $('render').disabled=false; }
    }
    $('render').addEventListener('click',()=>run(async()=> {
        const {buffer,result}=await render(Number($('sector').value),$('phase').value);
        if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl=URL.createObjectURL(wav(buffer));
        $('preview').src=previewUrl; $('download').href=previewUrl; $('download').hidden=false;
        $('result').textContent=JSON.stringify(result,null,2);
    }));
    $('measure').addEventListener('click',()=>run(async()=> {
        const results=[];
        for (let level=1;level<=20;level++) {
            results.push((await render(level)).result); $('result').textContent=`完成 ${level}/20 關…`;
        }
        for (const level of [10,20]) for (const phase of ['core','rage']) results.push((await render(level,phase)).result);
        results.push((await render(20,'rage',1,true)).result);
        const pass=results.every(r=>r.rms>.025&&r.peak<1&&r.clipped===0);
        $('result').textContent=`${pass?'PASS':'FAIL'} · 實際音訊 RMS / peak / clipping\n${JSON.stringify(results,null,2)}`;
    }));
})();

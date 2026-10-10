(() => {
    'use strict';
    // Original eight-bar chip arrangements. Offsets are semitones above each
    // theme's tonic, not samples or borrowed melodies. A/B phrases alternate.
    const themes = {
        drift: { title:'午夜脈衝', bpm:132, tonic:45, chords:[0,8,5,7], lead:[
            [12,7,10,12,15,12,7,10],[15,12,8,12,20,15,12,8],
            [17,12,8,5,8,12,17,15],[14,11,7,11,19,14,11,7],
            [12,15,19,15,12,10,7,10],[20,15,12,8,12,15,20,19],
            [17,15,12,8,5,8,12,17],[19,14,11,7,11,14,19,23]] },
        circuit: { title:'光點潛行', bpm:112, tonic:48, chords:[0,5,8,7], lead:[
            [12,null,7,10,12,null,3,7],[17,12,null,8,12,8,null,5],
            [20,null,15,12,8,12,null,15],[19,14,null,11,7,null,11,14],
            [15,12,null,7,10,12,19,null],[17,null,12,8,5,null,8,12],
            [20,15,12,null,8,12,15,null],[14,11,7,null,11,14,19,12]] },
        gravity: { title:'倒轉星航', bpm:124, tonic:50, chords:[0,8,3,10], lead:[
            [12,7,3,7,12,15,19,15],[20,15,12,8,12,15,20,24],
            [15,10,7,3,7,10,15,19],[22,17,14,10,14,17,22,17],
            [19,15,12,7,3,7,12,15],[24,20,15,12,8,12,15,20],
            [19,15,10,7,3,7,10,15],[17,14,10,14,17,22,14,12]] },
        reactor: { title:'反應爐疾速', bpm:140, tonic:43, chords:[0,0,5,7], lead:[
            [12,0,7,12,15,7,12,19],[12,7,3,0,7,12,10,7],
            [17,5,12,17,20,12,17,24],[19,7,14,19,23,14,19,26],
            [24,19,15,12,7,12,15,19],[22,19,15,12,10,7,3,7],
            [24,20,17,12,8,12,17,20],[26,23,19,14,11,14,19,12]] },
        prism: { title:'稜鏡回路', bpm:102, tonic:48, chords:[0,3,8,5], lead:[
            [12,null,15,19,15,null,12,7],[15,10,null,7,10,null,15,19],
            [20,null,15,12,8,null,12,15],[17,12,null,8,12,17,null,20],
            [19,15,12,null,7,12,null,15],[22,null,19,15,10,7,10,null],
            [24,20,null,15,12,8,null,12],[20,17,12,8,5,8,12,null]] }
    };
    function scoreFor(id) {
        const theme=themes[id];
        return Object.freeze({
            profile(level=1,phase=0) {
                const n=Number.isFinite(level)?Math.max(1,Math.floor(level)):1;
                const intensity=typeof phase==='number'?Math.max(0,Math.min(3,phase)):phase==='overload'?3:0;
                return {level:n,intensity,bpm:theme.bpm+Math.min(6,Math.floor((n-1)/4)*2),tonic:theme.tonic+(id==='drift'?(n-1)*2:0),label:theme.title+' · CHIP '+String(n).padStart(2,'0')};
            },
            notesForStep(p,index) {
                const step=((index%128)+128)%128,bar=Math.floor(step/16),beat=step%16,root=p.tonic+theme.chords[bar%4],events=[];
                const add=(voice,note,length,level=1)=>events.push({voice,note,length,level});
                if(beat%4===0)add('kick',0,1,.78);
                if(beat===4||beat===12)add('snare',0,1,.55);
                if(beat%2===0)add('hat',0,1,beat%4===2?.6:.32);
                if(beat%4===0||beat===10)add('bass',root+(beat===8?12:0),beat===10?1.3:2.8,.72);
                if(beat%2===0){const offset=theme.lead[bar][beat/2];if(offset!==null)add('lead',p.tonic+offset,1.65,.48);}
                if(beat%2===1)add('arp',root+12+[0,7,12,15][Math.floor(beat/2)%4],.7,.58);
                if(p.intensity>1&&beat%4===3)add('echo',root+24,.7,.38);
                return events;
            }
        });
    }
    globalThis.CashArcadeExpansionScores=Object.freeze(Object.fromEntries(Object.keys(themes).map(id=>[id,scoreFor(id)])));
})();

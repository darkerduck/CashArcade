(() => {
    'use strict';
    // Six original eight-bar pieces. Boss motifs are separate compositions, not transposed field loops.
    const themes=[
        {name:'銅線脈動',root:48,bpm:142,chords:[[0,3,7],[5,8,12],[8,12,15],[7,11,14]],melody:[[0,7,10,12,7,3],[5,12,8,15,12,8],[8,15,12,20,15,12],[7,11,14,19,14,11]]},
        {name:'鋸齒指令',root:43,bpm:158,chords:[[0,3,6],[1,5,8],[0,3,7],[7,10,14]],melody:[[12,6,3,0,6,12],[13,8,5,1,8,13],[15,12,7,3,7,12],[14,10,7,2,10,19]]},
        {name:'磁流回聲',root:50,bpm:148,chords:[[0,3,7],[10,14,17],[5,8,12],[7,10,14]],melody:[[7,12,15,10,7,12],[10,17,14,22,17,14],[12,8,5,15,12,8],[14,10,7,19,17,14]]},
        {name:'離子心跳',root:46,bpm:166,chords:[[0,3,7],[6,10,13],[1,5,8],[7,11,14]],melody:[[0,12,7,15,3,12],[6,18,13,22,10,18],[1,13,8,17,5,13],[7,19,14,23,11,19]]},
        {name:'封鎖線之外',root:45,bpm:154,chords:[[0,3,7],[8,12,15],[3,7,10],[7,11,14]],melody:[[12,7,3,10,15,12],[8,15,20,12,15,8],[15,10,7,19,15,10],[19,14,11,7,14,19]]},
        {name:'零時解鎖',root:42,bpm:174,chords:[[0,3,7],[1,5,8],[8,12,15],[7,11,14]],melody:[[0,3,12,7,15,19],[13,8,1,5,17,20],[8,20,15,12,24,20],[19,14,7,11,23,26]]},
    ];
    function profile(wave=1,phase=0){wave=Math.max(1,Math.min(12,Math.floor(wave)||1));const boss=wave%4===0,index=Math.floor((wave-1)/4)*2+(boss?1:0),t=themes[index],intensity=boss?(phase==='overload'?2:1):0;
        return {...t,level:wave,index,boss,intensity,bpm:t.bpm+(intensity===2?8:0),label:`${t.name}${intensity===2?' · 過載':''} · ${t.bpm+(intensity===2?8:0)} BPM`};}
    function notesForStep(p,index){const bar=Math.floor(index/16)%8,step=index%16,chord=p.chords[bar%4],melody=p.melody[bar%4],notes=[],at=p.boss?[0,2,5,8,10,14]:[0,3,6,8,11,14];
        const add=(voice,note,length,level)=>notes.push({voice,note,length,level});
        const m=at.indexOf(step);if(m>=0)add('lead',p.root+12+melody[m]+(bar>=4&&m===5?12:0),m===5?1.5:1.2,.72);
        if(step%2===0)add('bass',p.root-12+chord[step===14?2:0],1.5,.85);
        if(step%(p.intensity===2?1:2)===0)add('arp',p.root+12+chord[[0,2,1,2][step%4]],.65,p.boss?.42:.32);
        if(bar>=4&&step===12)add('echo',p.root+24+chord[1],2.5,.35);
        if([0,6,8].includes(step)||p.boss&&step===14||p.intensity===2&&step===3)add('kick',0,1,.85);
        if(step===4||step===12||p.intensity===2&&bar%2&&step===15)add('snare',0,1,.65);
        if(step%2===0)add('hat',0,1,.4);return notes;
    }
    globalThis.NeonArenaScore=Object.freeze({profile,notesForStep});
})();

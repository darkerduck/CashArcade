(() => {
    'use strict';
    // Original 4/4 melodies, written as [sixteenth onset, tonic-relative semitone,
    // duration]. These are composed phrases, not randomly generated notes.
    const MINOR = [[0,3,7],[8,12,15],[5,8,12],[7,11,14]];
    const THEMES = {
        prism: { name:'稜光彈跳', groove:'bounce', chords:MINOR, melody:[
            [[0,0,2],[3,7,1],[4,12,3],[8,10,2],[11,7,1],[12,3,3]],
            [[0,8,2],[3,12,1],[4,15,3],[8,12,2],[12,8,2],[14,7,2]],
            [[0,5,3],[4,8,2],[6,12,2],[8,17,3],[12,12,2],[14,8,2]],
            [[0,7,2],[3,11,1],[4,14,3],[8,11,3],[12,7,2],[14,11,2]],
        ] },
        orbit: { name:'旋光軌道', groove:'orbit', chords:[[0,3,7],[3,7,10],[8,12,15],[10,14,17]], melody:[
            [[0,7,3],[4,12,2],[6,15,2],[8,14,3],[12,12,3]],
            [[0,10,3],[4,7,3],[8,3,2],[10,7,2],[12,10,3]],
            [[0,8,2],[2,12,2],[4,15,3],[8,20,3],[12,15,3]],
            [[0,17,3],[4,14,2],[6,10,2],[8,14,3],[12,17,2],[14,14,2]],
        ] },
        foundry: { name:'鋼輪工廠', groove:'heavy', chords:[[0,3,7],[0,3,7],[5,8,12],[7,11,14]], melody:[
            [[0,0,4],[6,0,2],[8,7,4],[14,3,2]],
            [[0,12,4],[6,10,2],[8,7,3],[12,3,3]],
            [[0,5,4],[6,8,2],[8,12,4],[14,8,2]],
            [[0,11,3],[4,7,3],[8,2,3],[12,7,2],[14,11,2]],
        ] },
        magnet: { name:'磁極追逐', groove:'sync', chords:[[0,3,7],[1,5,8],[5,8,12],[7,11,14]], melody:[
            [[0,0,2],[3,7,2],[6,3,2],[9,12,2],[12,7,2],[15,3,1]],
            [[0,1,2],[3,8,2],[6,5,2],[9,13,2],[12,8,3]],
            [[0,12,2],[3,8,2],[6,5,2],[9,8,2],[12,17,3]],
            [[0,14,2],[3,11,2],[6,7,2],[9,2,2],[12,11,2],[15,14,1]],
        ] },
        rift: { name:'折躍迷宮', groove:'rift', chords:[[0,3,7],[5,8,12],[1,5,8],[7,11,14]], melody:[
            [[0,12,3],[5,7,2],[8,3,3],[13,0,2]],
            [[0,5,3],[5,12,2],[8,15,3],[13,8,2]],
            [[0,13,3],[5,8,2],[8,5,3],[13,1,2]],
            [[0,11,3],[5,14,2],[8,19,3],[13,14,2]],
        ] },
        inferno: { name:'熔火連鎖', groove:'drive', chords:MINOR, melody:[
            [[0,0,2],[2,3,2],[4,7,2],[6,12,2],[8,15,3],[12,12,3]],
            [[0,15,2],[2,12,2],[4,8,3],[8,12,2],[10,15,2],[12,20,3]],
            [[0,17,2],[2,12,2],[4,8,3],[8,5,2],[10,8,2],[12,12,3]],
            [[0,14,2],[2,11,2],[4,7,2],[6,11,2],[8,14,3],[12,19,3]],
        ] },
        storm: { name:'星雨狂潮', groove:'drive', chords:[[0,3,7],[3,7,10],[8,12,15],[7,11,14]], melody:[
            [[0,12,2],[2,7,1],[4,15,2],[7,14,1],[8,12,2],[10,10,2],[12,7,3]],
            [[0,10,2],[2,7,1],[4,3,2],[7,7,1],[8,10,3],[12,15,3]],
            [[0,20,2],[2,15,2],[4,12,2],[7,8,1],[8,12,3],[12,15,3]],
            [[0,19,3],[4,14,2],[6,11,2],[8,7,2],[10,11,2],[12,14,3]],
        ] },
        wing: { name:'鋼翼破陣', groove:'boss', chords:[[0,3,7],[1,5,8],[8,12,15],[7,11,14]], melody:[
            [[0,0,3],[4,7,2],[6,0,2],[8,12,3],[12,7,3]],
            [[0,1,3],[4,8,2],[6,5,2],[8,13,3],[12,8,3]],
            [[0,15,3],[4,12,3],[8,8,3],[12,3,3]],
            [[0,11,2],[2,14,2],[4,19,3],[8,14,3],[12,11,3]],
        ] },
        warden: { name:'極性審判', groove:'boss', chords:[[0,3,7],[5,8,12],[1,5,8],[7,11,14]], melody:[
            [[0,12,3],[4,0,2],[7,7,1],[8,3,3],[12,12,3]],
            [[0,17,3],[4,5,2],[7,12,1],[8,8,3],[12,17,3]],
            [[0,13,3],[4,1,2],[7,8,1],[8,5,3],[12,13,3]],
            [[0,14,3],[4,11,2],[7,7,1],[8,19,3],[12,11,3]],
        ] },
        nova: { name:'超新星終曲', groove:'boss', chords:MINOR, melody:[
            [[0,0,2],[3,12,1],[4,15,3],[8,14,2],[10,12,2],[12,7,3]],
            [[0,8,2],[3,20,1],[4,15,3],[8,12,2],[10,15,2],[12,20,3]],
            [[0,17,3],[4,12,2],[6,8,2],[8,5,2],[10,8,2],[12,12,3]],
            [[0,11,2],[2,14,2],[4,19,3],[8,23,3],[12,14,2],[14,11,2]],
        ] },
        circuit: { name:'翠光迴路', groove:'snake', chords:[[0,3,7],[5,9,12],[10,14,17],[0,3,7]], melody:[
            [[0,0,2],[3,3,1],[4,7,2],[7,9,1],[8,7,3],[12,3,2],[14,0,2]],
            [[0,5,2],[3,9,1],[4,12,3],[8,9,2],[11,7,1],[12,5,3]],
            [[0,10,3],[4,14,2],[6,17,2],[8,14,3],[12,10,3]],
            [[0,12,3],[4,7,2],[6,3,2],[8,0,4],[14,7,2]],
        ] },
        feather: { name:'逐光羽翼', groove:'flight', chords:[[0,4,7],[9,12,16],[5,9,12],[7,11,14]], melody:[
            [[0,7,3],[4,12,3],[8,16,3],[12,14,2],[14,12,2]],
            [[0,16,3],[4,12,2],[6,9,2],[8,12,3],[12,16,3]],
            [[0,17,4],[6,16,2],[8,12,3],[12,9,3]],
            [[0,14,3],[4,11,2],[6,7,2],[8,11,3],[12,14,3]],
        ] },
    };
    // Explicit assignment to all thirty authored stages, including three unique bosses.
    const STAGES = [
        ['prism',48,160],['prism',50,164],['orbit',48,168],['foundry',45,166],['orbit',50,170],
        ['inferno',45,178],['foundry',47,174],['magnet',50,176],['foundry',48,180],['wing',45,184],
        ['prism',51,178],['orbit',52,180],['rift',50,176],['foundry',50,182],['orbit',53,184],
        ['inferno',47,188],['inferno',48,190],['magnet',52,188],['foundry',51,192],['warden',47,192],
        ['storm',50,192],['foundry',52,194],['prism',53,186],['rift',52,190],['orbit',54,194],
        ['foundry',53,196],['rift',54,198],['magnet',54,200],['storm',52,204],['nova',48,200],
    ];
    const tier = value => value === 'core' ? 1 : value === 'rage' ? 2 : Math.max(0,Math.min(3,Math.trunc(Number(value)||0)));
    function profile(game, level=1, phase=0) {
        const index=game==='breakout' ? Math.max(0,Math.min(29,Math.trunc(Number(level)||1)-1)) : 0;
        const [id,root,bpm]=game==='breakout' ? STAGES[index] : game==='snake' ? ['circuit',45,152] : ['feather',48,156];
        const theme=THEMES[id], boss=theme.groove==='boss';
        const intensity=game==='breakout' ? ((boss || index===28) ? Math.min(2,tier(phase)) : 0) : tier(phase);
        const tempo=bpm+intensity*8;
        return {...theme,id,root,boss,intensity,level:index+1,bpm:tempo,game,
            density:Math.min(4,(game==='breakout'?1+Math.floor(index/10):1)+intensity),
            label:`${theme.name} · ${tempo} BPM${intensity ? ` · ${boss?['','核心交鋒','最終攻勢'][intensity]:`加速 ${intensity}`}` : ''}`};
    }
    function notesForStep(p,step) {
        const bar=Math.floor(step/16)%8, beat=step%16, answer=bar>=4;
        const chord=p.chords[bar%4], notes=[];
        const add=(voice,note,length,level=1)=>notes.push({voice,note,length,level});
        for(const [onset,note,length] of p.melody[bar%4]) if(onset===beat) {
            const response=answer && beat===12 ? chord[1]+12 : note;
            add('lead',p.root+12+response,length*.84,.88);
            if(p.intensity>=2 && beat%4===0) add('echo',p.root+response,length*.65,.32);
        }
        const heavy=p.groove==='heavy'||p.boss;
        const bass=heavy?[0,3,6,8,11,14]:p.groove==='snake'?[0,3,6,8,11,14]:[0,2,4,6,8,10,12,14];
        if(bass.includes(beat)) add('bass',p.root-12+chord[beat===14?2:0]+(beat===6||beat===10?12:0),heavy?1.3:1.65);
        if(p.density>=3&&(beat===7||beat===15)) add('bass',p.root-12+chord[0],.7,.65);
        const stride=p.density>=2?1:2, order=p.groove==='orbit'||p.groove==='flight'?[0,1,2,1,0,2,1,2]:[0,2,1,2];
        if(beat%stride===0) add('arp',p.root+12+chord[order[Math.floor(beat/stride)%order.length]],.65,answer?.85:.65);
        const kicks=heavy?[0,3,6,8,11,14]:p.groove==='sync'||p.groove==='rift'?[0,3,8,10]:[0,6,8,14];
        if(kicks.includes(beat)||(p.intensity>=2&&beat===4)) add('kick',0,1,p.game==='flappy'?.8:1);
        if(beat===4||beat===12||(bar===7&&beat>=14)) add('snare',0,1,beat>=14?.6:.85);
        if(beat%2===0||(p.density>=3&&beat%4===3)) add('hat',0,1,beat%4===0?.8:.45);
        return notes;
    }
    const score=game=>Object.freeze({profile:(level,phase)=>profile(game,level,phase),notesForStep});
    globalThis.CashArcadeScores=Object.freeze({breakout:score('breakout'),snake:score('snake'),flappy:score('flappy')});
})();

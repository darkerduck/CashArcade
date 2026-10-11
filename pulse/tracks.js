(() => {
  'use strict';
  // Original compositions: four hand-written phrases and harmonic forms per track.
  // Every chart is derived from the same sixteenth-note grid used by the music.
  const TRACKS = [
    {id:'afterglow',name:'餘光列車',subtitle:'AFTERGLOW EXPRESS',bpm:110,bars:32,key:57,color:'#52efd3',mood:'輕盈方波、切分旋律，沿著夜色找回拍點。',chords:[0,5,3,7],motifs:[[0,7,10,12,7,5,3,7],[0,3,7,10,14,12,10,7],[5,12,14,17,14,12,10,7],[7,10,12,19,17,14,10,7]],rhythm:[0,2,4,6,8,10,12,14]},
    {id:'glass',name:'玻璃海岸',subtitle:'GLASS COAST',bpm:126,bars:36,key:60,color:'#fa78cf',mood:'透明琶音與半拍回聲，長音穿越潮汐閘門。',chords:[0,8,5,7],motifs:[[0,3,7,12,10,7,3,7],[8,12,15,19,15,12,10,7],[5,8,12,17,15,12,8,10],[7,10,14,19,17,14,10,3]],rhythm:[0,3,4,6,8,11,12,14]},
    {id:'ion',name:'離子午夜',subtitle:'ION MIDNIGHT',bpm:144,bars:40,key:54,color:'#b792ff',mood:'疾速低音、反拍衝刺，雙軌閘門點亮午夜。',chords:[0,3,8,7],motifs:[[0,7,12,15,14,12,7,10],[3,10,15,19,17,15,10,7],[8,15,20,19,15,12,8,7],[7,14,19,22,19,17,14,10]],rhythm:[0,2,3,6,8,10,11,14]}
  ].map(t=>Object.freeze({...t,duration:t.bars*240/t.bpm}));
  const DIFFICULTIES=[{id:'easy',name:'巡航',description:'四分拍為主 · 寬鬆判定',perfect:.065,good:.125,miss:.185},{id:'normal',name:'脈衝',description:'切分拍與雙軌 · 標準判定',perfect:.045,good:.09,miss:.145}];
  function profile(index=0){const t=TRACKS[index]||TRACKS[0];return {...t,index};}
  function section(track,bar){const end=track.bars-4;return bar<4?'INTRO':bar>=end?'OUTRO':bar>=Math.floor(track.bars/2)&&bar<Math.floor(track.bars/2)+4?'BREAK':'PULSE';}
  function notesForStep(p,index){
    const step=((index%16)+16)%16,bar=Math.floor(index/16);if(index<0||bar>=p.bars)return [];
    const part=section(p,bar),phrase=p.motifs[bar%4],root=p.key+p.chords[bar%4],out=[];
    const add=(voice,note,length,level)=>out.push({voice,note,length,level});
    if(step%4===0&&(part!=='BREAK'||step===0))add('kick',36,1,part==='INTRO'?.65:.9);
    if(step===4||step===12)add('snare',36,1,part==='BREAK'?.35:.7);
    if(step%2===0&&bar>=2)add('hat',36,1,step%4===2?.6:.35);
    if(step%4===0)add('bass',root-12+(step===12?7:0),3.3,.65);
    const noteIndex=p.rhythm.indexOf(step);
    if(noteIndex>=0&&(part!=='INTRO'||step%4===0)&&(part!=='BREAK'||noteIndex%2===0))add('lead',p.key+12+phrase[noteIndex],step===14?1.6:1.3,part==='OUTRO'?.45:.7);
    if(bar>=4&&step%2===1){const chord=[0,3,7,12];add('arp',root+12+chord[(Math.floor(step/2)+bar)%4],.65,part==='BREAK'?.7:.4);}
    if(p.index===1&&step===7)add('echo',p.key+24+phrase[1],2,.4);
    if(p.index===2&&step===15&&part==='PULSE')add('echo',root+19,.8,.45);
    return out;
  }
  function chart(trackIndex=0,difficulty='normal'){
    const track=TRACKS[trackIndex]||TRACKS[0],easy=difficulty==='easy',beat=60/track.bpm,notes=[],busy=[-1,-1];
    function add(bar,step,lane,kind='tap',length=0,gate=null){const at=bar*4+step/4,end=at+length;if(at<busy[lane]+.48)return;busy[lane]=end;notes.push({id:notes.length,lane,kind,time:at*beat,end:end*beat,beat:at,gate});}
    for(let bar=1;bar<track.bars-1;bar++){
      const part=section(track,bar),charge=bar%4===2,gate=bar%8===7,baseLane=(bar+trackIndex)%2;
      // Beat gates are intentionally reserved: both rails must be tapped together.
      if(gate){add(bar,0,0,'gate',0,bar);add(bar,0,1,'gate',0,bar);add(bar,8,baseLane);if(!easy)add(bar,12,1-baseLane);continue;}
      if(charge){add(bar,0,baseLane,'hold',easy?2:2.5);add(bar,easy?4:6,1-baseLane);add(bar,easy?12:14,baseLane);continue;}
      const steps=part==='BREAK'?[0,8]:part==='INTRO'||easy?[0,4,8,12]:track.rhythm.filter((_,i)=>i%2===0||(bar%4===3&&i%2===1));
      steps.forEach((step,i)=>add(bar,step,(i+baseLane)%2));
    }
    notes.sort((a,b)=>a.time-b.time||a.lane-b.lane);notes.forEach((n,i)=>n.id=i);
    return {trackIndex,difficulty:easy?'easy':'normal',track,notes,duration:track.duration,totalUnits:notes.reduce((s,n)=>s+(n.kind==='hold'?2:1),0)};
  }
  const api={TRACKS,DIFFICULTIES,profile,section,notesForStep,chart};globalThis.PulseTracks=api;if(typeof module!=='undefined')module.exports=api;
})();

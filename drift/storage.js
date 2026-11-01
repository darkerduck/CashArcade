(() => {
    'use strict';
    const KEY = 'casharcade-drift-v1';
    const fresh = () => ({version:1,track:0,unlocked:0,sound:true,music:true,volume:.5,reducedMotion:false,records:[0,1,2].map(()=>({score:0,lap:null,combo:0}))});
    function clean(raw) {
        const data=fresh();
        if (!raw || raw.version!==1) return data;
        if (Number.isInteger(raw.unlocked)&&raw.unlocked>=0&&raw.unlocked<3) data.unlocked=raw.unlocked;
        if (Number.isInteger(raw.track)&&raw.track>=0&&raw.track<=data.unlocked) data.track=raw.track;
        for(const key of ['sound','music','reducedMotion']) if(typeof raw[key]==='boolean') data[key]=raw[key];
        if(Number.isFinite(raw.volume)) data.volume=Math.min(1,Math.max(0,raw.volume));
        if(Array.isArray(raw.records)) data.records=data.records.map((record,i)=>{
            const r=raw.records[i]||{};
            return {score:Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=1e9?r.score:0,
                lap:Number.isFinite(r.lap)&&r.lap>0&&r.lap<=90?r.lap:null,
                combo:Number.isInteger(r.combo)&&r.combo>=0&&r.combo<=8?r.combo:0};
        });
        return data;
    }
    function unlock(data, game) {
        if (game.state === 'finished' && game.won === true && game.health > 0 && game.rank === 1 && game.laps > 0
            && Number.isInteger(game.trackIndex) && game.trackIndex >= 0 && game.trackIndex <= data.unlocked) {
            data.unlocked = Math.max(data.unlocked, Math.min(2, game.trackIndex + 1));
            return true;
        }
        return false;
    }
    function create(storage) {
        let available=true;
        if(arguments.length===0) { try{storage=globalThis.localStorage;}catch{available=false;} }
        return {load(){try{return clean(JSON.parse(storage.getItem(KEY)));}catch{available=false;return fresh();}},
            save(data){try{const value=JSON.stringify(clean(data));storage.setItem(KEY,value);available=storage.getItem(KEY)===value;return available;}catch{available=false;return false;}},
            get available(){return available;}};
    }
    globalThis.NeonDriftStorage={KEY,fresh,clean,create,unlock};
})();

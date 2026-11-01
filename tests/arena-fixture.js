(() => {
    'use strict';
    // Loaded only by the test page's srcdoc, before the unmodified production controller.
    const {fresh,copy}=NeonArenaStorage,wave=Number(document.body.dataset.testWave)||1,g=new NeonArena.Game(fresh(2026));
    while(g.wave<wave){g.complete();g.chooseUpgrade(['damage','deathBlast','armor','shield','cooldown','reach','jumps','speed','trail','blastDamage','radius','charge'].find(id=>g.choices.includes(id)));}
    if(document.body.dataset.testUpgrade==='true')g.complete();
    let checkpoint=g.checkpoint(),best=0;
    globalThis.NeonArenaStorage=Object.freeze({...NeonArenaStorage,create:()=>({load:()=>copy(checkpoint),save:c=>{checkpoint=copy(c);return true;},clear:()=>{checkpoint=null;return true;},best:()=>best,saveBest:n=>{best=n;return true;}})});
})();

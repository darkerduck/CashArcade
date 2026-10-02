(() => {
    'use strict';
    const W = 720, H = 540;
    const HP = { normal: 2, fragile: 1, armor: 4, heavy: 6, explosive: 2, hatch: 2, emitter: 4, repel: 4, directional: 4, steel: -1, moving: 2, switch: 2 };
    const POWERS = Object.freeze({
        big: { name: '巨球', icon: '●', duration: 12 }, small: { name: '微球', icon: '•', duration: 8, bad: true },
        multi: { name: '三重分裂', icon: '✣' }, rain: { name: '能量球雨', icon: '☄', duration: 8 },
        wide: { name: '加長擋板', icon: '↔', duration: 12 }, narrow: { name: '縮短擋板', icon: '↤', duration: 8, bad: true },
        full: { name: '全幅擋板', icon: '━', duration: 5 }, fire: { name: '火球', icon: '♨', duration: 10 },
        pierce: { name: '穿透球', icon: '⇡', duration: 8 }, laser: { name: '雷射擋板', icon: 'Ⅱ', duration: 10 },
        lightning: { name: '連鎖閃電', icon: 'ϟ', duration: 8 }, slow: { name: '緩速', icon: '◷', duration: 10 },
        magnet: { name: '道具磁鐵', icon: '∩', duration: 12 }, antigravity: { name: '反重力', icon: '↑', duration: 6 },
        shield: { name: '底部護盾', icon: '◇' }, life: { name: '額外生命', icon: '♥' },
    });
    const TITLES = ['光波起點', '星鑽礦床', '雲端階梯', '蜂巢孵化場', '沙漏花園', '火線骨牌', '雙塔造球廠', '磁極花冠', '交錯列車', '鋼翼核心', '倒懸皇冠', '引力河道', '折躍迴廊', '鎖鏈城門', '旋光風車', '熔光蜂巢', '雷射長廊', '磁暴階梯', '繁星工廠', '磁極守衛', '流星雨幕', '巨人壁壘', '微光針路', '穿透晶宮', '倒轉天幕', '交錯城牆', '折躍鎖陣', '雙面裝甲', '霓虹狂潮', '超新星核心'];
    const TIPS = [
        '三道光波由外向內散開。沿球落點移動擋板，接取中央的加長道具。',
        '先打開星鑽外殼，再接取巨球；微球、普通球、巨球傷害分別為 1、2、4。',
        '按住左鍵或 Space 壓板，球接近時放開；回彈瞬間接到球會得到強擊。',
        '六座蜂巢藏著活動球，打開後向下落出；接住它們展開多線攻擊。',
        '沙漏斜面把球導向中央。加長是綠色，縮短是紅色，可選擇避開負面道具。',
        '四條火線各有引爆端，沿著相連節點引發四次骨牌連鎖；鏈條之間不互相引爆。',
        '第一次擊中造球器會啟動它；每座最多造六球，擊破就會停止。',
        '磁極花瓣推開普通球。蓄力回彈得到帶金色光環的強擊球，才能穿過斥力盾。',
        '三列車廂反向移動。觀察空隙會合的時機，讓球穿越不同車列。',
        '先破壞左右裝甲翼，再打核心；只剩一翼時，另一翼會加速擺動。',
        '皇冠只有上方弱點受傷。沿兩側空路把球送到皇冠上方，再由上向下撞擊。',
        '河道三段力場分別向左、向上、向右。順著箭頭借力，球會沿 S 形路線前進。',
        '同色傳送門相連，出口箭頭決定出球方向。四個房間各保留一個普通入口。',
        '依連線找到門鎖，先破壞低處開關，再逐層打開城門；每次開門只影響對應防線。',
        '四座風車把球送往不同象限。觀察葉片角度，再決定接球後的切入方向。',
        '接取火球，讓濺射與蜂巢爆炸節點相互引爆，開出大片空間。',
        '雷射沿擋板兩側自動射擊。鋼牆會遮住射線，球仍可從側路繞過。',
        '先蓄力穿過磁盾，再抓住移動平台的空隙；連續瞄準同一點不一定有效。',
        '四座工廠與三重分裂一起展開球群。球量最多 24 顆，造球器不會無限產球。',
        '三個磁極繞核心運轉，逐個用強擊破盾；磁極越少，剩餘節點的軌道越大。',
        '能量球雨每 0.4 秒補一球，持續八秒。五條斜帶把球分流成流星雨。',
        '巨球和全幅擋板協助粉碎重甲。寬闊內室能容納大量重球與碎片。',
        '微球可走細小捷徑，普通球仍有外側長路。尺寸恢復時也不會封死出口。',
        '接取穿透球，再選好斜角切進多層水晶；鋼製骨架仍會反彈球。',
        '反重力把球帶到上方磚幕，六秒後恢復向下。兩側傳送門連接上下路線。',
        '四道門採不同節拍開合。利用多球同時尋找不同房間的入口。',
        '中央四個開關對應四個角落。打開門，再沿同色傳送門進入房間。',
        '左右堡壘都可先攻。強擊打開外盾後，繞到上方弱點拆除裝甲。',
        '三幕依序是花瓣、螺旋、放射；各自帶來多球、火球與閃電的不同高潮。',
        '三階段超新星：鋼翼、磁盾、折躍。每段先擊破兩個節點，核心才會受傷。',
    ];
    const PALETTES = [
        ['#59fff0','#76a7ff','#ffe894'], ['#8fffea','#d790ff','#ffd46f'], ['#c6e8ff','#878fff','#fff6b5'], ['#5affbe','#fb81df','#ffcf62'], ['#ffd073','#e79eff','#64eadd'],
        ['#ff865c','#ff49af','#ffdb80'], ['#57e8df','#b08aff','#ffe67a'], ['#c39cff','#ff8eda','#84ffed'], ['#62e5ff','#ff977c','#fff5a5'], ['#72dfff','#cf9cff','#ffe883'],
        ['#ffd585','#bba4ff','#ff7ca9'], ['#56e5c5','#81b5ff','#fdeda0'], ['#c697ff','#6ceaff','#ff91ce'], ['#7dffb8','#6ca2ff','#ffe88a'], ['#8bdfff','#e595ff','#ffffaa'],
        ['#ff9369','#f674ca','#ffe3a0'], ['#55f4e5','#ff91ed','#abbbff'], ['#d79aff','#7ef1ff','#ffc184'], ['#6effbd','#cab0ff','#fff077'], ['#e9a4ff','#59eee7','#ffd874'],
        ['#a8dfff','#ee9aff','#fff0a7'], ['#ffd278','#f4a6e8','#8fe9ff'], ['#8defff','#dfe7ff','#ff9cdb'], ['#e0adff','#7beaff','#ffda94'], ['#7bffd7','#ba9dff','#ffacdc'],
        ['#81dcff','#ffd68b','#cf9bff'], ['#ec9aff','#91ffe1','#b1c8ff'], ['#ffe197','#bf9aff','#84f5e5'], ['#82ffe3','#ff88d9','#ffe87d'], ['#fff0a7','#ed85ff','#6cf1ff'],
    ];
    const PATTERNS = ['ripples','crystal','clouds','honey','sand','fuse','factory','magnetic','tracks','wings','crown','river','portals','locks','windmill','lava','laser','storm','forge','orbit','meteor','citadel','needles','prism','invert','gates','maze','shield','spiral','nova'];
    function createLevel(index, wave = 0) {
        if (!Number.isInteger(index) || index < 0 || index >= 30) throw new RangeError('Unknown stage');
        const c = { index, name: TITLES[index], tip: TIPS[index], palette: PALETTES[index], pattern: PATTERNS[index], bricks: [], zones: [], portals: [], rotors: [], gates: [], boss: null, powerPool: ['wide','multi','slow','shield','life'], wave, waves: 1 };
        let serial = 0;
        const b = (x,y,type='normal',extra={}) => {
            const item = { id: ++serial, x, y, bx:x, by:y, w:46, h:20, type, hp:HP[type], maxHp:HP[type], row:Math.round(y/24), active:false, emitted:0, nextEmission:0, ...extra };
            c.bricks.push(item); return item;
        };
        const line = (x,y,n,type='normal',dx=54,dy=0,extra={}) => { for(let i=0;i<n;i++) b(x+i*dx,y+i*dy,type,{...extra}); };
        const arc = (cx,cy,rx,ry,n,type='normal',start=Math.PI,end=Math.PI*2) => {
            const closed=Math.abs(end-start-Math.PI*2)<.001;
            for(let i=0;i<n;i++){const a=start+(end-start)*i/Math.max(1,closed?n:n-1);b(cx+Math.cos(a)*rx-18,cy+Math.sin(a)*ry-8,type,{w:36,h:16});}
        };
        const grid = (x,y,rows,cols,type='normal',dx=54,dy=29) => {for(let r=0;r<rows;r++) line(x,y+r*dy,cols,type,dx);};
        const gate = (id,x,y,w,h,motion=null) => c.gates.push({id,x,y,bx:x,by:y,w,h,open:false,motion});
        const port = (id,x,y,tx,ty,angle,color=0) => c.portals.push({id,x,y,tx,ty,angle,color,r:18});
        const pair = (ax,ay,bx,by,aAngle,bAngle,color=0) => {port(c.portals.length+1,ax,ay,bx,by,bAngle,color);port(c.portals.length+1,bx,by,ax,ay,aAngle,color);};
        const zone = (x,y,w,h,ax,ay) => c.zones.push({x,y,w,h,ax,ay});
        const guarantee = (name,which=0) => {
            const candidates = c.bricks.filter(x=>x.hp>0&&!x.bossRole&&!x.power).sort((a,d)=>d.y-a.y||Math.abs(a.x-337)-Math.abs(d.x-337));
            if(candidates.length) candidates[Math.min(which,candidates.length-1)].power=name;
        };
        const room = (x,y,w,h,id) => {
            b(x,y,'steel',{w,h:10});b(x,y+10,'steel',{w:10,h:h-10});b(x+w-10,y+10,'steel',{w:10,h:h-10});
            if(id) gate(id,x+10,y+h,w-20,9);
        };
        const motion = (axis,amp,speed,phase=0) => ({axis,amp,speed,phase});
        switch(index+1) {
        case 1:
            for(let r=0;r<3;r++) arc(360,235,230-r*45,140-r*32,13-r*2,'fragile');
            b(337,275,'fragile',{power:'wide'});break;
        case 2:
            for(let r=-3;r<=3;r++)for(let q=-3;q<=3;q++)if(Math.abs(r)+Math.abs(q)<=3)b(337+q*54,196+r*30,Math.abs(r)+Math.abs(q)===3?'armor':'fragile');
            guarantee('big');c.powerPool=['big','small','wide','shield'];break;
        case 3:
            for(let k=0;k<6;k++)line(k%2?400:74,310-k*43,4,k>3?'armor':'normal');
            guarantee('shield');c.powerPool=['wide','slow','life'];break;
        case 4:
            for(let k=0;k<6;k++){const a=k*Math.PI/3;const x=337+Math.cos(a)*196,y=204+Math.sin(a)*108; b(x,y,'hatch');b(x-27,y-27,'fragile');b(x+27,y-27,'fragile');}
            grid(284,174,2,3,'normal');guarantee('multi');break;
        case 5:
            for(let r=0;r<7;r++){const n=[6,5,3,2,3,5,6][r];for(let i=-n;i<=n;i++)if(i!==0)b(337+i*48,84+r*30,r%2?'fragile':'normal',{w:40});}
            b(145,328,'normal',{power:'wide'});b(529,328,'normal',{power:'narrow'});c.powerPool=['wide','narrow','multi','magnet'];break;
        case 6:
            for(let k=0;k<4;k++)for(let r=0;r<7;r++)b(58+k*162+Math.sin(r*1.3)*20,78+r*32,'explosive',{w:40});
            guarantee('fire');c.powerPool=['fire','multi','wide','shield'];break;
        case 7:
            grid(90,95,6,3,'normal');grid(470,95,6,3,'normal');line(337,110,6,'fragile',0,29);
            b(144,300,'emitter');b(524,300,'emitter');guarantee('magnet');c.powerPool=['multi','magnet','wide','slow'];break;
        case 8:
            for(let k=0;k<4;k++){const a=k*Math.PI/2;b(337+Math.cos(a)*148,204+Math.sin(a)*105,'repel');}
            arc(360,215,88,58,9,'fragile',0,Math.PI*2);b(337,204,'heavy');guarantee('wide');break;
        case 9:
            for(let r=0;r<3;r++)for(let k=0;k<7;k++)b(92+k*72,105+r*70,'moving',{motion:motion('x',35,.65+r*.13,r*Math.PI),w:54});
            guarantee('slow');c.powerPool=['slow','multi','wide','rain'];break;
        case 10:
            c.boss={kind:'wings',phase:0,phases:1};b(289,140,'heavy',{w:142,h:62,hp:24,maxHp:24,bossRole:'core'});
            for(let k=0;k<2;k++)b(160+k*350,236,'armor',{w:70,h:32,hp:12,maxHp:12,bossRole:'node',motion:motion('x',64,1,k*Math.PI)});
            arc(360,200,266,130,11,'normal');guarantee('big');c.powerPool=['big','multi','fire','wide','shield'];break;
        case 11:
            for(let r=0;r<3;r++)line(147+r*54,146+r*38,8-r*2,'directional');
            for(let k=0;k<5;k++)b(174+k*72,105-(k%2)*28,'armor');guarantee('antigravity');c.powerPool=['antigravity','multi','shield'];break;
        case 12:
            for(let r=0;r<9;r++){const cx=360+Math.sin(r*.65)*155;b(cx-120,80+r*29,'normal');b(cx+70,80+r*29,'fragile');}
            zone(125,75,210,92,-260,0);zone(278,175,200,84,0,-520);zone(360,267,215,95,280,0);guarantee('slow');c.powerPool=['slow','magnet','wide','multi'];break;
        case 13:
            for(let r=0;r<2;r++)for(let q=0;q<2;q++){const x=65+q*370,y=75+r*170;room(x,y,210,105);grid(x+27,y+25,2,3,'fragile');}
            pair(170,192,540,362,-Math.PI/2,-Math.PI/2,0);pair(170,362,540,192,-Math.PI/2,-Math.PI/2,1);guarantee('multi');c.powerPool=['multi','pierce','slow','magnet'];break;
        case 14:
            for(let r=0;r<3;r++){const y=142+r*90;b(0,y,'steel',{w:272,h:10});b(448,y,'steel',{w:272,h:10});gate(`lock${r}`,272,y,176,10);line(148,y-47,8,r===0?'heavy':'armor',54);b(337,370-r*90,'switch',{opens:`lock${2-r}`});}
            guarantee('big');c.powerPool=['big','multi','wide','shield'];break;
        case 15:
            arc(360,218,262,150,22,'normal',0,Math.PI*2);
            for(let k=0;k<4;k++){const a=k*Math.PI/2+.7;c.rotors.push({x:360+Math.cos(a)*132,y:218+Math.sin(a)*85,r:25,phase:a,speed:(k%2?1:-1)*1.4});}
            guarantee('multi');c.powerPool=['multi','rain','wide','shield'];break;
        case 16:
            for(let r=0;r<7;r++)for(let q=0;q<9;q++)if(Math.abs(q-4)+Math.abs(r-3)<7)b(104+q*55+(r%2)*25,76+r*34,(r+q)%5===0?'explosive':'fragile',{w:43,hex:true});
            guarantee('fire');c.powerPool=['fire','lightning','multi','magnet'];break;
        case 17:
            for(let k=0;k<6;k++){grid(55+k*103,78,6,1,k%2?'armor':'normal');if(k%2===0)b(52+k*103,277,'steel',{w:54,h:12});}
            b(337,330,'fragile',{power:'laser'});c.powerPool=['laser','wide','magnet','shield'];break;
        case 18:
            for(let k=0;k<4;k++){b(116+k*144,103+k*28,'repel');line(76+k*138,272-k*35,2,'moving',52,0,{motion:motion('x',38,1.1,k*Math.PI/2)});}
            line(177,66,7,'heavy');guarantee('slow');c.powerPool=['slow','wide','multi','shield'];break;
        case 19:
            for(let k=0;k<4;k++){const x=55+k*166;b(x+24,315,'emitter');grid(x,95,6,2,'fragile');}
            guarantee('multi');c.powerPool=['multi','rain','lightning','magnet'];break;
        case 20:
            c.boss={kind:'magnet',phase:0,phases:1};b(302,178,'heavy',{w:116,h:56,hp:36,maxHp:36,bossRole:'core'});
            for(let k=0;k<3;k++)b(337,180,'repel',{w:54,h:26,hp:8,maxHp:8,bossRole:'node',motion:{axis:'orbit',amp:164,speed:.65,phase:k*Math.PI*2/3}});
            line(145,355,8,'fragile');guarantee('wide');c.powerPool=['big','multi','wide','shield','life'];break;
        case 21:
            for(let k=0;k<5;k++)line(49+k*132,105,6,'normal',13,36,{w:40});
            guarantee('rain');c.powerPool=['rain','multi','lightning','magnet'];break;
        case 22:
            grid(74,83,2,11,'heavy');for(let r=0;r<5;r++){b(74,145+r*29,'heavy');b(614,145+r*29,'heavy');}
            b(272,205,'heavy',{w:176,h:54,hp:18,maxHp:18});line(177,330,7,'armor');guarantee('big');guarantee('full',2);c.powerPool=['big','full','fire','shield'];break;
        case 23:
            for(let k=0;k<4;k++){const x=62+k*160;room(x,90+(k%2)*66,118,94);for(let r=0;r<2;r++)for(let q=0;q<2;q++)b(x+22+q*42,120+(k%2)*66+r*25,'fragile',{w:32});b(x+41,202+(k%2)*66,'steel',{w:17,h:100});b(x+72,202+(k%2)*66,'steel',{w:17,h:100});}
            b(337,365,'fragile',{power:'small'});c.powerPool=['small','wide','shield','slow'];break;
        case 24:
            for(let k=0;k<4;k++){b(90+k*162,81,'steel',{w:10,h:238});grid(107+k*162,94,7,2,'normal',54,30);}
            line(156,354,7,'fragile');guarantee('pierce');c.powerPool=['pierce','multi','laser','wide'];break;
        case 25:
            for(let r=0;r<3;r++){line(128,81+r*27,9,'normal');line(128,280+r*27,9,'directional');}
            pair(52,142,665,350,-Math.PI/2,-Math.PI*.7);pair(53,348,665,142,-Math.PI/2,Math.PI*.7,1);guarantee('antigravity');c.powerPool=['antigravity','multi','slow','shield'];break;
        case 26:
            for(let k=0;k<4;k++){room(55+k*166,79+(k%2)*50,126,145);for(let r=0;r<3;r++)for(let q=0;q<2;q++)b(75+k*166+q*44,108+(k%2)*50+r*30,'armor',{w:38});gate(`train${k}`,40+k*166,240+(k%2)*50,104,10,motion('x',38,.75+k*.18,k*.8));}
            line(148,365,8,'fragile');guarantee('multi');c.powerPool=['multi','rain','slow','wide'];break;
        case 27:
            for(let k=0;k<4;k++){const x=k%2?466:58,y=k<2?66:230;room(x,y,196,99,`room${k}`);grid(x+24,y+24,2,3,'normal');b(276+(k%2)*113,205+Math.floor(k/2)*90,'switch',{opens:`room${k}`});}
            for(let k=0;k<4;k++){pair(299+(k%2)*113,k<2?165:365,k%2?564:156,k<2?183:347,-Math.PI/2,-Math.PI/2,k%2);for(const p of c.portals.slice(-2))p.requires=`room${k}`;}
            c.powerPool=['multi','magnet','shield','pierce'];break;
        case 28:
            for(let k=0;k<2;k++){const x=115+k*365;grid(x,145,3,3,'directional');b(x+54,265,'repel');b(x-54,209,'repel');b(x+162,209,'repel');}
            line(210,71,6,'normal');guarantee('antigravity');c.powerPool=['big','antigravity','multi','wide'];break;
        case 29:
            c.waves=3;c.pattern=['honey','spiral','nova'][wave];
            if(wave===0){for(let k=0;k<6;k++){const a=k*Math.PI/3;arc(360+Math.cos(a)*169,218+Math.sin(a)*112,42,26,6,'fragile',0,Math.PI*2);} guarantee('multi');}
            if(wave===1){for(let k=0;k<42;k++){const a=k*.42,r=22+k*4.8;b(337+Math.cos(a)*r,204+Math.sin(a)*r*.64,k%6===0?'explosive':'fragile',{w:34,h:16});} guarantee('fire');}
            if(wave===2){for(let k=0;k<8;k++){const a=k*Math.PI/4;for(let r=1;r<5;r++)b(337+Math.cos(a)*r*58,206+Math.sin(a)*r*34,r%2?'normal':'armor',{w:38,h:18});}guarantee('lightning');}
            c.powerPool=['multi','fire','lightning','rain','big','full','magnet'];break;
        case 30:
            c.boss={kind:'nova',phase:0,phases:3};b(292,171,'heavy',{w:136,h:62,hp:60,maxHp:60,bossRole:'core'});
            for(let k=0;k<2;k++)b(160+k*345,253,'armor',{w:64,h:30,hp:8,maxHp:8,bossRole:'node',motion:motion('x',64,.85,k*Math.PI)});
            arc(360,210,285,151,17,'armor');guarantee('multi');c.powerPool=['big','multi','fire','rain','wide','shield','life'];break;
        }
        // Fixed rewards are built into the authored layouts; random drops never create layouts.
        if(index>4&&!c.bricks.some(x=>x.power)) guarantee(c.powerPool[0]);
        return c;
    }
    const api={ W,H,HP,POWERS,TITLES,TIPS,createLevel,TOTAL_LEVELS:30 };
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    if(typeof window!=='undefined')window.NeonBreakout=api;
})();

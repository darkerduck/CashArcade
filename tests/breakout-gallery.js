(() => {
    'use strict';
    const {Game,Renderer,W,H}=NeonBreakout, gallery=document.querySelector('#gallery');
    let light=false; const scenes=[];
    const labels=['加長擋板已接取','巨球破開外殼','滿蓄力強擊','蜂巢釋放活動球','縮短／加長分區','單條骨牌爆破鏈','生產塔啟動','強擊突破磁瓣','車廂反向移動','一側鋼翼擊破','從上方打開弱點','三段方向重力流','同色折躍出口','第一道城門展開','風車旋轉反彈','火球蜂巢連鎖','雷射沿巷道射擊','穿盾後移動階梯','造球與三重分裂','一節點擊破改變軌道','大量球雨分流','巨球與全幅擋板','微球穿越針路','穿透水晶路線','反重力階段','四道閘門不同節拍','中央開關打開角房','磁盾破口與上方弱點','第二幕螺旋展開','核心第二階段磁盾'];
    function activate(g) {
        g.launch();g.drainEvents();const hit=(b,d=4,opt={})=>g.hitBrick(b,d,{ny:-1,strong:true,...opt});
        const type=name=>g.bricks.find(b=>b.type===name), reward=name=>g.bricks.find(b=>b.power===name);
        g.time=2.4;g.animateMechanisms();const ball=g.balls[0];ball.x=360;ball.y=395;ball.vy=-530;
        switch(g.levelIndex+1){
        case 1:hit(reward('wide'));g.collect('wide');break;
        case 2:hit(type('armor'));g.collect('big');hit(g.bricks[12]);break;
        case 3:g.beginCharge();g.time+=.45;g.releaseCharge();g.bouncePaddle(ball);break;
        case 4:for(const b of g.bricks.filter(b=>b.type==='hatch').slice(0,3))hit(b);break;
        case 5:hit(reward('wide'));g.collect('wide');break;
        case 6:hit(g.bricks[6]);break;
        case 7:for(const b of g.bricks.filter(b=>b.type==='emitter'))hit(b,1);g.time+=2;g.updateGenerators();break;
        case 8:hit(type('repel'));ball.strongUntil=g.time+6;break;
        case 9:g.time=3.5;g.animateMechanisms();break;
        case 10:hit(g.bricks.find(b=>b.bossRole==='node'),12);g.animateMechanisms();break;
        case 11:hit(type('directional'),2);ball.x=100;ball.y=100;ball.vx=180;ball.vy=160;break;
        case 12:ball.x=355;ball.y=208;ball.vx=200;ball.vy=-300;break;
        case 13:ball.x=g.level.portals[0].x;ball.y=g.level.portals[0].y+40;ball.vy=-530;g.moveBall(ball,.1);break;
        case 14:hit(g.bricks.find(b=>b.opens==='lock2'),2);g.time+=.6;break;
        case 15:g.time=4.2;ball.x=460;ball.y=260;break;
        case 16:g.collect('fire');hit(type('explosive'));break;
        case 17:g.collect('laser');g.updateGenerators();for(const s of g.shots)s.y=345;break;
        case 18:hit(type('repel'));ball.strongUntil=g.time+6;g.time=4;g.animateMechanisms();break;
        case 19:for(const b of g.bricks.filter(b=>b.type==='emitter'))hit(b,1);g.time+=1;g.updateGenerators();g.collect('multi');break;
        case 20:hit(g.bricks.find(b=>b.bossRole==='node'),8);g.time=3.6;g.animateMechanisms();break;
        case 21:g.collect('rain');for(let k=0;k<15;k++){g.time+=.4;g.updateGenerators();}for(const b of g.balls){b.y=150+b.id*19;b.x=80+b.id*33;}break;
        case 22:g.collect('big');g.collect('full');hit(type('heavy'));hit(g.bricks.find(b=>b.w===176));break;
        case 23:g.collect('small');ball.x=127;ball.y=240;ball.r=5;break;
        case 24:g.collect('pierce');ball.x=185;ball.y=410;ball.vx=0;ball.vy=-1000;g.moveBall(ball,.32);break;
        case 25:g.collect('antigravity');g.collect('multi');for(const b of g.balls){b.y=200;b.vy=-200;b.x+=b.id*25;}break;
        case 26:g.time=4.2;g.animateMechanisms();g.collect('multi');break;
        case 27:hit(type('switch'));g.time+=1;break;
        case 28:hit(type('repel'));hit(type('directional'),2);ball.strongUntil=g.time+6;break;
        case 29:g.bricks.forEach(b=>{if(b.hp>0)b.hp=0;});g.checkComplete();g.collect('fire');break;
        case 30:for(const b of g.bricks.filter(b=>b.bossRole==='node'))hit(b,8);hit(g.bricks.find(b=>b.bossRole==='core'),20);break;
        }
        for(const b of g.balls)b.r=g.size();g.movePaddle(g.paddle.x+g.paddle.w/2);return g;
    }
    for(let i=0;i<30;i++){
        const section=document.createElement('article');section.className='pair';section.dataset.stage=String(i);
        const heading=document.createElement('h2');heading.textContent=`${String(i+1).padStart(2,'0')} · ${NeonBreakout.TITLES[i]}`;section.append(heading);
        const tip=document.createElement('p');tip.className='tip';tip.textContent=NeonBreakout.TIPS[i];section.append(tip);
        for(let mode=0;mode<2;mode++){
            const figure=document.createElement('figure'),canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
            canvas.setAttribute('aria-label',`${i+1} 關${mode?'啟動後':'初始'}畫面`);
            const caption=document.createElement('figcaption');caption.textContent=mode?`啟動後 · ${labels[i]}`:'初始 · 固定陣型';figure.append(canvas,caption);section.append(figure);
            const game=new Game({levelIndex:i}),renderer=new Renderer(canvas);if(mode)activate(game);renderer.accept(game.drainEvents(),game);renderer.draw(game);scenes.push({i,mode,canvas,game,renderer});
        }
        gallery.append(section);
    }
    function range(){const v=document.querySelector('#range').value;for(const section of gallery.children)section.hidden=v!=='all'&&Math.floor(Number(section.dataset.stage)/10)!==Number(v);}
    document.querySelector('#range').addEventListener('change',range);range();
    document.querySelector('#theme').addEventListener('click',()=>{light=!light;document.body.classList.toggle('light',light);for(const s of scenes)s.renderer.draw(s.game,{light});});
    document.querySelector('#download').addEventListener('click',()=>{
        const makeSheet=(start,count)=>{
            const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=count*510;const c=sheet.getContext('2d');c.fillStyle=light?'#eaf1fa':'#060b19';c.fillRect(0,0,sheet.width,sheet.height);
            for(let row=0;row<count;row++){
                const i=start+row;c.fillStyle=light?'#173252':'#c9eafa';c.font='bold 20px system-ui';c.fillText(`${String(i+1).padStart(2,'0')} ${NeonBreakout.TITLES[i]}`,16,row*510+26);
                for(let mode=0;mode<2;mode++){c.drawImage(scenes[i*2+mode].canvas,16+mode*636,row*510+42,620,465);c.font='12px system-ui';c.fillStyle=light?'#173252':'#c9eafa';c.fillText(mode?labels[i]:'初始',22+mode*636,row*510+39);}
            }
            return sheet.toDataURL('image/png');
        };
        const link=document.querySelector('#evidence');link.href=makeSheet(0,30);link.hidden=false;
        document.querySelectorAll('.evidence-part').forEach(link=>link.remove());
        for(let part=0;part<5;part++){
            const link=document.createElement('a');link.className='evidence-part';link.dataset.part=String(part);link.href=makeSheet(part*6,6);link.download=`breakout-stages-${part*6+1}-${part*6+6}.png`;link.textContent=`下載 ${String(part*6+1).padStart(2,'0')}–${part*6+6}`;
            document.querySelector('nav').append(link);
        }
    });
    document.querySelector('#audio-check').addEventListener('click',async()=>{
        const result=document.querySelector('#audio-result');result.textContent='正在合成與量測…';
        const Native=window.AudioContext;const lines=[];
        try {
            for(const effects of [['breakoutStrong'],['breakoutHeavy'],['breakoutPower'],['breakoutPortal'],['breakoutExplosion'],['breakoutStrong','breakoutHeavy','breakoutExplosion','brick','crack','reinforced','breakoutPower']]) {
                const offline=new OfflineAudioContext(1,44100,44100);window.AudioContext=function(){return offline;};
                const button=document.createElement('button'),sound=CashArcadeAudio.create({storageKey:'casharcade-qa-audio',toggleButton:button,outputLevel:.9});
                for(const name of effects)sound.play(name);window.AudioContext=Native;
                const rendered=await offline.startRendering(),samples=rendered.getChannelData(0);let peak=0,sum=0,last=0,count=0;
                for(let i=0;i<samples.length;i++){const v=Math.abs(samples[i]);peak=Math.max(peak,v);if(v>.001){last=i;sum+=samples[i]*samples[i];count++;}}
                const rms=Math.sqrt(sum/Math.max(1,count)),duration=last/44100;
                if(peak>1.0001||rms<.045||duration<.13)throw Error(`音訊未通過：${effects.join('+')} · ${duration.toFixed(3)}s RMS ${rms.toFixed(3)} peak ${peak.toFixed(4)}`);
                lines.push(`${effects.length>1?'密集混音':effects[0]}：${duration.toFixed(3)} s · RMS ${rms.toFixed(3)} · peak ${peak.toFixed(3)} ✓`);
            }
            result.textContent=lines.join('\n');
        }catch(error){result.textContent=lines.join('\n')+`\n音訊檢查失敗：${error.message}`;}
        finally {window.AudioContext=Native;}
    });
})();

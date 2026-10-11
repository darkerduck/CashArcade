// Run only in the assistant cloud browser environment. Requires its existing
// Playwright installation; do not install or launch a browser on the user's Mac.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const url=process.argv[2]||'http://127.0.0.1:4173/drift/';
const output=process.env.DRIFT_QA_OUTPUT||'/tmp/drift-qa';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const reports=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>globalThis.NeonDriftRenderer);
  await page.evaluate(()=>{
   const original=NeonDriftRenderer.Renderer.prototype.render;
   NeonDriftRenderer.Renderer.prototype.render=function(game,...args){globalThis.__qaGame=game;return original.call(this,game,...args);};
  });
  assert.equal(await page.locator('.track:disabled').count(),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#start').click();await page.waitForFunction(()=>globalThis.__qaGame?.state==='running');
  // Actual DOM control events, pause/resume, and input cleanup.
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(180);
  await page.keyboard.up('Space');await page.keyboard.up('ArrowLeft');
  await page.locator('#pause').click();
  const paused=await page.evaluate(()=>JSON.stringify(__qaGame));await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>JSON.stringify(__qaGame)),paused);
  await page.locator('#start').click();await page.waitForFunction(()=>__qaGame.state==='running');
  // Reset via the actual retry UI. Capture the new model from the renderer.
  await page.locator('#retry').click();await page.locator('#start').click();
  await page.waitForFunction(()=>__qaGame.state==='running'&&__qaGame.time<1);
  const race=await page.evaluate(()=>{
   const g=__qaGame,{nearestPoint,pointAt,wrapAngle,clamp}=NeonDrift;
   // Input-only replay: no position/health/progress/state writes. This uses the
   // public engine while the page displays the final outcome on its next frame.
   for(let i=0;i<5401&&g.state==='running';i++){
    const p=nearestPoint(g.car.x,g.car.y,g.track),t=pointAt(p.progress+75/g.track.length,g.track);
    g.update(1/60,{steer:clamp(wrapAngle(Math.atan2(t.y-g.car.y,t.x-g.car.x)-g.car.angle)*2.7,-1,1)});
   }
   return {state:g.state,won:g.won,rank:g.rank,health:g.health,laps:g.laps,rivals:g.rivals.map(r=>({laps:r.laps,health:r.health}))};
  });
  assert.equal(race.won,true);await page.waitForFunction(()=>document.querySelector('#overlay-kicker').textContent==='RACE WON');
  assert.equal(await page.locator('.track:disabled').count(),1);
  await page.screenshot({path:`${output}/${mobile?'mobile':'desktop'}-win.png`,fullPage:true});
  await page.reload();assert.equal(await page.locator('.track:disabled').count(),1);
  await page.locator('.track').nth(1).click();await page.locator('#start').click();
  await page.waitForFunction(()=>globalThis.NeonDriftRenderer);
  // Reload discarded the capture hook. Capture the current model again.
  await page.evaluate(()=>{const original=NeonDriftRenderer.Renderer.prototype.render;NeonDriftRenderer.Renderer.prototype.render=function(g,...a){globalThis.__qaGame=g;return original.call(this,g,...a);};});
  await page.waitForFunction(()=>globalThis.__qaGame?.state==='running');
  // Crash using only steering/throttle update inputs. If straight driving stays
  // grazing instead of destructive, alternate hard turns to create new impacts.
  const crash=await page.evaluate(()=>{
   const g=__qaGame;
   for(let i=0;i<5401&&g.state==='running';i++)g.update(1/60,{steer:Math.floor(i/120)%2?1:-1,drift:Math.floor(i/90)%2===0});
   return {state:g.state,won:g.won,health:g.health};
  });
  assert.equal(crash.won,false);
  await page.waitForFunction(()=>!document.querySelector('#overlay').hidden);
  assert.equal(await page.locator('.track:disabled').count(),1,'loss must not unlock track three');
  await page.locator('#theme-toggle').click();
  await page.screenshot({path:`${output}/${mobile?'mobile':'desktop'}-loss-light.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(mobile){
   await page.locator('#retry').click();await page.locator('#start').click();
   const session=await context.newCDPSession(page);
   const l=await page.locator('#left').boundingBox(),d=await page.locator('#drift').boundingBox();
   const touches=[{x:l.x+l.width/2,y:l.y+l.height/2,id:1},{x:d.x+d.width/2,y:d.y+d.height/2,id:2}];
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await page.waitForTimeout(200);
   assert.equal(await page.locator('.touch-controls .active').count(),2);
   await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   assert.equal(await page.locator('.touch-controls .active').count(),0);
  }
  assert.deepEqual(errors,[]);reports.push({mobile,race,crash,errors});await context.close();
 }
 console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}

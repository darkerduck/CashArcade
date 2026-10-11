// Assistant cloud only. Uses its existing Playwright/Chrome installation.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=process.argv[2]||'http://127.0.0.1:4173/drift/';
const browser=await chromium.launch({headless:true});
const reports=[];
try {
 for(const viewport of [{width:1180,height:757},{width:393,height:844},{width:844,height:393},{width:320,height:568},{width:568,height:320}]) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.locator('#fullscreen').click();
  await page.waitForFunction(()=>document.fullscreenElement?.classList.contains('machine'));
  const measure=async state=>{
   const metrics=await page.evaluate(()=>{
    const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return {viewport:{width:innerWidth,height:innerHeight},machine:box('.machine'),arena:box('.arena'),canvas:box('#game-canvas'),hud:box('.hud'),telemetry:box('.telemetry'),touch:box('.touch-controls'),actions:box('.actions'),buttons:['#left','#right','#drift','#fullscreen'].map(box)};
   });
   const {arena,canvas,telemetry,touch,actions,hud,buttons}=metrics,e=1;
   assert.ok(arena.height>0,'usable arena height');
   assert.ok(canvas.height>0&&canvas.width>0,'canvas is visible');
   if(metrics.viewport.height<=500&&metrics.viewport.width>=metrics.viewport.height){
    assert.ok(arena.height>=metrics.viewport.height*.5-e,'short landscape arena reserves at least half the viewport height');
    assert.ok(canvas.height>=metrics.viewport.height*.5-e,'short landscape game view remains playable');
    assert.ok(hud.height<=60,'short landscape HUD stays in one compact row');
   }
   assert.ok(canvas.x>=arena.x-e&&canvas.y>=arena.y-e&&canvas.right<=arena.right+e&&canvas.bottom<=arena.bottom+e,'canvas fully contained in arena');
   assert.ok(Math.abs(canvas.width-canvas.height*1000/760)<1,'canvas preserves game aspect ratio');
   assert.ok(hud.bottom<=arena.y+e&&arena.bottom<=telemetry.y+e&&telemetry.bottom<=touch.y+e&&touch.bottom<=actions.y+e,'five rows cannot overlap');
   for(const box of buttons)assert.ok(box.x>=-e&&box.y>=-e&&box.right<=metrics.viewport.width+e&&box.bottom<=metrics.viewport.height+e,'controls inside viewport');
   assert.ok(actions.bottom<=metrics.viewport.height+e,'actions visible without fullscreen page scroll');
   reports.push({viewport,state,...metrics});
  };
  await measure('ready-dark');
  await page.locator('#start').scrollIntoViewIfNeeded();await page.locator('#start').click();
  await page.waitForFunction(()=>document.querySelector('#overlay').hidden);
  await measure('running-dark');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(80);await page.keyboard.up('ArrowRight');
  await page.locator('#pause').click();await measure('paused-dark');
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await measure('paused-light');
  // Resize while remaining fullscreen; remeasure intrinsic row heights.
  await page.setViewportSize({width:viewport.width,height:viewport.height+37});await measure('resized-light');
  await page.locator('#fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({passed:true,cases:reports.length,reports},null,2));
} finally {await browser.close();}

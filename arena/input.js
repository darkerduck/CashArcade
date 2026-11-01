(() => {
    'use strict';
    function point(canvas,x,y){const r=canvas.getBoundingClientRect(),s=Math.min(r.width/720,r.height/720);return {x:(x-r.left-(r.width-720*s)/2)/s,y:(y-r.top-(r.height-720*s)/2)/s};}
    function create({canvas,joystick,knob,dash,onDash,onPause,onRetry,active}){
        const keys=new Set();let pointer=null,vector={dx:0,dy:0},aim={aimX:360,aimY:0},touch=globalThis.matchMedia?.('(pointer: coarse)').matches||false;
        const movement=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
        function value(){return {...aim,autoAim:touch,dx:vector.dx||((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)),dy:vector.dy||((keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0))};}
        function clear(){keys.clear();pointer=null;vector={dx:0,dy:0};knob.style.transform='translate(0px, 0px)';}
        document.addEventListener('keydown',e=>{
            const k=e.key.toLowerCase();if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input, select, textarea, [contenteditable="true"]'))return;
            if([' ','enter'].includes(k)&&e.target.closest?.('button, summary, a'))return;
            if(![...movement,' ','shift','p','escape','r'].includes(k))return;e.preventDefault();
            if(movement.includes(k)){if(active())keys.add(k);return;}
            if(e.repeat)return;if(k==='p'||k==='escape')onPause();else if(k==='r')onRetry();else if(active())onDash(value());
        });
        document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
        canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;touch=false;const p=point(canvas,e.clientX,e.clientY);aim={aimX:p.x,aimY:p.y};});
        function move(e){if(e.pointerId!==pointer)return;const r=joystick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.hypot(x,y),radius=r.width*.32;
            vector=len<5?{dx:0,dy:0}:{dx:x/Math.max(radius,len),dy:y/Math.max(radius,len)};knob.style.transform=`translate(${vector.dx*radius}px, ${vector.dy*radius}px)`;}
        joystick.addEventListener('pointerdown',e=>{if(!active()||pointer!==null)return;e.preventDefault();touch=true;pointer=e.pointerId;joystick.setPointerCapture(e.pointerId);move(e);});
        joystick.addEventListener('pointermove',move);
        function release(e){if(e.pointerId===pointer){pointer=null;vector={dx:0,dy:0};knob.style.transform='translate(0px, 0px)';}}
        for(const event of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,release);
        dash.addEventListener('pointerdown',e=>{if(!active()||e.button>0)return;e.preventDefault();if(e.pointerType==='touch')touch=true;onDash(value());});
        dash.addEventListener('click',e=>{if(e.detail===0&&active())onDash(value());});
        return {value,clear};
    }
    globalThis.NeonArenaInput=Object.freeze({point,create});
})();

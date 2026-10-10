(() => {
    'use strict';
    class Audio {
        constructor(){this.context=null;this.settings={sound:true,music:true,volume:.5};this.next=0;this.beat=0;this.active=false;this.voices=0;}
        unlock(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;this.context ||= new C();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{/* Silent play remains available. */}}
        configure(settings){this.settings=settings;}
        tone(frequency,duration,volume=.05,type='triangle',slide=frequency){const c=this.context;if(!c||c.state!=='running'||this.voices>=16)return;
            const o=c.createOscillator(),g=c.createGain(),at=c.currentTime;o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),at+duration);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(c.destination);this.voices++;o.onended=()=>{o.disconnect();g.disconnect();this.voices--;};o.start(at);o.stop(at+duration+.02);}
        event(type){if(!this.settings.sound)return;if(type==='boost')this.tone(120,.35,.08,'sawtooth',620);if(type==='lap'){this.tone(660,.2,.08);this.tone(990,.4,.04);}if(type==='finish')this.tone(440,.6,.07,'triangle',110);if(type==='start')this.tone(330,.3,.05,'triangle',660);}
        update(game){const c=this.context;if(!c)return;const running=game.state==='running';if(!running){this.next=c.currentTime;return;}if(c.currentTime<this.next)return;this.next=c.currentTime+.15;
            if(this.settings.music){const notes=[110,164.81,220,164.81,130.81,196,261.63,196,98,146.83,196,146.83,123.47,185,246.94,185];const n=notes[this.beat%16];this.tone(n,.13,.045*this.settings.volume,'triangle');if(this.beat%2===0)this.tone(n*4,.1,.018*this.settings.volume,'sine');if(this.beat%4===0)this.tone(95,.09,.055*this.settings.volume,'sine',35);}
            if(this.settings.sound&&this.beat%2===0)this.tone(45+game.car.speed*.25,.18,.012,'sawtooth');this.beat++;}
    }
    globalThis.NeonDriftAudio={Audio};
})();

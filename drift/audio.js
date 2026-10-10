(() => {
    'use strict';
    // Shared square-lead/triangle-bass chiptune synth, with independent SFX.
    // Audio-clock lookahead is deliberately independent of rendering cadence.
    class Audio {
        constructor(){this.context=null;this.settings={sound:true,music:true,volume:.65};this.next=0;this.beat=0;this.active=false;this.voices=new Set();this.timer=null;this.track=-1;this.instrument=null;this.profile=null;}
        unlock(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;if(!this.context){this.context=new C();this.instrument=CashArcadeMusic.synth(this.context);}
            if(this.context.state!=='running')Promise.resolve(this.context.resume()).then(()=>this.pump()).catch(()=>{});else this.pump();
        }catch{/* Audio failure must never interrupt a race. */}}
        configure(settings){const was=this.settings;this.settings={...settings};if(!settings.music||settings.volume===0){this.instrument?.silence();}else if(!was.music||was.volume===0)this.next=this.context?.currentTime||0;this.instrument?.volume(settings.volume);}
        tone(frequency,duration,volume=.12,type='square',slide=frequency){const c=this.context;if(!c||c.state!=='running')return;for(const v of this.voices)if(v.end<c.currentTime)this.voices.delete(v);if(this.voices.size>=16)return;
            const o=c.createOscillator(),g=c.createGain(),at=c.currentTime;o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),at+duration);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(c.destination);const voice={o,g,end:at+duration+.02};this.voices.add(voice);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);};o.start(at);o.stop(voice.end);}
        event(type){if(!this.settings.sound)return;if(type==='boost')this.tone(120,.35,.10,'square',620);if(type==='lap'){this.tone(660,.2,.10);this.tone(990,.4,.07);}if(type==='finish')this.tone(440,.6,.12,'triangle',110);if(type==='start')this.tone(330,.3,.10,'square',660);}
        pause(){this.active=false;if(this.timer!==null)clearInterval(this.timer);this.timer=null;this.instrument?.silence();for(const v of this.voices){try{v.o.stop();}catch{}}this.voices.clear();}
        pump(){const c=this.context;if(!c||c.state!=='running'||!this.active||!this.settings.music||this.settings.volume===0||!this.profile)return;try{
            if(this.next<c.currentTime-.15)this.next=c.currentTime+.02;
            this.instrument.volume(this.settings.volume);
            while(this.next<c.currentTime+.1){this.instrument.step(this.profile,this.beat,this.next,CashArcadeExpansionScores.drift);this.beat=(this.beat+1)%128;this.next+=60/this.profile.bpm/4;}
        }catch{this.pause();}}
        update(game){const running=game.state==='running';if(!running){if(this.active)this.pause();return;}const track=Number.isInteger(game.trackIndex)?Math.max(0,Math.min(2,game.trackIndex)):0;
            if(!this.active||track!==this.track){const changed=track!==this.track;this.active=true;this.track=track;this.profile=CashArcadeExpansionScores.drift.profile(track+1);if(changed||game.time<.1)this.beat=0;this.next=(this.context?.currentTime||0)+.025;}
            if(this.context&&this.timer===null)this.timer=setInterval(()=>this.pump(),25);
            this.pump();}
    }
    globalThis.NeonDriftAudio={Audio};
})();

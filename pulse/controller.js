(() => {
  'use strict';
  const engine=typeof module!=='undefined'&&module.exports?require('./engine.js'):globalThis.PulseEngine;
  // Multiple fingers / alternate keys cannot generate duplicate taps or end another finger's hold.
  class Controller{
    constructor(game,clock,offset=0){this.game=game;this.clock=clock;this.offset=offset;this.sources=new Map();}
    time(timestamp){return engine.correctedTime(this.clock.position(timestamp),this.offset);}
    down(source,lane,timestamp){if(this.sources.has(source)||this.game.state!=='running')return null;const already=[...this.sources.values()].includes(lane);this.sources.set(source,lane);return already?null:this.game.down(lane,this.time(timestamp));}
    up(source,timestamp){if(!this.sources.has(source))return null;const lane=this.sources.get(source);this.sources.delete(source);return [...this.sources.values()].includes(lane)?null:this.game.up(lane,this.time(timestamp));}
    tick(){this.game.update(this.time());}
    pause(){this.tick();this.game.pause();this.clock.pause();this.sources.clear();}
    resume(){this.sources.clear();this.game.resume();this.clock.resume();}
    clear(){this.sources.clear();}
  }
  const api={Controller};globalThis.PulseController=api;if(typeof module!=='undefined')module.exports=api;
})();

import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export const read = path => readFileSync(new URL('../' + path,import.meta.url),'utf8');
export const html = read('prism/index.html');
export function engine() { const scope = vm.createContext({}); vm.runInContext(read('prism/engine.js'),scope); return scope.PrismStack; }
export class Element {
    constructor(id = '',tag = 'div') { this.id = id; this.tagName = tag; this.children = []; this.events = {}; this.attrs = {}; this.dataset = {}; this.style = {}; this.textContent = ''; this.disabled = false; this.hidden = false; this.checked = false; this.width = 80; this.height = 48; }
    addEventListener(type,fn) { (this.events[type] ??= []).push(fn); }
    fire(type,data = {}) { const event = {target:this,preventDefault(){this.prevented = true;},pointerId:1,clientX:0,clientY:0,button:0,repeat:false,...data}; for (const fn of this.events[type] || []) fn(event); return event; }
    matches(selector) { return selector.split(',').includes(this.tagName); }
    closest(selector) { return this.matches(selector) ? this : null; }
    focus() { this.focused = true; }
    setPointerCapture() {}
}
export function fixture({saved = null,raw = null,audio = true,denied = false,silent = false,reduced = false,theme = null} = {}) {
    const elements = new Map([...html.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)].map(m => [m[2],new Element(m[2],m[1])]));
    elements.get('queue').children = Array.from({length:3},() => new Element('','canvas'));
    const document = new Element(), window = new Element(), audioCalls = [], musicCalls = [], renders = [], values = new Map();
    if (saved) values.set('casharcade-prism-v1',JSON.stringify(saved));
    if (raw !== null) values.set('casharcade-prism-v1',raw);
    if (theme) values.set('casharcade-theme',theme);
    let writes = 0, now = 100, pending = null, current;
    const storage = {getItem(k){if (denied) throw Error('denied'); return values.get(k) ?? null;},setItem(k,v){writes++;if (denied) throw Error('denied');if(!silent)values.set(k,v);}};
    document.getElementById = id => { if (!elements.has(id)) throw Error('Missing ID: ' + id); return elements.get(id); };
    document.hidden = false; document.documentElement = {dataset:{}};
    const scope = vm.createContext({document,window,localStorage:storage,matchMedia:() => ({matches:reduced}),requestAnimationFrame:fn => {pending = fn;},Date:{now:() => 12345},
        PrismRenderer:{Renderer:class {render(game,motion,light){current = game; renders.push({game,motion,light});}preview(){}}}});
    if (audio) {
        scope.CashArcadeAudio = {create:() => ({resume:() => audioCalls.push('wake'),play:name => audioCalls.push(name),musicOutput(){}})};
        scope.CashArcadeMusic = {create:() => Object.fromEntries(['start','pause','resume','wake'].map(name => [name,(...args) => musicCalls.push([name,...args])]))};
        scope.CashArcadeExpansionScores = {prism:{}};
    }
    for (const file of ['engine','storage','game']) vm.runInContext(read('prism/' + file + '.js'),scope,{filename:'prism/' + file + '.js'});
    const frame = (delta = 17) => { now += delta; const fn = pending; pending = null; fn(now); };
    frame();
    return {scope,elements,document,window,audioCalls,musicCalls,renders,values,get writes(){return writes;},get game(){return current;},frame,
        click(id){elements.get(id).fire('click');frame();},key(code,extra = {}){return document.fire('keydown',{code,target:elements.get('canvas'),...extra});}};
}
export function drawingContext() {
    const calls = [], gradient = {addColorStop(...args){calls.push(['colorStop',...args]);}};
    const methods = ['save','restore','translate','fillRect','strokeRect','clearRect','beginPath','moveTo','lineTo','stroke','arc','fill','fillText'];
    const ctx = Object.fromEntries(methods.map(name => [name,(...args) => {for (const value of args) if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Nonfinite ' + name);calls.push([name,...args]);}]));
    ctx.createLinearGradient = () => gradient;
    return {ctx:new Proxy(ctx,{set(target,key,value){calls.push(['set',key,value]);target[key] = value;return true;}}),calls};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)), origin='https://darkerduck.github.io';
const pages=['index.html','snake/index.html','breakout/index.html','flappy/index.html','missile/index.html',
    'tests/arcade-music.html','tests/missile-music.html','tests/breakout-gallery.html'];
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function png(data) {
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(data.subarray(12,16).toString(),'IHDR');
    return {width:data.readUInt32BE(16),height:data.readUInt32BE(20),depth:data[24],colorType:data[25]};
}
function asset(url) {
    assert.equal(url.origin,origin);assert.ok(url.pathname.startsWith('/CashArcade/'));
    const local=path.join(root,url.pathname.slice('/CashArcade/'.length));assert.ok(existsSync(local),url.href);return local;
}

test('favicon is a real six-resolution ICO container with complete 32-bit PNG payloads',()=>{
    const data=readFileSync(path.join(root,'favicon.ico')), sizes=[16,32,48,64,128,256];
    assert.equal(data.readUInt16LE(0),0);assert.equal(data.readUInt16LE(2),1);assert.equal(data.readUInt16LE(4),sizes.length);
    let end=6+16*sizes.length;
    sizes.forEach((size,i)=>{
        const at=6+i*16,length=data.readUInt32LE(at+8),offset=data.readUInt32LE(at+12);
        assert.equal(data[at]||256,size);assert.equal(data[at+1]||256,size);
        assert.equal(data.readUInt16LE(at+4),1);assert.equal(data.readUInt16LE(at+6),32);assert.equal(offset,end);
        assert.ok(offset+length<=data.length);const info=png(data.subarray(offset,offset+length));
        assert.deepEqual(info,{width:size,height:size,depth:8,colorType:6});end+=length;
    });
    assert.equal(end,data.length);
});

for(const page of pages)test(`${page} resolves all favicon, touch and manifest links under /CashArcade/`,()=>{
    const html=readFileSync(path.join(root,page),'utf8'),links=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>attrs(m[0]));
    const base=new URL(`/CashArcade/${page}`,origin), icons=links.filter(l=>l.rel==='icon');
    assert.equal(icons.length,3);
    assert.equal(icons.filter(i=>i.type==='image/x-icon').length,1);
    for(const icon of icons) {
        const url=new URL(icon.href,base),local=asset(url);assert.match(url.searchParams.get('v')||'',/^\d+$/);
        if(icon.type==='image/png'){const info=png(readFileSync(local));assert.equal(icon.sizes,`${info.width}x${info.height}`);}
        else assert.equal(path.basename(local),'favicon.ico');
    }
    const apple=links.find(l=>l.rel==='apple-touch-icon'),appleInfo=png(readFileSync(asset(new URL(apple.href,base))));
    assert.equal(apple.sizes,'180x180');assert.equal(appleInfo.width,180);assert.equal(appleInfo.height,180);
    asset(new URL(links.find(l=>l.rel==='manifest').href,base));
    if(!page.startsWith('tests/')) {
        const logo=attrs(html.match(/<img class="brand-logo"[^>]*>/)[0]);
        assert.equal(logo.alt,'');assert.equal(logo.width,'44');assert.equal(logo.height,'44');
        assert.equal(png(readFileSync(asset(new URL(logo.src,base)))).width,256);
        asset(new URL(links.find(l=>l.href.includes('brand.css')).href,base));
    }
});

test('manifest icons decode at their declared size and remain in the project subpath',()=>{
    const m=JSON.parse(readFileSync(path.join(root,'site.webmanifest'),'utf8'));
    const base=new URL('/CashArcade/site.webmanifest',origin);
    assert.equal(m.display,'browser');assert.equal(new URL(m.scope,base).pathname,'/CashArcade/');
    assert.equal(new URL(m.start_url,base).pathname,'/CashArcade/');
    assert.equal(m.icons.length,2);
    for(const icon of m.icons){const info=png(readFileSync(asset(new URL(icon.src,base))));assert.equal(icon.sizes,`${info.width}x${info.height}`);assert.equal(icon.purpose,'any');}
});

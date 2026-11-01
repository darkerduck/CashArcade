import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
test('homepage exposes twelve games including arena and every new local asset stays inside the Pages subpath',()=>{
    const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.equal([...home.matchAll(/class="game-card /g)].length,12);assert.match(home,/12 MACHINES ONLINE/);assert.match(home,/href="\.\/arena\/"/);
    for(const page of ['index.html','arena/index.html','tests/arena-gallery.html','tests/arena-playtest.html']){
        const html=readFileSync(new URL('../'+page,import.meta.url),'utf8'),base=new URL(page,'https://example.test/CashArcade/');
        for(const [,value] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
            const url=new URL(value,base);if(url.origin!==base.origin)continue;assert.ok(url.pathname.startsWith('/CashArcade/'),url.href);
            const file=new URL('../'+url.pathname.slice('/CashArcade/'.length),import.meta.url);assert.ok(existsSync(fileURLToPath(file)),url.href);
        }
    }
});

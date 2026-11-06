import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const scripts=[...html.matchAll(/<script defer src="([^"]+)"/g)].map(m=>m[1]);
assert(scripts.includes('levels/level0_7.js'));
assert(scripts.indexOf('levels/level0_7.js')<scripts.indexOf('js/game.js'));
new vm.Script(scripts.map(read).join('\n'),{filename:'all-game-scripts.js'});

const manifest=JSON.parse(read('assets/level0_7/source-manifest.json'));
assert.equal(manifest.pages.length,10);
assert.equal(manifest.images.length,9);
for(const pg of manifest.pages){
  const body=read('assets/level0_7/'+pg.file);
  assert(body.includes('<main>'));
  assert(!/<script|javascript:|\{\$one\}|翻译者须知|\[\[include/i.test(body),pg.id+' contains wiki implementation data');
  for(const match of body.matchAll(/<img src="([^"]+)"/g))assert(fs.existsSync(path.resolve(root,'assets/level0_7/archive',match[1])));
}
for(const im of manifest.images)assert(fs.statSync(path.join(root,'assets/level0_7',im.file)).size>1000);
const records=read('assets/level0_7/archive/records.html');
for(const text of ['James T. Corlain','夜惊','史前实体物种','火灾','1981','罗马','埃及'])assert(records.includes(text),text);
assert(read('assets/level0_7/archive/verified.html').includes('Mark L. Corlain'));
assert(read('assets/level0_7/archive/discovery.html').includes('40'));
console.log(JSON.stringify({pass:true,scripts:scripts.length,archives:manifest.pages.length,images:manifest.images.length,checks:['shared-scope syntax','load order','complete local archives','local image paths','no executable wiki scripts','story landmarks']},null,2));

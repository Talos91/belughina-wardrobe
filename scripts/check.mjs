import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk('dist');
assert(!files.some(f=>/review\.(html|js)$/.test(f)),'Remove local review pages before publishing');
const check=(args)=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});assert.equal(r.status,0,'Check failed: '+args.at(-1));};
for(const file of files.filter(f=>f.endsWith('.js')&&!f.includes('vendor')))check(['--check',file]);
for(const file of files.filter(f=>/\.(js|html|css)$/.test(f)&&!f.includes('vendor'))){
 const text=fs.readFileSync(file,'utf8');
 for(const match of text.matchAll(/(?:from\s*|(?:src|href)=)\s*["'](\.\.?\/[^"'`<>]+)["']/g)){
  const ref=match[1].split(/[?#]/)[0];assert(fs.existsSync(path.resolve(path.dirname(file),ref)),`${file}: missing ${ref}`);
 }
}
const {DRESSES,CLOTHES,EXTRAS,PLACES}=await import('../dist/wardrobe-state.js');
for(const id of ['beluga','salami',...[...DRESSES,...CLOTHES,...EXTRAS].map(i=>i.id)]){
 const b=fs.readFileSync(`dist/assets/models/${id}.glb`);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));assert(j.extensionsRequired.includes('EXT_meshopt_compression'));
 assert(b.length<25*1024*1024,`${id}: unexpectedly large model`);
}
assert.equal(PLACES.length,6);
for(const p of PLACES){assert(fs.existsSync(`dist/assets/backgrounds/${p.id}.webp`));assert(fs.existsSync(`dist/assets/thumbnails/room-${p.id}.webp`));}
assert(files.reduce((n,f)=>n+fs.statSync(f).size,0)<150*1024*1024,'Release unexpectedly exceeds 150 MiB');
for(const test of fs.readdirSync('tests').filter(f=>f.endsWith('.test.mjs')))check(['--no-warnings','--loader','./tests/resolve-three.mjs','tests/'+test]);
console.log('PASS: release paths, 19 models, 6 rooms, syntax, motion, layers, Salami, and letter.');

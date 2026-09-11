import fs from 'node:fs/promises';
import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {compactPrimitive, prune, textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';

const sourceRoot=process.argv[2];
if(!sourceRoot)throw Error('Usage: npm run optimize-assets -- /path/to/full-quality-static [output-assets]');
const source=path.resolve(sourceRoot,'models');
const assets=path.resolve(process.argv[3]||'dist/assets');
const output=path.join(assets,'models');
if(source===output)throw Error('Keep original models in a separate directory.');
await fs.mkdir(output,{recursive:true});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const report=[];

function count(document){let vertices=0,triangles=0;for(const m of document.getRoot().listMeshes())for(const p of m.listPrimitives()){vertices+=p.getAttribute('POSITION').getCount();triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;}return {vertices,triangles};}

function simplifyCharacter(document){
 for(const node of document.getRoot().listNodes())if(node.getName().startsWith('Outfit_'))node.dispose();
 for(const mesh of document.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){
  const name=prim.getMaterial()?.getName()||'';
  if(!/^(base_primary|hair_primary)/.test(name))continue;
  const position=prim.getAttribute('POSITION'),pos=position.getArray(),n=position.getCount();
  const normal=prim.getAttribute('NORMAL').getArray(),uv=prim.getAttribute('TEXCOORD_0').getArray();
  const joints=prim.getAttribute('JOINTS_0').getArray(),weights=prim.getAttribute('WEIGHTS_0').getArray();
  const morphs=prim.listTargets().map(t=>t.getAttribute('POSITION')?.getArray()).filter(Boolean);
  const lock=new Uint8Array(n),stride=20,attributes=new Float32Array(n*stride);
  const hair=name.startsWith('hair');
  for(let i=0;i<n;i++){
   // Preserve expression vertices and the face/ear attachment surfaces exactly.
   if(!hair&&(pos[i*3+1]>3.02&&pos[i*3+2]>.00||morphs.some(m=>Math.abs(m[i*3])+Math.abs(m[i*3+1])+Math.abs(m[i*3+2])>1e-6)))lock[i]=1;
   attributes.set(normal.subarray(i*3,i*3+3),i*stride);
   attributes.set(uv.subarray(i*2,i*2+2),i*stride+3);
   for(let k=0;k<4;k++)attributes[i*stride+5+joints[i*4+k]]+=weights[i*4+k];
  }
  const oldIndices=prim.getIndices(),indices=new Uint32Array(oldIndices.getArray());
  const target=Math.floor(indices.length*(hair?.23:.32)/3)*3;
  const [result,error]=MeshoptSimplifier.simplifyWithAttributes(indices,pos,3,attributes,stride,[.2,.2,.2,.2,.2,...Array(15).fill(1)],lock,target,hair?.001:.00045,['LockBorder']);
  prim.setIndices(document.createAccessor().setType('SCALAR').setBuffer(position.getBuffer()).setArray(result));
  compactPrimitive(prim);
  console.log(name,`${n} → ${prim.getAttribute('POSITION').getCount()} vertices`,`${(indices.length/3).toFixed(0)} → ${(result.length/3).toFixed(0)} triangles`, 'error',error);
 }
}

function compactPrecision(document){
 const seen=new Set();
 for(const mesh of document.getRoot().listMeshes())for(const prim of mesh.listPrimitives()){
  for(const owner of [prim,...prim.listTargets()])for(const semantic of owner.listSemantics()){
   const accessor=owner.getAttribute(semantic);if(seen.has(accessor))continue;seen.add(accessor);
   const step=semantic==='POSITION'?1/262144:semantic==='NORMAL'?1/4096:semantic.startsWith('TEXCOORD')?1/65536:0;
   if(!step)continue;const values=accessor.getArray();if(!(values instanceof Float32Array))throw Error('Expected source float attributes');
   for(let i=0;i<values.length;i++)values[i]=Math.round(values[i]/step)*step;
  }
 }
}

for(const file of (await fs.readdir(source)).filter(x=>x.endsWith('.glb'))){
 const input=path.join(source,file),document=await io.read(input),before=count(document);
 if(document.getRoot().listExtensionsUsed().some(extension=>extension.extensionName==='EXT_meshopt_compression'))throw Error('Use full-quality original models as optimization input.');
 if(file==='beluga.glb')simplifyCharacter(document);
 await document.transform(prune({keepLeaves:true,keepAttributes:true}));
 // Keep the character atlas crisp; small jewelry uses fewer texels in memory.
 const colorSize=file==='beluga.glb'?2048:file==='earrings.glb'?512:1024;
 await document.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture|emissiveTexture/,resize:[colorSize,colorSize],quality:91,effort:5}));
 await document.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,resize:[1024,1024],lossless:true,effort:5}));
 await document.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/metallicRoughnessTexture|occlusionTexture/,resize:[512,512],lossless:true,effort:5}));
 // Round positions by at most 0.00000191 model units. This is under 0.001
 // screen pixels at normal framing. Keep world units, bone weights, and all
 // animation tracks unchanged (node-scale quantization breaks cloth shaders).
 compactPrecision(document);
 document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 await io.write(path.join(output,file),document);
 const decoded=await io.read(path.join(output,file));
 for(let m=0;m<document.getRoot().listMeshes().length;m++){
  const a=document.getRoot().listMeshes()[m],b=decoded.getRoot().listMeshes()[m];
  for(let p=0;p<a.listPrimitives().length;p++){
   const original=a.listPrimitives()[p],compressed=b.listPrimitives()[p];
   const streams=original.listSemantics().map(s=>[original.getAttribute(s),compressed.getAttribute(s)]);
   original.listTargets().forEach((t,i)=>t.listSemantics().forEach(s=>streams.push([t.getAttribute(s),compressed.listTargets()[i].getAttribute(s)])));
   for(const [x,y]of streams){const aa=x.getArray(),bb=y.getArray();if(aa.length!==bb.length||aa.some((v,i)=>v!==bb[i]))throw Error(`${file}: compression changed ${x.getName()} values`);}
  }
 }
 const entry={file,beforeBytes:(await fs.stat(input)).size,afterBytes:(await fs.stat(path.join(output,file))).size,before,after:count(decoded)};
 report.push(entry);console.log(JSON.stringify(entry));
}


const backgrounds=[];
await fs.mkdir(path.join(assets,'backgrounds'),{recursive:true});
for(const name of await fs.readdir(path.join(sourceRoot,'backgrounds')))if(name.endsWith('.png')){
 const src=path.join(sourceRoot,'backgrounds',name),out=path.join(assets,'backgrounds',name.replace('.png','.webp'));
 await sharp(src).webp({quality:90,effort:6}).toFile(out);
 backgrounds.push({file:name,beforeBytes:(await fs.stat(src)).size,afterBytes:(await fs.stat(out)).size});
}

await fs.writeFile(path.resolve(assets,'../../ASSET-REPORT.json'),JSON.stringify({models:report,backgrounds},null,2)+'\n');

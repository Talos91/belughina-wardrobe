import * as THREE from 'three';

export class SalamiSummon{
 constructor(scene,wardrobe,{onLand=()=>{},visual=null}={}){
  this.wardrobe=wardrobe;this.onLand=onLand;this.root=new THREE.Group();this.root.name='Summoned salami';this.root.visible=false;scene.add(this.root);this.visualScale=new THREE.Vector3(1,1,1);if(visual)this.setVisual(visual);
  this.effect=new THREE.Group();this.effect.name='Salami arrival';this.effect.visible=false;scene.add(this.effect);
  const glow=new THREE.MeshBasicMaterial({color:'#ff9a8b',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  this.rings=[];for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.21+i*.055,.008,8,48),glow.clone());ring.rotation.x=Math.PI/2;this.effect.add(ring);this.rings.push(ring)}
  this.sparks=[];for(let i=0;i<12;i++){const spark=new THREE.Mesh(new THREE.IcosahedronGeometry(.019,0),glow.clone());spark.material.color.set(i%3?'#ffb397':'#fff1c2');this.effect.add(spark);this.sparks.push(spark)}
  this.enabled=false;this.phase='hidden';this.elapsed=0;this.matrix=new THREE.Matrix4();this.target=new THREE.Vector3();this.scale=new THREE.Vector3();this.rotation=new THREE.Quaternion();
 }
 setVisual(visual){if(this.visual)this.root.remove(this.visual);this.visual=visual;this.visualScale.copy(visual.scale).multiplyScalar(.74);this.root.add(visual)}
 setEquipped(enabled){this.enabled=Boolean(enabled);if(!this.enabled){this.root.visible=false;this.effect.visible=false;this.phase='hidden';this.elapsed=0}}
 get busy(){return this.phase==='spawning'||this.phase==='falling'}
 get framingScale(){if(this.gentle||!this.busy)return 1;const inScale=THREE.MathUtils.smoothstep(this.elapsed,0,.24),outScale=THREE.MathUtils.smoothstep(this.elapsed,1.1,1.85);return 1-.26*inScale*(1-outScale)}
 summon({gentle=false}={}){if(!this.enabled||!this.visual||this.busy)return false;this.elapsed=0;this.gentle=gentle;this.phase='spawning';this.root.visible=true;this.update(0);return true}
 attachment(){
  const item=this.wardrobe.loaded.get('tote');if(!item||!this.wardrobe.shown.has('tote'))return false;
  const mesh=item.meshes[0],i=mesh.skeleton.bones.findIndex(b=>b.name==='Chest');if(i<0)return false;
  mesh.updateWorldMatrix(true,false);mesh.skeleton.bones[i].updateWorldMatrix(true,false);
  this.matrix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[i].matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix);
  const offsets={floral:.12,pink:.06,moonlight:.045,bloom:.055,halter:0,stripe:.015,noir:.10};let offset=0;
  for(const [name,index] of Object.entries(mesh.morphTargetDictionary||{}))if(name.startsWith('Layer_'))offset+=(offsets[name.slice(6)]||0)*(mesh.morphTargetInfluences[index]||0);
  this.target.set(-.612-offset,1.735,.13).applyMatrix4(this.matrix);this.matrix.decompose(new THREE.Vector3(),this.rotation,this.scale);return true;
 }
 update(delta){
  if(!this.enabled||this.phase==='hidden')return;
  if(!this.attachment()){this.setEquipped(false);return}
  this.elapsed+=Math.max(0,Math.min(delta,.1));const spawn=this.gentle?.18:.60,duration=this.gentle?.50:1.25,t=THREE.MathUtils.clamp((this.elapsed-spawn)/duration,0,1);
  const appear=THREE.MathUtils.clamp(this.elapsed/spawn,0,1),back=appear-1,pop=this.gentle?appear:1+2.7*back**3+1.7*back**2;
  this.visual.scale.copy(this.visualScale).multiplyScalar(Math.max(.001,pop));
  const height=this.gentle?.42:2.45;let lift=height*(1-t*t);
  if(this.elapsed>=spawn&&this.phase==='spawning')this.phase='falling';
  if(t===1){const after=this.elapsed-spawn-duration;lift=this.gentle?0:.035*Math.exp(-after*9)*Math.abs(Math.sin(after*16));if(this.phase==='falling'){this.phase='peeking';this.onLand()}}
  this.root.position.copy(this.target);this.root.position.y+=lift;
  this.root.quaternion.copy(this.rotation).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.10,-.55+(this.gentle?0:(1-appear)*Math.PI*2),.04)));
  this.root.scale.copy(this.scale);this.root.updateMatrixWorld(true);
  const fade=1-THREE.MathUtils.smoothstep(this.elapsed,.35,.86);this.effect.visible=!this.gentle&&fade>0;this.effect.position.copy(this.target);this.effect.position.y+=height+.10;
  this.rings.forEach((ring,i)=>{ring.scale.setScalar(.3+appear*(1.5+i*.4));ring.position.y=i*.06;ring.material.opacity=fade*.80});
  this.sparks.forEach((spark,i)=>{const a=i*Math.PI*2/12,r=.08+appear*(.24+(i%3)*.04);spark.position.set(Math.cos(a)*r,.08+Math.sin(i*2.4)*.10+appear*.23,Math.sin(a)*r);spark.material.opacity=fade;spark.rotation.set(appear*3,i,appear*2)});
 }
}

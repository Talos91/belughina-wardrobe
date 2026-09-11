import * as THREE from 'three';

// Analytic, bone-attached picking keeps a tap independent of garment polygon
// count. It never traverses or raycasts the detailed render meshes.
export class CharacterPicker {
 constructor(character){
  this.character=character;this.raycaster=new THREE.Raycaster();this.ray=new THREE.Ray();this.point=new THREE.Vector3();this.sphere=new THREE.Sphere(new THREE.Vector3(),1);this.matrix=new THREE.Matrix4();this.inverse=new THREE.Matrix4();
  character.traverse(o=>{if(!this.mesh&&o.isSkinnedMesh&&o.material.name.startsWith('base_primary'))this.mesh=o});
  const specs=[['Head','boop',[0,3.40,.07],[.65,.64,.59]],['Head','boop',[0,3.10,.53],[.47,.27,.36]],['Chest','pose',[0,2.02,.06],[.53,.73,.40]],['ArmL','pose',[-.76,2.18,.03],[.39,.48,.29]],['ArmR','pose',[.76,2.18,.03],[.39,.48,.29]],['Tail','pose',[0,.64,.03],[.69,.62,.37]]];
  this.proxies=specs.map(([bone,type,center,scale])=>({index:this.mesh.skeleton.bones.findIndex(b=>b.name===bone),type,local:new THREE.Matrix4().compose(new THREE.Vector3(...center),new THREE.Quaternion(),new THREE.Vector3(...scale))}));
 }
 pick(ndc,camera){
  this.character.updateMatrixWorld(true);this.raycaster.setFromCamera(ndc,camera);const mesh=this.mesh;let closest=Infinity,result=null;
  for(const proxy of this.proxies){
   if(proxy.index<0)continue;
   this.matrix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[proxy.index].matrixWorld).multiply(mesh.skeleton.boneInverses[proxy.index]).multiply(mesh.bindMatrix).multiply(proxy.local);
   this.ray.copy(this.raycaster.ray).applyMatrix4(this.inverse.copy(this.matrix).invert());
   if(!this.ray.intersectSphere(this.sphere,this.point))continue;
   this.point.applyMatrix4(this.matrix);const distance=this.point.distanceToSquared(this.raycaster.ray.origin);
   if(distance<closest){closest=distance;result=proxy.type}
  }
  return result;
 }
}

import * as THREE from 'three';

const v=new THREE.Vector3(),p=new THREE.Vector3(),axis=new THREE.Vector3(),q=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};

/** Fits the existing tail flukes to a floor after authored animation blending. */
export class TailGrounding {
  constructor(character) {
    this.character=character;this.root=character.getObjectByName('Root');this.tail=character.getObjectByName('Tail');
    this.feet=['L','R'].map(side=>({bone:character.getObjectByName('Tail'+side),samples:[],contact:new THREE.Vector3(),rest:new THREE.Vector3(),side:side==='L'?-1:1}));
    this.tailRest=this.tail.quaternion.clone();for(const foot of this.feet)foot.rotationRest=foot.bone.quaternion.clone();
    // Ease only the lower lobe roots. The shared stem retains its original
    // weights so an asymmetric rest never pulls it into two pinched knees.
    character.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||/^(Outfit_|Wardrobe_)/.test(mesh.name)||mesh.userData.crossedFinWeights)return;
      const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
      const tailIndex=mesh.skeleton.bones.findIndex(b=>b.name==='Tail');
      const sides=['TailL','TailR'].map(name=>mesh.skeleton.bones.findIndex(b=>b.name===name));
      if(tailIndex<0||sides.some(i=>i<0))return;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),amount=.45*ease((.48-y)/.20)*ease((Math.abs(x)-.05)/.10);
        if(amount===0)continue;
        const indices=[skinIndex.getX(i),skinIndex.getY(i),skinIndex.getZ(i),skinIndex.getW(i)];
        const weights=[skinWeight.getX(i),skinWeight.getY(i),skinWeight.getZ(i),skinWeight.getW(i)];
        const stem=indices.indexOf(tailIndex);if(stem<0)continue;
        const side=sides[x<0?0:1];let lobe=indices.indexOf(side);
        if(lobe<0)lobe=weights.findIndex(w=>w===0);if(lobe<0)continue;
        indices[lobe]=side;const transfer=weights[stem]*amount;weights[stem]-=transfer;weights[lobe]+=transfer;
        skinIndex.setXYZW(i,...indices);skinWeight.setXYZW(i,...weights);
      }
      skinIndex.needsUpdate=true;skinWeight.needsUpdate=true;mesh.userData.crossedFinWeights=true;
    });
    this.meshes=[];character.updateMatrixWorld(true);
    character.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||/^(Outfit_|Wardrobe_)/.test(mesh.name))return;this.meshes.push(mesh);mesh.skeleton.update();
      const cells=[new Set(),new Set()],positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i);if(y>.21||Math.abs(x)<.20)continue;
        const side=x<0?0:1,key=[x,y,positions.getZ(i)].map(n=>Math.round(n/.022)).join(',');
        if(cells[side].has(key))continue;cells[side].add(key);this.feet[side].samples.push({mesh,index:i});
      }
    });
    this.sync();for(const foot of this.feet){this.contact(foot);foot.rest.copy(foot.contact)}
    this.floor=0;this.lift=0;this.contacts=this.feet.map(f=>f.contact);
  }
  sync(){this.character.updateMatrixWorld(true);for(const mesh of this.meshes)mesh.skeleton.update()}
  contact(foot) {
    let min=Infinity;foot.contact.set(0,Infinity,0);
    for(const {mesh,index} of foot.samples){mesh.getVertexPosition(index,v).applyMatrix4(mesh.matrixWorld);if(v.y<min){min=v.y;foot.contact.copy(v)}}
    return min;
  }
  softenTail(bone,rest,amount,limit){
    const angle=rest.angleTo(bone.quaternion),weight=Math.min(amount,limit/Math.max(angle,.0001));
    bone.quaternion.copy(rest.clone().slerp(bone.quaternion,weight));
  }
  update(motion) {
    if(!this.root||this.feet.some(f=>!f.samples.length))return;
    let free=0;
    for(const layer of motion.layers){const w=layer.action.getEffectiveWeight();
      if(layer.type==='twirl')free+=.85*w;
      if(layer.type==='wiggle')free+=.45*w;
      if(layer.type==='reveal')free+=.25*w;
    }
    // Keep broad, rounded lobes. Large independent fluke rotations buckle the
    // original shared skin into a claw-like crease at the center of the tail.
    this.softenTail(this.tail,this.tailRest,.38,.13);
    // Relaxed has an authored crossing, with one lobe slightly in front.
    // Keep that shape while retaining the protective limit during gestures.
    const crossed=THREE.MathUtils.clamp(motion.poseLayers.filter(layer=>layer.type==='relaxed').reduce((n,layer)=>n+layer.action.getEffectiveWeight(),0),0,1);
    for(const foot of this.feet)this.softenTail(foot.bone,foot.rotationRest,THREE.MathUtils.lerp(.18,1,crossed),THREE.MathUtils.lerp(.055,.72,crossed));
    // Balance the whole stance with a small roll instead of twisting either lobe.
    const planted=1-THREE.MathUtils.clamp(free,0,.9)*motion.amplitude;
    this.sync();let heights=this.feet.map(f=>this.contact(f));
    for(let pass=0;pass<2;pass++){
      const left=this.feet[0].contact,right=this.feet[1].contact;
      axis.subVectors(right,left);axis.y=0;const span=axis.length();if(span<.2)break;
      axis.normalize();axis.set(axis.z,0,-axis.x);
      const angle=THREE.MathUtils.clamp(Math.atan2(right.y-left.y,span)*planted,-.07,.07);
      this.root.parent.getWorldQuaternion(parentQ).invert();axis.applyQuaternion(parentQ);
      q.setFromAxisAngle(axis,angle);this.root.quaternion.premultiply(q);this.sync();heights=this.feet.map(f=>this.contact(f));
    }
    // Cancel floating root tracks and keep the lowest tail edge on the floor.
    const correction=this.floor-Math.min(...heights);
    this.root.position.y+=correction;
    // Follow the support centroid during sways; turns pivot around the tail.
    const support=this.feet.map((f,i)=>Math.exp(-(heights[i]-Math.min(...heights))*35));
    p.copy(this.feet[0].contact).multiplyScalar(support[0]).addScaledVector(this.feet[1].contact,support[1]).divideScalar(support[0]+support[1]);
    const center=this.feet[0].rest.clone().multiplyScalar(support[0]).addScaledVector(this.feet[1].rest,support[1]).divideScalar(support[0]+support[1]);
    this.root.getWorldQuaternion(q);center.applyQuaternion(q);
    const dx=center.x-p.x,dz=center.z-p.z;
    this.character.getWorldQuaternion(parentQ).invert();v.set(dx,0,dz).applyQuaternion(parentQ);this.root.position.x+=v.x;this.root.position.z+=v.z;
    this.sync();for(const foot of this.feet)this.contact(foot);
    this.lift=Math.max(...this.feet.map(f=>f.contact.y));
  }
}

export function createContactShadows(scene) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(64,64,2,64,64,62);g.addColorStop(0,'rgba(44,27,17,.55)');g.addColorStop(.35,'rgba(44,27,17,.32)');g.addColorStop(1,'rgba(44,27,17,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const shadows=[];
  for(let i=0;i<3;i++){const material=new THREE.MeshBasicMaterial({map:texture,color:0x3b3028,transparent:true,depthWrite:false,opacity:i===0?.78:.95,toneMapped:false});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.002+i*.001;mesh.scale.set(i===0?2.1:.50,i===0?1.25:.44,1);scene.add(mesh);shadows.push(mesh)}
  return {update(grounding){const points=grounding.contacts;shadows[0].position.x=(points[0].x+points[1].x)/2-.12;shadows[0].position.z=(points[0].z+points[1].z)/2-.15;for(let i=0;i<2;i++){const m=shadows[i+1],pt=points[i];m.position.x=pt.x;m.position.z=pt.z;m.material.opacity=.95*Math.exp(-Math.max(0,pt.y)*7)}}};
}

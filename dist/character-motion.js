import * as THREE from 'three';
import {expressiveClips} from './expressive-clips.js?v=folio-release-5-clean';

const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
const CLIP_NAMES={wave:'Wave',wiggle:'Wiggle',kiss:'Kiss',boop:'Boop',pose:'Pose',delight:'DressDelight',reveal:'DressReveal',confident:'DressConfident',flourish:'DressFlourish',twirl:'Twirl',dance:'HappyDance',love:'SoLoved',camera:'CameraPose'};

/** Plays the authored rig clips while keeping the idle clock running underneath. */
export class CharacterMotion {
  constructor(character,clips,{random=Math.random,onSignal=()=>{},onChange=()=>{}}={}) {
    this.character=character;
    this.clips=expressiveClips(character,clips);
    for(const name of ['Idle',...Object.values(CLIP_NAMES)]) {
      if(!this.clips.has(name))throw new Error(`Character is missing the ${name} animation.`);
    }
    this.mixer=new THREE.AnimationMixer(character);
    this.idle=this.mixer.clipAction(this.clips.get('Idle')).setLoop(THREE.LoopRepeat,Infinity).play();
    this.layers=[];this.serial=0;this.dressDeck=[];this.lastDress=null;this.time=0;this.gentle=false;this.amplitude=1;
    this.selectedPose='relaxed';this.poseLayers=[];
    this.random=random;this.onSignal=onSignal;this.onChange=onChange;this.current=null;
    this.nextBlink=2.3;this.blinkStart=-10;this.blinkAgain=Infinity;
    this.bones=[];this.faces=[];
    character.updateMatrixWorld(true);
    this.carryArm=character.getObjectByName('ArmL');
    this.carryArmRest=this.carryArm.quaternion.clone();
    this.carryChest=character.getObjectByName('Chest');
    this.carryRestInverse=this.carryChest.getWorldQuaternion(new THREE.Quaternion()).invert();
    const carryDirection=character.getObjectByName('FinL').getWorldPosition(new THREE.Vector3()).sub(this.carryArm.getWorldPosition(new THREE.Vector3())).normalize().applyQuaternion(this.carryRestInverse);
    this.carryOffset=new THREE.Quaternion().setFromUnitVectors(carryDirection,new THREE.Vector3(-.32,.33,.60).normalize());
    this.carryAmount=0;this.carryBase=null;
    character.traverse(object=>{
      if(object.isBone)this.bones.push({object,rotation:object.quaternion.clone(),position:object.position.clone(),scale:object.scale.clone()});
      if(object.isMesh&&object.morphTargetDictionary?.Blink_L!==undefined)this.faces.push(object);
    });
    this.mixer.update(0);
    this.sampled=this.bones.map(({object})=>({object,rotation:object.quaternion.clone(),position:object.position.clone(),scale:object.scale.clone()}));
    this.setPose('relaxed',false);
  }

  setPose(type,notify=true){
    if(!['relaxed','little','tada'].includes(type))return;
    this.cancel(false);this.selectedPose=type;
    for(const layer of this.poseLayers){layer.exiting=true;}
    {
      const source=this.clips.get(type==='relaxed'?'RelaxedPose':type==='little'?'LittlePose':'TaDaPose');
      const clip=new THREE.AnimationClip(`Stance-${++this.serial}`,source.duration,source.tracks);
      const action=this.mixer.clipAction(clip).setLoop(THREE.LoopRepeat,Infinity).setEffectiveWeight(0).play();
      this.poseLayers.push({clip,action,type,weight:0,exiting:false});
    }
    if(notify)this.onChange(null);
  }

  nextDress(){
    if(!this.dressDeck.length){
      this.dressDeck=['delight','reveal','confident','flourish'];
      for(let i=3;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.dressDeck[i],this.dressDeck[j]]=[this.dressDeck[j],this.dressDeck[i]];}
      if(this.dressDeck.at(-1)===this.lastDress)[this.dressDeck[0],this.dressDeck[3]]=[this.dressDeck[3],this.dressDeck[0]];
    }
    return this.lastDress=this.dressDeck.pop();
  }

  play(type) {
    if(type==='dress')type=this.nextDress();
    const name=this.gentle&&type==='twirl'?'Pose':CLIP_NAMES[type];
    if(!name)return;
    this.cancel(false);
    const source=this.clips.get(name);
    // Each interruption retains the outgoing pose during its fade, including
    // repeated presses of the same gesture. Animation tracks are immutable/shared.
    const clip=new THREE.AnimationClip(`${name}-${++this.serial}`,source.duration,source.tracks);
    const action=this.mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;action.setEffectiveWeight(0).play();
    const layer={clip,action,type,age:0,weight:0,exitAge:null,exitWeight:0,signalled:false};
    this.layers.push(layer);this.current=layer;this.onChange(type);
  }

  cancel(notify=true) {
    for(const layer of this.layers)if(layer.exitAge===null){layer.exitAge=0;layer.exitWeight=layer.weight;}
    this.current=null;if(notify)this.onChange(null);
  }

  setGentle(value) {
    const next=Boolean(value);
    if(next&&!this.gentle&&this.current?.type==='twirl')this.cancel();
    this.gentle=next;
  }

  update(delta) {
    const dt=Number.isFinite(delta)?THREE.MathUtils.clamp(delta,0,.1):0;this.time+=dt;
    // Undo the previous additive pose before the mixer samples again, including
    // paused frames where unchanged animation bindings may skip their writes.
    for(const bone of this.sampled){bone.object.quaternion.copy(bone.rotation);bone.object.position.copy(bone.position);bone.object.scale.copy(bone.scale);}
    let total=0;
    for(const layer of this.layers) {
      layer.age+=dt;
      if(layer.exitAge!==null) {
        layer.exitAge+=dt;layer.weight=layer.exitWeight*(1-ease(layer.exitAge/.36));
      } else {
        layer.weight=ease(layer.age/.36)*ease((layer.clip.duration-layer.age)/.6);
        if(!layer.signalled&&layer.type==='kiss'&&layer.age>=1.65){layer.signalled=true;this.onSignal('kiss');}
        if(!layer.signalled&&layer.type==='boop'&&layer.age>=.1){layer.signalled=true;this.blinkStart=this.time;}
        if(!layer.signalled&&layer.type==='delight'&&layer.age>=1.3){layer.signalled=true;this.blinkStart=this.time;}
        if(!layer.signalled&&layer.type==='reveal'&&layer.age>=1.5){layer.signalled=true;this.onSignal('reveal');}
        if(!layer.signalled&&layer.type==='love'&&layer.age>=1.7){layer.signalled=true;this.onSignal('kiss');}
        if(!layer.signalled&&layer.type==='camera'&&layer.age>=3.4){layer.signalled=true;this.onSignal('reveal');}
      }
      total+=layer.weight;
    }
    const normalization=Math.max(1,total);
    for(const layer of this.layers)layer.action.setEffectiveWeight(layer.weight/normalization);
    const remaining=Math.max(0,1-total);let poseWeight=0;
    for(const layer of this.poseLayers){layer.weight=THREE.MathUtils.damp(layer.weight,layer.exiting?0:1,6,dt);poseWeight+=layer.weight;}
    for(const layer of this.poseLayers)layer.action.setEffectiveWeight(remaining*layer.weight/Math.max(1,poseWeight));
    this.idle.setEffectiveWeight(remaining*Math.max(0,1-poseWeight));
    this.mixer.update(dt);
    for(const bone of this.sampled){bone.rotation.copy(bone.object.quaternion);bone.position.copy(bone.object.position);bone.scale.copy(bone.object.scale);}
    this.poseLayers=this.poseLayers.filter(layer=>{if(!layer.exiting||layer.weight>.0001)return true;layer.action.stop();this.mixer.uncacheClip(layer.clip);return false;});
    this.layers=this.layers.filter(layer=>{
      const done=layer.exitAge!==null?layer.exitAge>=.36:layer.age>=layer.clip.duration;
      if(!done)return true;
      layer.action.stop();this.mixer.uncacheClip(layer.clip);
      if(this.current===layer){this.current=null;this.onChange(null);}
      return false;
    });

    // Apply the existing Gentle motion preference to every deforming joint.
    this.amplitude=THREE.MathUtils.damp(this.amplitude,this.gentle?.16:1,7,dt);
    if(this.amplitude<.99999)for(const bone of this.bones) {
      // Finish fading a full turn before reducing its root rotation, avoiding a
      // shortest-arc flip if Gentle motion is enabled halfway through a twirl.
      if(bone.object.name==='Root'&&this.layers.some(layer=>layer.type==='twirl'))continue;
      bone.object.quaternion.slerp(bone.rotation,1-this.amplitude);
      bone.object.position.lerp(bone.position,1-this.amplitude);
      bone.object.scale.lerp(bone.scale,1-this.amplitude);
    }
    if(this.time>=this.nextBlink) {
      this.blinkStart=this.time;this.nextBlink=this.time+3.2+this.random()*2.8;
      this.blinkAgain=this.random()<.16?this.time+.35:Infinity;
    }
    if(this.time>=this.blinkAgain){this.blinkStart=this.time;this.blinkAgain=Infinity;}
    const elapsed=this.time-this.blinkStart;
    const closure=elapsed<.075?ease(elapsed/.075):1-ease((elapsed-.10)/.16);
    let smile=this.selectedPose==='relaxed'?0:.24*remaining*this.amplitude,mouth=0,happyEyes=0;
    for(const layer of this.layers)if(['pose','delight','reveal','confident','flourish','wave','kiss'].includes(layer.type))smile+=.42*layer.weight/normalization*this.amplitude;
    for(const layer of this.layers)if(layer.type==='boop'||layer.type==='wiggle') {
      const e=ease((layer.age-.15)/.65)*ease((layer.clip.duration-.25-layer.age)/.9)*layer.weight/normalization*this.amplitude;
      smile+=.9*e;
      mouth+=(.50+.32*Math.sin(layer.age*Math.PI*2*1.8))*e;
      happyEyes+=(.55+.16*Math.sin(layer.age*Math.PI*2*.55))*e;
    }
    for(const layer of this.layers)if(['dance','love','camera'].includes(layer.type)){
      const e=ease(layer.age/.65)*ease((layer.clip.duration-layer.age)/.8)*layer.weight/normalization*this.amplitude;
      smile+=(layer.type==='love'?.85:.68)*e;
      happyEyes+=(layer.type==='camera'?.20:.94)*e;
    }
    for(const mesh of this.faces)for(const [name,value] of Object.entries({Blink_L:Math.max(closure,happyEyes),Blink_R:Math.max(closure,happyEyes),HappySmile:smile,MouthPurr:mouth})) {
      const index=mesh.morphTargetDictionary[name];
      if(index!==undefined)mesh.morphTargetInfluences[index]=THREE.MathUtils.clamp(value,0,1);
    }
    const carrying=this.character.userData.carryingTote?1:0;
    this.carryAmount=THREE.MathUtils.damp(this.carryAmount,carrying,7,dt);
    if(this.carryAmount>.0001){
      // Lift the carrying flipper above the opening so the bag and its
      // companion remain visible, without changing the body geometry.
      // The offset is expressed in the chest's rest axes and follows turns.
      this.carryArm.quaternion.slerp(this.carryArmRest,.80*this.carryAmount);
      this.character.updateMatrixWorld(true);
      const frame=this.carryChest.getWorldQuaternion(new THREE.Quaternion()).multiply(this.carryRestInverse);
      const support=this.carryAmount;
      const offset=new THREE.Quaternion().slerp(this.carryOffset,support);
      const world=frame.clone().multiply(offset).multiply(frame.clone().invert());
      const parent=this.carryArm.parent.getWorldQuaternion(new THREE.Quaternion());
      this.carryArm.quaternion.premultiply(parent.clone().invert().multiply(world).multiply(parent)).normalize();
    }
  }
}

import * as THREE from 'three';

const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
const envelope=p=>smooth(p/.22)*smooth((1-p)/.24);

// Keep the fitted torso and tail tracks. Expression comes mainly from the
// head, the free flipper and turning the entire dressed character together.
export function expressiveClips(character,original){
 const clips=new Map(original.map(c=>[c.name,c]));
 character.updateMatrixWorld(true);
 const cheekAim={};
 for(const side of ['L','R']){
  const shoulder=character.getObjectByName('Arm'+side).getWorldPosition(new THREE.Vector3());
  const target=new THREE.Vector3(side==='L'?-.25:.25,2.92,.62).sub(shoulder).normalize();
  cheekAim[side]=target;
 }
 function make(name,sourceName,duration,offsets,held=false){
  const source=clips.get(sourceName),tracks=[];
  for(const track of source.tracks){
   const boneName=track.name.split('.')[0],offset=offsets[boneName];
   if(!offset||!track.name.endsWith('.quaternion')){
    const next=track.clone();next.times=Float32Array.from(next.times,t=>t/source.duration*duration);tracks.push(next);continue;
   }
   const bone=character.getObjectByName(boneName),frame=bone.getWorldQuaternion(new THREE.Quaternion()),inverse=frame.clone().invert();
   const side=boneName.at(-1);
   const heldAim=name==='LittlePose'?(side==='R'?new THREE.Vector3(.30,.58,.68).normalize():new THREE.Vector3(-.86,-.30,.25).normalize()):name==='TaDaPose'?new THREE.Vector3(side==='R'?.82:-.88,side==='R'?.57:.40,.18).normalize():null;
   const cheek=/^Arm[LR]$/.test(boneName)?(name==='SoLoved'?cheekAim[side]:heldAim):null;
   const parentFrame=cheek?bone.parent.getWorldQuaternion(new THREE.Quaternion()):null;
   const localDirection=cheek?character.getObjectByName('Fin'+boneName.at(-1)).position.clone().normalize():null;
   const sampler=track.createInterpolant(),times=[],values=[],q=new THREE.Quaternion(),delta=new THREE.Quaternion();
   const count=Math.ceil(duration*30);
   for(let i=0;i<=count;i++){
    const t=i/count,p=held?1:envelope(t),a=offset(t,p,held);
    delta.setFromEuler(new THREE.Euler(...a,'ZYX'));
    delta.premultiply(inverse).multiply(frame);
    q.fromArray(sampler.evaluate(t*source.duration)).multiply(delta).normalize();
    if(cheek){
     // Aim from the sampled idle shoulder, which already has its own lift.
     // Adding another rest-space lift would put the flippers over her eyes.
     q.fromArray(sampler.evaluate(t*source.duration));
     const direction=localDirection.clone().applyQuaternion(parentFrame.clone().multiply(q));
     const turn=new THREE.Quaternion().setFromUnitVectors(direction,cheek);
     const target=parentFrame.clone().invert().multiply(turn).multiply(parentFrame).multiply(q);
     q.slerp(target,p).normalize();
    }
    if(['SoLoved','LittlePose','TaDaPose'].includes(name)&&/^Fin[LR]$/.test(boneName))q.fromArray(sampler.evaluate(t*source.duration)).slerp(bone.quaternion,p).normalize();
    times.push(t*duration);q.toArray(values,values.length);
   }
   tracks.push(new THREE.QuaternionKeyframeTrack(track.name,times,values));
  }
  const clip=new THREE.AnimationClip(name,duration,tracks);clips.set(name,clip);
 }
 make('RelaxedPose','Idle',12.0333,{
  Root:(_,e)=>[0,-.10*e,.015*e],Head:(t,e)=>[-.02*e,.09*e,(-.06+.009*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[0,0,.10*e],
  TailL:(_,e)=>[.16*e,.10*e,.60*e],TailR:(_,e)=>[-.06*e,-.08*e,-.22*e]
 },true);
 make('LittlePose','Idle',12.0333,{
  Root:(_,e)=>[0,-.30*e,.035*e],Head:(t,e)=>[.025*e,.15*e,(-.15+.016*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[-.07*e,0,.48*e],FinR:(_,e)=>[0,0,.12*e],ArmL:(_,e)=>[0,0,-.12*e],FinL:()=>[0,0,0]
 },true);
 make('TaDaPose','Idle',12.0333,{
  Root:(_,e)=>[0,.23*e,-.035*e],Head:(t,e)=>[-.10*e,-.15*e,(.09+.016*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[-.10*e,0,.64*e],FinR:(_,e)=>[0,0,.15*e],ArmL:(_,e)=>[-.04*e,0,-.45*e],FinL:(_,e)=>[0,0,-.10*e]
 },true);
 make('HappyDance','Idle',5.8,{
  Root:(t,e)=>[0,Math.sin(t*Math.PI*4)*.27*e,Math.sin(t*Math.PI*4)*.045*e],
  Head:(t,e)=>[-.08*e,-.10*Math.sin(t*Math.PI*4)*e,.07*Math.sin(t*Math.PI*4)*e],
  ArmR:(t,e)=>[-.10*e,0,(.93+.11*Math.sin(t*Math.PI*4))*e],
  ArmL:(t,e)=>[-.10*e,0,(-.93+.11*Math.sin(t*Math.PI*4))*e],
  FinR:(t,e)=>[0,0,.12*Math.sin(t*Math.PI*6)*e],
  FinL:(t,e)=>[0,0,-.12*Math.sin(t*Math.PI*6)*e]
 });
 make('SoLoved','Idle',5.2,{
  Root:(t,e)=>[0,-.14*e,.025*Math.sin(t*Math.PI*2)*e],
  Head:(t,e)=>[.07*e,.10*e,(-.13+.025*Math.sin(t*Math.PI*2))*e],
  ArmR:()=>[0,0,0],ArmL:()=>[0,0,0],
  FinR:(_,e)=>[0,-.12*e,.08*e],FinL:(_,e)=>[0,.12*e,-.08*e]
 });
 make('CameraPose','Idle',5.6,{
  Root:(t,e)=>[0,(-.38+.62*smooth((t-.42)/.30))*e,0],
  Head:(t,e)=>[-.025*e,(.15-.27*smooth((t-.42)/.30))*e,-.065*e],
  ArmR:(t,e)=>[-.09*e,0,(.68+.38*smooth((t-.42)/.30))*e],
  ArmL:(t,e)=>[-.07*e,0,(-1.02+.35*smooth((t-.42)/.30))*e],
  FinR:(_,e)=>[0,0,.10*e],FinL:(_,e)=>[0,0,-.10*e]
 });
 make('DressConfident','Idle',3.8,{
  Root:(t,e)=>[0,(-.33+.18*smooth((t-.45)/.25))*e,0],Head:(_,e)=>[-.04*e,.15*e,-.09*e],
  ArmR:(_,e)=>[-.06*e,0,.43*e],FinR:(_,e)=>[0,0,.12*e]
 });
 make('DressFlourish','DressDelight',4.1,{
  Root:(t,e)=>[0,Math.sin(t*Math.PI*2)*.16*e,0],Head:(t,e)=>[0,-.10*e,Math.sin(t*Math.PI*2)*.06*e],
  ArmR:(_,e)=>[-.03*e,0,.20*e],FinR:(t,e)=>[0,0,Math.sin(t*Math.PI*4)*.08*e]
 });
 make('Wave','Wave',3.7,{Root:(_,e)=>[0,-.10*e,0],Head:(_,e)=>[0,.07*e,-.045*e]});
 make('Kiss','Kiss',3.8333,{Root:(_,e)=>[0,-.12*e,0],Head:(_,e)=>[-.04*e,.08*e,.035*e]});
 make('Wiggle','Wiggle',4.9,{Head:(t,e)=>[0,Math.sin(t*Math.PI*4)*.075*e,Math.sin(t*Math.PI*4)*.035*e],ArmR:(t,e)=>[0,0,(.10+.07*Math.sin(t*Math.PI*4))*e]});
 make('Boop','Boop',3.4,{Head:(t,e)=>[0,Math.sin(t*Math.PI*2)*.075*e,-.035*e]});
 make('Pose','Pose',3.3,{Root:(_,e)=>[0,-.17*e,0],ArmR:(_,e)=>[0,0,.35*e],Head:(_,e)=>[0,.06*e,-.04*e]});
 make('DressDelight','DressDelight',3.8333,{Root:(_,e)=>[0,-.14*e,0],ArmR:(_,e)=>[0,0,.16*e]});
 make('DressReveal','DressReveal',4.4333,{Root:(_,e)=>[0,.15*e,0],Head:(_,e)=>[-.03*e,0,-.025*e]});
 return clips;
}

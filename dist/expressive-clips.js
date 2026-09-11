import * as THREE from 'three';

const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t)};
const envelope=p=>smooth(p/.22)*smooth((1-p)/.24);

// Keep the fitted torso and tail tracks. Expression comes mainly from the
// head, the free flipper and turning the entire dressed character together.
export function expressiveClips(character,original){
 const clips=new Map(original.map(c=>[c.name,c]));
 character.updateMatrixWorld(true);
 function make(name,sourceName,duration,offsets,held=false){
  const source=clips.get(sourceName),tracks=[];
  for(const track of source.tracks){
   const boneName=track.name.split('.')[0],offset=offsets[boneName];
   if(!offset||!track.name.endsWith('.quaternion')){
    const next=track.clone();next.times=Float32Array.from(next.times,t=>t/source.duration*duration);tracks.push(next);continue;
   }
   const bone=character.getObjectByName(boneName),frame=bone.getWorldQuaternion(new THREE.Quaternion()),inverse=frame.clone().invert();
   const sampler=track.createInterpolant(),times=[],values=[],q=new THREE.Quaternion(),delta=new THREE.Quaternion();
   const count=Math.ceil(duration*30);
   for(let i=0;i<=count;i++){
    const t=i/count,p=held?1:envelope(t),a=offset(t,p,held);
    delta.setFromEuler(new THREE.Euler(...a,'ZYX'));
    delta.premultiply(inverse).multiply(frame);
    q.fromArray(sampler.evaluate(t*source.duration)).multiply(delta).normalize();
    times.push(t*duration);q.toArray(values,values.length);
   }
   tracks.push(new THREE.QuaternionKeyframeTrack(track.name,times,values));
  }
  const clip=new THREE.AnimationClip(name,duration,tracks);clips.set(name,clip);
 }
 make('RelaxedPose','Idle',12.0333,{
  Root:(_,e)=>[0,-.08*e,-.025*e],Head:(t,e)=>[-.02*e,.09*e,(-.06+.009*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[0,0,.10*e],
  TailL:(_,e)=>[.22*e,0,1.18*e],TailR:(_,e)=>[-.18*e,0,-1.12*e]
 },true);
 // Turn the lobes from their shared tail stem. Rotating only their lower
 // bone heads curls them into a diamond instead of a natural crossing.
 const pivot=character.getObjectByName('Tail').getWorldPosition(new THREE.Vector3());
 for(const [name,angles] of [['TailL',[.22,0,1.18]],['TailR',[-.18,0,-1.12]]]){
  const bone=character.getObjectByName(name),offset=new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles,'ZYX'));
  const target=bone.getWorldPosition(new THREE.Vector3()).sub(pivot).applyQuaternion(offset).add(pivot);
  target.x+=name==='TailL'?.14:-.14;
  bone.parent.worldToLocal(target);
  clips.get('RelaxedPose').tracks=clips.get('RelaxedPose').tracks.filter(track=>track.name!==name+'.position');
  clips.get('RelaxedPose').tracks.push(new THREE.VectorKeyframeTrack(name+'.position',[0,12.0333],[...target.toArray(),...target.toArray()]));
 }
 make('LittlePose','Idle',12.0333,{
  Root:(_,e)=>[0,-.23*e,0],Head:(t,e)=>[-.035*e,.12*e,(-.09+.012*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[-.07*e,0,.48*e],FinR:(_,e)=>[0,0,.12*e],ArmL:(_,e)=>[0,0,-.12*e]
 },true);
 make('TaDaPose','Idle',12.0333,{
  Root:(_,e)=>[0,.13*e,0],Head:(t,e)=>[-.07*e,-.10*e,(.055+.012*Math.sin(t*Math.PI*2))*e],
  ArmR:(_,e)=>[-.10*e,0,.64*e],FinR:(_,e)=>[0,0,.15*e],ArmL:(_,e)=>[-.04*e,0,-.45*e],FinL:(_,e)=>[0,0,-.10*e]
 },true);
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

import * as THREE from 'three';

const COUNT=8,TOP=2.10,LENGTH=1.83;
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const spline=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));

// The same smooth deformation is used by the renderer and CPU picking/checks.
// Each horizontal section has its own swing, twist and opening response.
const CLOTH_GLSL=`
uniform vec4 skirtSections[8];
uniform float skirtTime;
uniform float skirtEnergy;
uniform vec4 skirtFloor;
uniform vec3 skirtFloorUp;
vec4 skirtSpline(vec4 a,vec4 b,vec4 c,vec4 d,float t){
  return b+.5*t*(c-a+t*(2.*a-5.*b+4.*c-d+t*(3.*(b-c)+d-a)));
}
vec3 skirtPoint(vec3 p){
  if(p.y>=2.10)return p;
  float u=clamp((2.10-p.y)/1.83,0.,1.);
  float row=u*7.;int i=min(int(floor(row)),6);float t=row-float(i);
  vec4 section=skirtSpline(skirtSections[max(i-1,0)],skirtSections[i],skirtSections[i+1],skirtSections[min(i+2,7)],t);
  float center=.02+.14*smoothstep(.6,1.8,p.y);
  vec2 radial=vec2(p.x,p.z-center);
  float radius=length(radial),theta=atan(radial.y,radial.x);
  float ripple=skirtEnergy*u*u*u*(.018*sin(theta*3.-skirtTime*5.2+u*4.)+.010*sin(theta*5.+skirtTime*6.4-u*7.));
  float c=cos(section.z),s=sin(section.z);
  radial=vec2(radial.x*c-radial.y*s,radial.x*s+radial.y*c)*(1.+max(-.03,section.w)+ripple/max(radius,.12));
  p.x=radial.x+section.x;p.z=center+radial.y+section.y;
  p.y+=.22*max(0.,section.w)*u+.28*dot(section.xy,section.xy)/max(.3,u*1.83);
  return p;
}
`;

/** A spring-driven skirt: fitted at the top, with progressively slower response
 * toward the hem. It reacts to actual world movement, including pointer turns.
 * This is controlled fabric follow-through, not a general collision simulator. */
export class SkirtDynamics{
  constructor(character,meshes,{strength=1}={}){
    this.character=character;this.meshes=meshes;this.strength=strength;
    this.sections=Array.from({length:COUNT},()=>new THREE.Vector4(0,0,0,0));
    this.velocities=Array.from({length:COUNT},()=>new THREE.Vector4(0,0,0,0));
    this.values=[0,0,0,0];this.time=0;this.energy=0;this.initialized=false;
    this.position=new THREE.Vector3();this.previousPosition=new THREE.Vector3();
    this.velocity=new THREE.Vector3();this.previousVelocity=new THREE.Vector3();
    this.acceleration=new THREE.Vector3();this.angular=new THREE.Vector3();
    this.quaternion=new THREE.Quaternion();this.previousQuaternion=new THREE.Quaternion();
    this.inverseQuaternion=new THREE.Quaternion();this.delta=new THREE.Quaternion();
    this.matrix=new THREE.Matrix4();this.inverse=new THREE.Matrix4();this.scale=new THREE.Vector3();this.origin=new THREE.Vector3();
    this.gravity=new THREE.Vector3();this.targets=Array.from({length:COUNT},()=>new THREE.Vector4(0,0,0,0));
    this.uniforms={skirtSections:{value:this.sections},skirtTime:{value:0},skirtEnergy:{value:0}};
    this.floors=new Map();
    for(const mesh of meshes){
      // Older morphs are retained in the source asset, but are superseded by
      // the independent section springs, so two deformations never accumulate.
      for(const name of ['SkirtSway','SkirtTwist','SkirtFlare']){
        const i=mesh.morphTargetDictionary?.[name];if(i!==undefined)mesh.morphTargetInfluences[i]=0;
      }
      const floor={plane:new THREE.Vector4(0,1,0,0),up:new THREE.Vector3(0,1,0)};this.floors.set(mesh,floor);
      const material=mesh.material,compile=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.onBeforeCompile=(shader,renderer)=>{
        compile.call(material,shader,renderer);
        Object.assign(shader.uniforms,this.uniforms,{skirtFloor:{value:floor.plane},skirtFloorUp:{value:floor.up}});
        shader.vertexShader=CLOTH_GLSL+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
          if(position.y<2.10){
            vec3 clothN=normalize(objectNormal);
            vec3 clothT=normalize(cross(abs(clothN.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.),clothN));
            vec3 clothB=cross(clothN,clothT);
            vec3 clothP=skirtPoint(position);
            objectNormal=normalize(cross(skirtPoint(position+clothT*.003)-clothP,skirtPoint(position+clothB*.003)-clothP));
          }
        `);
        shader.vertexShader=shader.vertexShader.replace('#include <morphtarget_vertex>','#include <morphtarget_vertex>\ntransformed=skirtPoint(transformed);');
        shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>',`#include <skinning_vertex>
          if(position.y<.95){float floorHeight=dot(skirtFloor.xyz,transformed)+skirtFloor.w;transformed+=skirtFloorUp*max(0.,.018-floorHeight);}
        `);
      };
      material.customProgramCacheKey=()=>key+'|section-cloth-2';material.needsUpdate=true;
      const cloth=this;
      mesh.getVertexPosition=function(index,target){
        THREE.Mesh.prototype.getVertexPosition.call(this,index,target);
        const hem=target.y<.95;cloth.deformLocal(target,target);this.applyBoneTransform(index,target);
        if(hem){const height=floor.plane.x*target.x+floor.plane.y*target.y+floor.plane.z*target.z+floor.plane.w;target.addScaledVector(floor.up,Math.max(0,.018-height));}
        return target;
      };
      mesh.geometry.computeBoundingSphere();mesh.boundingSphere=mesh.geometry.boundingSphere.clone();mesh.boundingSphere.radius+=.65;
    }
    this.readCarrier();this.previousPosition.copy(this.position);this.previousQuaternion.copy(this.quaternion);
  }

  readCarrier(){
    this.character.updateMatrixWorld(true);
    const mesh=this.meshes[0],i=mesh.skeleton.bones.findIndex(b=>b.name==='Body');
    this.matrix.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse)
      .multiply(mesh.skeleton.bones[i].matrixWorld).multiply(mesh.skeleton.boneInverses[i]).multiply(mesh.bindMatrix);
    this.position.set(0,1.65,.12).applyMatrix4(this.matrix);
    this.matrix.decompose(this.origin,this.quaternion,this.scale);
    this.inverseQuaternion.copy(this.quaternion).invert();
    for(const garment of this.meshes){
      const e=garment.matrixWorld.elements,floor=this.floors.get(garment);
      floor.plane.set(e[1],e[5],e[9],e[13]);
      this.inverse.copy(garment.matrixWorld).invert();const inv=this.inverse.elements;
      floor.up.set(inv[4],inv[5],inv[6]);garment.skeleton.update();
    }
  }

  update(delta,motion){
    if(delta<=0)return;
    const dt=Math.min(delta,.1),amount=(motion?.amplitude??1)*this.strength;
    this.readCarrier();this.time+=dt;
    // A WORLD-space quaternion difference captures both the rig turn and the
    // character parent's drag rotation. A local quaternion's y component does
    // not necessarily describe yaw on this imported rig.
    this.delta.copy(this.quaternion).multiply(this.previousQuaternion.clone().invert());
    if(this.delta.w<0)this.delta.set(-this.delta.x,-this.delta.y,-this.delta.z,-this.delta.w);
    const length=Math.hypot(this.delta.x,this.delta.y,this.delta.z);
    const angularScale=length>1e-7?2*Math.atan2(length,this.delta.w)/(length*dt):0;
    this.angular.set(this.delta.x,this.delta.y,this.delta.z).multiplyScalar(angularScale).applyQuaternion(this.inverseQuaternion).clampLength(0,8);
    this.velocity.subVectors(this.position,this.previousPosition).divideScalar(dt);
    this.acceleration.subVectors(this.velocity,this.previousVelocity).divideScalar(dt).applyQuaternion(this.inverseQuaternion).clampLength(0,18);
    if(!this.initialized){this.acceleration.set(0,0,0);this.angular.set(0,0,0);this.initialized=true;}
    this.previousVelocity.copy(this.velocity);this.previousPosition.copy(this.position);this.previousQuaternion.copy(this.quaternion);
    this.gravity.set(0,-1,0).applyQuaternion(this.inverseQuaternion);
    const omega=this.angular.y,activity=clamp(Math.abs(omega)*.24+this.angular.length()*.1+this.acceleration.length()*.025,0,1);
    this.energy=THREE.MathUtils.damp(this.energy,activity*amount,activity>this.energy?7:1.9,dt);
    for(let i=0;i<COUNT;i++){
      const u=i/(COUNT-1),free=u*u;
      // Weight and inertia bend the skirt below the waist; opening is driven by
      // rotational speed, while tangential lag changes sign with turn direction.
      this.targets[i].set(
        clamp(-this.acceleration.x*.025+this.gravity.x*.8+this.angular.z*.065,-.28,.28)*free*amount,
        clamp(-this.acceleration.z*.025+this.gravity.z*.8-this.angular.x*.065,-.25,.25)*free*amount,
        clamp(-omega*(.10+.065*u),-.52,.52)*free*amount,
        Math.min(.28,omega*omega*.027)*free*amount
      );
    }
    // Fixed small substeps keep drag interruptions and low frame rates stable.
    const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
    for(let step=0;step<steps;step++)for(let i=1;i<COUNT;i++){
      const u=i/(COUNT-1),frequency=13-7*u,damping=2*frequency*.48;
      for(let axis=0;axis<4;axis++){
        const p=this.sections[i].getComponent(axis),v=this.velocities[i].getComponent(axis);
        const next=v+(frequency*frequency*(this.targets[i].getComponent(axis)-p)-damping*v)*h;
        this.velocities[i].setComponent(axis,next);this.sections[i].setComponent(axis,p+next*h);
      }
    }
    this.uniforms.skirtTime.value=this.time;this.uniforms.skirtEnergy.value=this.energy;
    this.values=this.sections[COUNT-1].toArray();
  }

  reset(){
    this.sections.forEach(v=>v.set(0,0,0,0));this.velocities.forEach(v=>v.set(0,0,0,0));
    this.energy=0;this.uniforms.skirtEnergy.value=0;this.initialized=false;
    this.readCarrier();this.previousPosition.copy(this.position);this.previousQuaternion.copy(this.quaternion);this.previousVelocity.set(0,0,0);
  }

  deformLocal(point,target){
    target.copy(point);if(point.y>=TOP)return target;
    const x=point.x,y=point.y,z=point.z,u=clamp((TOP-y)/LENGTH,0,1),row=u*(COUNT-1),i=Math.min(Math.floor(row),COUNT-2),t=row-i;
    const a=this.sections[Math.max(0,i-1)],b=this.sections[i],c=this.sections[i+1],d=this.sections[Math.min(COUNT-1,i+2)];
    const sx=spline(a.x,b.x,c.x,d.x,t),sz=spline(a.y,b.y,c.y,d.y,t),angle=spline(a.z,b.z,c.z,d.z,t),flare=spline(a.w,b.w,c.w,d.w,t);
    const center=.02+.14*smooth((y-.6)/1.2),rz=z-center,radius=Math.hypot(x,rz),theta=Math.atan2(rz,x);
    const ripple=this.energy*u*u*u*(.018*Math.sin(theta*3-this.time*5.2+u*4)+.010*Math.sin(theta*5+this.time*6.4-u*7));
    const scale=1+Math.max(-.03,flare)+ripple/Math.max(radius,.12),co=Math.cos(angle),si=Math.sin(angle);
    return target.set((x*co-rz*si)*scale+sx,y+.22*Math.max(0,flare)*u+.28*(sx*sx+sz*sz)/Math.max(.3,u*LENGTH),center+(x*si+rz*co)*scale+sz);
  }
}

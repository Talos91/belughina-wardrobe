import * as THREE from 'three';

// Rest-space outlines of the eye openings, traced against the Rodin surface.
// The material extends well past these into the eyelids and cheek. An oval
// around the entire material leaves a pale ring when the skin is recolored.
const EYE_OPENINGS={
  left:[[.250,3.223],[.250,3.259],[.265,3.297],[.283,3.326],[.303,3.348],[.328,3.360],[.352,3.354],[.370,3.334],[.383,3.307],[.393,3.282],[.395,3.250],[.390,3.227],[.376,3.213],[.350,3.204],[.318,3.204],[.291,3.205],[.266,3.212]],
  right:[[.251,3.223],[.252,3.259],[.267,3.297],[.285,3.326],[.306,3.348],[.330,3.359],[.353,3.353],[.372,3.335],[.386,3.307],[.396,3.282],[.398,3.250],[.393,3.228],[.378,3.214],[.352,3.205],[.320,3.204],[.292,3.206],[.268,3.213]]
};

function skinWeight(x,y,outline) {
  let inside=false,distance=Infinity;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const [ax,ay]=outline[j],[bx,by]=outline[i];
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    const dx=bx-ax,dy=by-ay,t=THREE.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));
  }
  return inside?0:THREE.MathUtils.smoothstep(distance,0,.003);
}

// Keep the eye opening and dark lashes intact. Tint all surrounding skin with
// the same linear-space multiplier used by the body material.
export function installEyeSkinTint(character) {
  const tint={value:new THREE.Color(1,1,1)};
  const installed=new Set();
  character.traverse(mesh=>{
    if(!mesh.isMesh||mesh.material?.name.replace(/\.\d+$/,'')!=='Rodin eyes')return;
    const positions=mesh.geometry.getAttribute('position');
    const values=new Float32Array(positions.count);
    for(let i=0;i<values.length;i++) {
      const x=positions.getX(i);
      values[i]=skinWeight(Math.abs(x),positions.getY(i),x<0?EYE_OPENINGS.left:EYE_OPENINGS.right);
    }
    mesh.geometry.setAttribute('pearlSkin',new THREE.BufferAttribute(values,1));
    const mat=mesh.material;if(installed.has(mat))return;installed.add(mat);
    mat.onBeforeCompile=shader=>{
      shader.uniforms.pearlTint=tint;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float pearlSkin;\nvarying float vPearlSkin;');
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPearlSkin=pearlSkin;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 pearlTint;\nvarying float vPearlSkin;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float pearlLuminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        float pearlAmount=vPearlSkin*smoothstep(.012,.04,pearlLuminance);
        diffuseColor.rgb*=mix(vec3(1.0),pearlTint,pearlAmount);`);
    };
    mat.customProgramCacheKey=()=> 'beluga-eye-skin-v2';mat.needsUpdate=true;
  });
  return {setColor(color){tint.value.set(color||'#ffffff')}};
}

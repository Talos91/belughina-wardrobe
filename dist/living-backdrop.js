import * as THREE from 'three';

// Animate only scenery regions in the approved artwork. Architecture and the
// terrace floor stay registered to the character's contact plane.
export class LivingBackdrop {
  constructor(host) {
    this.host=host;this.time=0;this.elapsed=0;this.gentle=false;this.active=false;
    this.pointer=new THREE.Vector2();this.aim=new THREE.Vector2();
    this.canvas=document.createElement('canvas');this.canvas.className='living-scenery';this.canvas.setAttribute('aria-hidden','true');host.append(this.canvas);
    this.seeds=document.createElement('div');this.seeds.className='scenery-seeds';this.seeds.setAttribute('aria-hidden','true');host.append(this.seeds);
    for(let i=0;i<9;i++){const seed=document.createElement('i');seed.className='scenery-seed';seed.style.cssText=`--x:${47+i*6}%;--y:${18+(i*13)%48}%;--duration:${23+i*2.3}s;--delay:${-i*5.1}s;--drift:${34+i*9}px`;this.seeds.append(seed)}
    try {
      this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      this.uniforms={art:{value:null},cover:{value:new THREE.Vector2(1,1)},offset:{value:new THREE.Vector2()},clock:{value:0},pointer:{value:this.pointer},amount:{value:1}};
      this.material=new THREE.ShaderMaterial({uniforms:this.uniforms,depthTest:false,depthWrite:false,toneMapped:false,
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`uniform sampler2D art;uniform vec2 cover,offset,pointer;uniform float clock,amount;varying vec2 vUv;
          float box(vec2 p,vec2 a,vec2 b,float f){vec2 lo=smoothstep(a,a+f,p),hi=1.-smoothstep(b-f,b,p);return lo.x*lo.y*hi.x*hi.y;}
          void main(){
            vec2 p=vec2(vUv.x,1.-vUv.y)*cover+offset;
            vec3 source=texture2D(art,vec2(p.x,1.-p.y)).rgb;
            float far=box(p,vec2(.495,0.),vec2(1.03,.525),.045);
            float sky=far*(1.-smoothstep(.11,.165,p.y));
            float foliage=max(box(p,vec2(-.03,-.03),vec2(.10,.855),.025),box(p,vec2(.215,-.03),vec2(.47,.67),.04));
            foliage=max(foliage,box(p,vec2(.275,.16),vec2(.50,.49),.045));
            foliage=max(foliage,box(p,vec2(.825,-.04),vec2(1.04,.20),.035));
            float leaf=smoothstep(.015,.12,max(source.r,source.g)-source.b)*(1.-smoothstep(.035,.19,source.r-source.g));
            float breeze=sin(clock*.85+p.y*18.)*.68+sin(clock*1.37+p.x*24.)*.32;
            vec2 shift=vec2(.0025*breeze,.00065*sin(clock*.7+p.x*17.))*foliage*leaf;
            shift+=vec2(.006*sin(clock*.075),.0004*sin(clock*.14))*sky;
            shift+=pointer*vec2(.0028,.0014)*far;
            vec3 color=texture2D(art,vec2(p.x+shift.x*amount,1.-p.y-shift.y*amount)).rgb;
            float flame=exp(-dot((p-vec2(.216,.087))*vec2(65.,34.),(p-vec2(.216,.087))*vec2(65.,34.)));
            color+=vec3(.028,.012,.002)*flame*(.5+.3*sin(clock*3.1)+.2*sin(clock*7.7))*amount;
            gl_FragColor=vec4(color,1.);
            #include <colorspace_fragment>
          }`});
      this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material));
    }catch{this.canvas.remove();this.renderer=null}
    this.onPointer=e=>{if(e.pointerType==='mouse')this.aim.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1)};
    this.onLeave=()=>this.aim.set(0,0);this.onResize=()=>this.resize();
    window.addEventListener('pointermove',this.onPointer,{passive:true});document.addEventListener('pointerleave',this.onLeave);window.addEventListener('resize',this.onResize,{passive:true});
  }
  setPlace(id,image) {
    this.active=id==='tuscany';this.host.classList.toggle('is-living',this.active);this.canvas.hidden=!this.active;
    this.texture?.dispose();this.texture=null;
    if(this.active&&this.renderer){this.texture=new THREE.Texture(image);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.needsUpdate=true;this.uniforms.art.value=this.texture;this.image=image;this.resize();}
    this.preferences(this.gentle,this.sparkles);
  }
  preferences(gentle,sparkles=true) {
    this.gentle=gentle;this.sparkles=sparkles;this.seeds.hidden=!this.active||gentle||!sparkles;
    if(this.uniforms)this.uniforms.amount.value=gentle?0:1;
    this.draw();
  }
  resize() {
    if(!this.active||!this.renderer||!this.image)return;
    const width=innerWidth,height=innerHeight,scale=Math.max(width/this.image.width,height/this.image.height);
    this.uniforms.cover.value.set(width/(this.image.width*scale),height/(this.image.height*scale));
    this.uniforms.offset.value.set((1-this.uniforms.cover.value.x)*.5,(1-this.uniforms.cover.value.y)*.5);
    const quality=Math.min(1,1600/width,1000/height);this.renderer.setSize(Math.round(width*quality),Math.round(height*quality),false);this.draw();
  }
  update(dt) {
    if(!this.active||this.gentle)return;
    this.time+=dt;this.elapsed+=dt;this.pointer.lerp(this.aim,1-Math.exp(-dt*2));
    if(this.elapsed<1/24)return;this.elapsed=0;if(this.uniforms)this.uniforms.clock.value=this.time;this.draw();
  }
  draw(){if(this.active&&this.renderer&&this.texture)this.renderer.render(this.scene,this.camera)}
}

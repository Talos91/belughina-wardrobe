import {createKeepsakeLetter} from './keepsake-letter.js?v=wardrobe-clear-15';
import {CharacterPicker} from './character-picker.js?v=wardrobe-clear-15';
import {createSalamiGreetings} from './salami-lines.js?v=wardrobe-clear-15';
import {SalamiSummon} from './salami-summon.js?v=wardrobe-clear-15';
import {SalamiScene} from './salami-scene.js?v=wardrobe-clear-15';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from './vendor/libs/meshopt_decoder.module.js';
import {installEyeSkinTint} from './eye-skin.js?v=wardrobe-clear-15';
import {LivingBackdrop} from './living-backdrop.js?v=wardrobe-clear-15';
import {TailGrounding,createContactShadows} from './tail-grounding.js?v=wardrobe-clear-15';
import {CharacterMotion} from './character-motion.js?v=wardrobe-clear-15';
import {WardrobeAssets} from './wardrobe-assets.js?v=wardrobe-clear-15';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {DRESSES,CLOTHES,ITEMS,OUTFITS,EXTRAS,PLACES,PALETTE,DEFAULT_STATE,sanitizeState,equipOutfit,equipClothing,toggleExtra,randomLook,activeItems,lookName,thumbnail} from './wardrobe-state.js?v=wardrobe-clear-15';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const STORAGE='beluga-wardrobe-v1',LOOKS='beluga-looks-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
let state=sanitizeState(read(STORAGE,DEFAULT_STATE));
if(!read(STORAGE,null)&&matchMedia('(prefers-reduced-motion: reduce)').matches)state.gentle=true;
const loveLetter=createKeepsakeLetter({storageKey:'beluga-letter-v1',gentle:()=>state.gentle});
let summonedSalami,salamiLoader,salamiLoadPromise,wasSummonReady=false,summonCameraScale=1;
let tab='dresses',colorTarget='base',part='primary',character,characterPicker,motion,grounding,contactShadows,eyeSkinTint,wardrobeAssets,yaw=-.13,targetYaw=-.13,soundEnabled=false,audioContext,speechTimer,toastTimer,photoSnapshot;
const livingBackdrop=new LivingBackdrop($('#backdrop'));
const salami=new SalamiScene($('#salami-scene'));
$('#color-toggle').onclick=()=>{$('#color-panel').showModal();$('#color-toggle').setAttribute('aria-expanded','true')};
$('#color-panel').addEventListener('close',()=>$('#color-toggle').setAttribute('aria-expanded','false'));
$('#browse-toggle').onclick=()=>{document.body.classList.toggle('picker-expanded');renderItems()};
$$('[data-performance]').forEach(button=>button.onclick=()=>{$('.performance-panel').dataset.mode=button.dataset.performance;$$('[data-performance]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))});
for(const [id,dir] of [['items-prev',-1],['items-next',1]])$('#'+id).onclick=()=>$('#items').scrollBy({left:dir*$('#items').clientWidth*.75,behavior:state.gentle?'instant':'smooth'});
const materials=new Map(),originalColors=new Map();
const savedRaw=read(LOOKS,[]);let looks=Array.isArray(savedRaw)?savedRaw.filter(x=>x&&typeof x==='object'&&x.state).slice(0,24).map(x=>({...x,state:sanitizeState(x.state)})):[];
const base='/'; // All assets are served from the same private Site.
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch{toast('This browser couldn’t save your choices.')}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800)}
const nextSalamiGreeting=createSalamiGreetings();
let salamiSpeechUntil=0;
const salamiSpeechPoint=new THREE.Vector3();
function saySalami(){salamiSpeechUntil=performance.now()+3600;$('#salami-speech').textContent=nextSalamiGreeting();$('#salami-speech').classList.add('visible')}
function updateSalamiSpeech(){const visible=performance.now()<salamiSpeechUntil&&summonedSalami?.root.visible;if(!visible){$('#salami-speech').classList.remove('visible');return;}salamiSpeechPoint.copy(summonedSalami.root.position);salamiSpeechPoint.y+=.80;salamiSpeechPoint.project(camera);$('#salami-speech').style.left=((salamiSpeechPoint.x+1)*50)+'%';$('#salami-speech').style.top=((1-salamiSpeechPoint.y)*50)+'%';}
function say(message,duration=2600){$('#speech').textContent=message;$('#speech').classList.add('visible');clearTimeout(speechTimer);speechTimer=setTimeout(()=>$('#speech').classList.remove('visible'),duration)}
function chime(kind='soft'){
 if(!soundEnabled)return;try{audioContext??=new AudioContext();audioContext.resume();const now=audioContext.currentTime;[523.25,659.25,783.99].slice(0,kind==='soft'?1:3).forEach((frequency,i)=>{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,now+i*.08);gain.gain.linearRampToValueAtTime(.06,now+i*.08+.02);gain.gain.exponentialRampToValueAtTime(.001,now+i*.08+.5);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now+i*.08);osc.stop(now+i*.08+.55)})}catch{soundEnabled=false}}
function currentTarget(){return colorTarget}
function currentParts(){return colorTarget==='hair'?[['primary','Hair color']]:ITEMS.find(x=>x.id===colorTarget).parts}
function renderItems(){
 const slot=tab==='tops'?'top':tab==='bottoms'?'bottom':null;
 const list=tab==='room'?PLACES:tab==='dresses'?DRESSES:slot?CLOTHES.filter(x=>x.slot===slot):EXTRAS;
 if(list.length<=3)document.body.classList.remove('picker-expanded');
 $('#browse-toggle').hidden=list.length<=3;
 const expanded=document.body.classList.contains('picker-expanded');
 $('#browse-toggle').textContent=expanded?'Show less ↑':`See all ${list.length} ↓`;
 $('#browse-toggle').setAttribute('aria-expanded',String(expanded));
 $('#category-title').textContent={dresses:'Dresses',tops:'Tops',bottoms:'Bottoms',extras:'Accessories',room:'Choose a room'}[tab];
 $('#clear-outfit').hidden=tab==='room';$('#wardrobe-tools').hidden=tab==='room';
 if(tab==='room'){$('#color-panel').close();$('#color-toggle').setAttribute('aria-expanded','false')}
 const box=$('#items'),scroll=box.scrollTop,focused=box.contains(document.activeElement)?document.activeElement.dataset.id:null;
 box.replaceChildren();box.setAttribute('aria-labelledby','tab-'+tab);
 $('#clothes-slots').hidden=true;
 const empty=slot?!state[slot]:tab==='extras'?!state.extras.length:state.outfit==='base';
 $('#clear-outfit').textContent=slot?'No '+slot:tab==='extras'?'Clear extras':'No dress';
 $('#clear-outfit').setAttribute('aria-pressed',String(empty));
 for(const item of list){
  const b=document.createElement('button');b.className='item';b.type='button';b.dataset.id=item.id;
  const selected=tab==='room'?state.place===item.id:activeItems(state).includes(item.id);
  b.setAttribute('aria-pressed',String(selected));
  b.setAttribute('aria-label',item.name+(item.description?', '+item.description:''));
  const img=document.createElement('img');img.src=tab==='room'?`./assets/thumbnails/room-${item.id}.webp`:thumbnail(item.id);if(tab==='room')b.dataset.room='true';img.alt='';img.draggable=false;b.append(img);
  const label=document.createElement('span');label.className='item-label';label.textContent=item.name;b.append(label);
  const badge=document.createElement('span');badge.className='item-check';badge.textContent='✓';badge.setAttribute('aria-hidden','true');b.append(badge);
  const status=document.createElement('span');status.className='item-state';status.textContent=selected?(tab==='room'?'Selected':'Wearing'):'';status.setAttribute('aria-hidden','true');b.append(status);
  b.addEventListener('click',()=>tab==='room'?setPlace(item.id):selectItem(item.id));box.append(b);
 }
 box.scrollTop=scroll;if(focused)box.querySelector(`[data-id="${focused}"]`)?.focus({preventScroll:true});
 $('#glasses-position').hidden=tab!=='extras'||!state.extras.includes('sunglasses');$$('#glasses-position button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.position===state.glassesPosition)));
 $('#worn-summary').textContent=tab==='room'?PLACES.find(x=>x.id===state.place).name:slot?(ITEMS.find(x=>x.id===state[slot])?.name||'Choose a '+slot):tab==='extras'?(state.extras.length?state.extras.length+' accessories on':'Pick a little finishing touch'):state.outfit==='base'?'Try a dress, or mix tops & bottoms':lookName(state);renderColors();
}
function renderColors(){const targets=['base','hair',...activeItems(state)];if(!targets.includes(colorTarget))colorTarget=targets.at(-1)||'base';const targetSelect=$('#color-target');targetSelect.replaceChildren();for(const id of targets){const opt=document.createElement('option');opt.value=id;opt.textContent=id==='hair'?'Her hair':id==='base'?'Her pearl skin':ITEMS.find(x=>x.id===id).name;targetSelect.append(opt)}targetSelect.value=colorTarget;const parts=currentParts();if(!parts.some(([id])=>id===part))part=parts[0][0];const select=$('#color-part');select.replaceChildren();for(const [id,label] of parts){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.append(opt)}select.value=part;const container=$('#swatches');container.replaceChildren();const value=state.colors[currentTarget()+'_'+part];for(const [label,color] of PALETTE){const button=document.createElement('button');button.className='swatch';button.style.setProperty('--swatch-color',color);button.textContent=label;button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(value===color));button.onclick=()=>setColor(color);container.append(button)}const custom=document.createElement('label');custom.className='swatch custom';custom.title='Choose any color';custom.append(document.createTextNode('Custom')); const input=document.createElement('input');input.type='color';input.value=value||'#b4a5d1';input.setAttribute('aria-label','Choose a custom color');input.oninput=()=>setColor(input.value,false);input.onchange=()=>renderColors();custom.append(input);container.append(custom)}
function setColor(color,render=true){state.colors[currentTarget()+'_'+part]=color;applyCharacter();persist();if(render)renderColors()}
function selectItem(id){
 if(tab==='dresses')state=equipOutfit(state,state.outfit===id?'base':id);
 else if(tab==='tops'||tab==='bottoms')state=equipClothing(state,id);
 else state=toggleExtra(state,id);
 colorTarget=activeItems(state).includes(id)?id:'base';part='primary';
 const wanted=JSON.stringify(activeItems(state));
 applyCharacter().then(ready=>{if(ready&&wanted===JSON.stringify(activeItems(state))){play('dress');if(tab!=='extras')say('How do I look? ♡')}});
 persist();renderItems();chime();
}
$$('#glasses-position button').forEach(b=>b.onclick=()=>{state={...state,glassesPosition:b.dataset.position};applyCharacter();persist();renderItems();chime()});
$('#clear-outfit').onclick=()=>{state=tab==='tops'?{...state,top:null}:tab==='bottoms'?{...state,bottom:null}:tab==='extras'?{...state,extras:[]}:state.outfit!=='base'?equipOutfit(state,'base'):state;colorTarget='base';applyCharacter();persist();renderItems()};
$('#color-target').onchange=e=>{colorTarget=e.target.value;part='primary';renderColors()};
function switchTab(id){tab=id;$('#items').scrollTop=0;$('#items').scrollLeft=0;part='primary';$$('.tabs button').forEach(b=>{const yes=b.dataset.tab===id;b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1});renderItems()}
$$('.tabs button').forEach(b=>{b.onclick=()=>switchTab(b.dataset.tab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=$$('.tabs button').filter(t=>!t.disabled);let i=tabs.indexOf(b);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;switchTab(tabs[i].dataset.tab);tabs[i].focus()}});
$('#color-part').onchange=e=>{part=e.target.value;renderColors()};$('#reset-color').onclick=()=>{delete state.colors[currentTarget()+'_'+part];applyCharacter();persist();renderColors();chime()};
let placeRequest=0;
async function setPlace(id,initial=false){if(!PLACES.some(p=>p.id===id))return;const request=++placeRequest;const img=new Image();img.src=`./assets/backgrounds/${id}.webp`;try{await img.decode()}catch{toast('That scenery could not load. Try again.');return}if(request!==placeRequest)return;state.place=id;document.documentElement.dataset.theme=id;$('#backdrop').dataset.framing=['bedroom','resort','villa','manor','starlight','cafe'].includes(id)?'notes':'center';$('#backdrop').style.backgroundImage=`url("${img.src}")`;$('#place-current').textContent=PLACES.find(p=>p.id===id).name;$$('.place').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));livingBackdrop.setPlace(id,img);salami.setPlace(id,img);if(tab==='room')renderItems();livingBackdrop.preferences(state.gentle,state.sparkles);persist();if(!initial)chime();if(renderer)renderer.toneMappingExposure=['moonlit','manor','starlight'].includes(id)?.94:.98;renderAmbient()}
for(const p of PLACES){const b=document.createElement('button');b.className='place';b.dataset.id=p.id;b.title=p.name;b.setAttribute('aria-label',p.name);b.setAttribute('aria-pressed',String(p.id===state.place));b.style.backgroundImage=`url(./assets/thumbnails/room-${p.id}.webp)`;b.onclick=()=>setPlace(p.id);$('#places').append(b)}
function renderAmbient(){livingBackdrop.preferences(state.gentle,state.sparkles);$$('.ambient-star').forEach(e=>e.remove());if(!state.sparkles||state.gentle)return;for(let i=0;i<9;i++){const span=document.createElement('span');span.className='ambient-star';span.textContent='✧';span.style.cssText=`left:${12+(i*17)%80}%;top:${10+(i*23)%65}%;animation-delay:${i*.61}s`;$('#particles').append(span)}}
function burst(symbol='♡'){if(state.gentle)return;for(let i=0;i<7;i++){const p=document.createElement('span');p.className='particle';p.textContent=symbol;p.style.cssText=`left:${42+Math.random()*25}%;top:${22+Math.random()*25}%;animation-delay:${i*.09}s`;$('#particles').append(p);setTimeout(()=>p.remove(),2900)}}
function play(type){if(!motion)return;if(['relaxed','little','tada'].includes(type)){motion.setPose(type);if(type!=='relaxed')chime();return}motion.play(type);if(type==='wave'){say('Hello, you ♡');chime('happy')}if(type==='twirl')chime('happy');if(type==='delight'){say('Oh, I love this one ♡');chime()}if(type==='reveal'){say('Ta-da! What do you think?');chime('happy')}if(type==='kiss'){say('This one’s for you ♡');chime('happy')}if(type==='wiggle'){say('A very good day for a wiggle!');burst('✧');chime('happy')}if(type==='boop'){say('Mmm… more little boops, please ♡',5500);burst();chime('happy')}}
$$('[data-action]').forEach(b=>b.onclick=()=>play(b.dataset.action));$('#surprise').onclick=()=>{state=randomLook(state);applyCharacter().then(ready=>{if(ready)play('dress')});renderItems();persist();say('A little surprise, just for you.');chime('happy')};
$('#sound').onclick=()=>{soundEnabled=!soundEnabled;$('#sound').setAttribute('aria-pressed',String(soundEnabled));$('#sound').setAttribute('aria-label',soundEnabled?'Turn sound off':'Turn sound on');$('.sound-off').hidden=soundEnabled;chime('happy')};
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
$('#settings-button').onclick=()=>{$('#gentle-motion').checked=state.gentle;$('#sparkles').checked=state.sparkles;$('#settings-dialog').showModal()};$('#gentle-motion').onchange=e=>{state.gentle=e.target.checked;motion?.setGentle(state.gentle);persist();renderAmbient()};$('#sparkles').onchange=e=>{state.sparkles=e.target.checked;persist();renderAmbient()};$('#reset-view').onclick=()=>{targetYaw=-.13;toast('Back to your lovely self.');$('#settings-dialog').close()};
$('#save-look').onclick=()=>{if(!character)return;const look={id:crypto.randomUUID(),name:lookName(state),date:new Date().toISOString(),state:structuredClone(state)};looks.unshift(look);looks=looks.slice(0,24);try{localStorage.setItem(LOOKS,JSON.stringify(looks));toast('Your look is saved ♡');chime('happy')}catch{toast('This browser couldn’t save your look.')}};
function renderLooks(){const list=$('#saved-list');list.replaceChildren();if(!looks.length){const p=document.createElement('p');p.className='empty-looks';p.textContent='A favorite outfit belongs here. Try “Save look”.';list.append(p);return}for(const look of looks){const row=document.createElement('div');row.className='saved-row';const img=document.createElement('img');img.src=thumbnail(look.state.outfit!=='base'?look.state.outfit:look.state.top||look.state.bottom||'base');img.alt='';row.append(img);const meta=document.createElement('div');meta.className='saved-meta';const title=document.createElement('strong');title.textContent=look.name;const sub=document.createElement('small');sub.textContent=PLACES.find(p=>p.id===look.state.place).name;meta.append(title,sub);row.append(meta);const wear=document.createElement('button');wear.textContent='Wear';wear.onclick=()=>{state=sanitizeState(look.state);applyCharacter().then(ready=>{if(ready)play('dress')});setPlace(state.place);renderItems();persist();$('#saved-dialog').close()};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Remove saved '+look.name);del.onclick=()=>{looks=looks.filter(l=>l.id!==look.id);try{localStorage.setItem(LOOKS,JSON.stringify(looks))}catch{}renderLooks()};row.append(wear,del);list.append(row)}}
$('#saved-button').onclick=()=>{renderLooks();$('#saved-dialog').showModal()};

const canvas=$('#viewport');let renderer,scene,camera;let lastFrame=null;let backgroundPhoto;
function syncSummon(){
 const ready=Boolean(state.extras.includes('tote')&&wardrobeAssets?.shown.has('tote'));
 summonedSalami?.setEquipped(ready);$('#summon-salami').hidden=!ready;
 if(ready&&!wasSummonReady&&!state.gentle)$('#summon-salami').animate([{transform:'scale(.72)',opacity:0},{transform:'scale(1.10)',opacity:1,offset:.60},{transform:'scale(1)',opacity:1}],{duration:650,easing:'cubic-bezier(.2,.8,.3,1)'});wasSummonReady=ready;
 $('#summon-salami').disabled=!ready||Boolean(salamiLoadPromise)||Boolean(summonedSalami?.busy);
 $('#summon-salami').setAttribute('aria-busy',String(Boolean(salamiLoadPromise||summonedSalami?.busy)));
}
async function ensureSalami(){
 if(summonedSalami?.visual)return true;
 if(salamiLoadPromise)return salamiLoadPromise;
 if(!salamiLoader||!summonedSalami)return false;
 salamiLoadPromise=salamiLoader.loadAsync('./assets/models/salami.glb?v=wardrobe-clear-15').then(file=>{summonedSalami.setVisual(file.scene);return true}).catch(error=>{console.error(error);toast('Salami couldn’t arrive. Tap Summon to try again.');return false}).finally(()=>{salamiLoadPromise=null;syncSummon()});
 syncSummon();return salamiLoadPromise;
}
$('#summon-salami').onclick=async()=>{if(await ensureSalami()&&summonedSalami?.summon({gentle:state.gentle})){salamiSpeechUntil=0;syncSummon();chime('happy');say('Special delivery ♡')}};
async function applyCharacter(){
 if(!character)return false;
 eyeSkinTint?.setColor(state.colors.base_primary);motion?.setGentle(state.gentle);
 character.traverse(o=>{if(o.name.startsWith('Outfit_')||o.name.startsWith('WeekendSleeve')||o.name.startsWith('Extra_'))o.visible=false;});
 for(const [name,list] of materials){const color=state.colors[name];for(const mat of list)mat.color.copy(color?new THREE.Color(color):originalColors.get(mat.uuid))}
 $('#pose-label').textContent=lookName(state);
 if(state.extras.includes('tote'))void ensureSalami();
 syncSummon();const ready=await wardrobeAssets.apply(state);syncSummon();return ready;
}
function rotate(delta){targetYaw+=delta}$('#rotate-left').onclick=()=>rotate(-.4);$('#rotate-right').onclick=()=>rotate(.4);canvas.onkeydown=e=>{if(e.key==='ArrowLeft'){e.preventDefault();rotate(-.2)}if(e.key==='ArrowRight'){e.preventDefault();rotate(.2)}if(e.key.toLowerCase()==='b')play('boop')};
let pointer=null;canvas.onpointerdown=e=>{pointer={x:e.clientX,y:e.clientY,last:e.clientX,moved:false};canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!pointer)return;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)pointer.moved=true;if(pointer.moved){targetYaw+=(e.clientX-pointer.last)*.009;motion?.cancel()}pointer.last=e.clientX};canvas.onpointerup=e=>{if(pointer&&!pointer.moved&&character){const r=canvas.getBoundingClientRect();const pos=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const gesture=characterPicker?.pick(pos,camera);if(gesture)play(gesture)}pointer=null};canvas.onpointercancel=()=>pointer=null;
function animate(ms){
 if(!renderer)return;requestAnimationFrame(animate);
 const delta=lastFrame===null?0:Math.min((ms-lastFrame)/1000,.1);lastFrame=ms;
 if(document.hidden)return;
 livingBackdrop.update(delta);if(character){yaw=THREE.MathUtils.damp(yaw,targetYaw,9,delta);character.rotation.y=yaw;motion?.update(delta);grounding?.update(motion);wardrobeAssets?.update(delta,motion);summonedSalami?.update(delta);syncSummon();const framing=summonedSalami?.framingScale??1;if(framing!==summonCameraScale){camera.zoom*=framing/summonCameraScale;summonCameraScale=framing;camera.updateProjectionMatrix()}if(grounding)contactShadows?.update(grounding)}
 updateSalamiSpeech();renderer.render(scene,camera);
}
document.addEventListener('visibilitychange',()=>{lastFrame=null});
async function init3D(){try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:false});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.5:2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;scene=new THREE.Scene();const pmrem=new THREE.PMREMGenerator(renderer);const environment=new RoomEnvironment();scene.environment=pmrem.fromScene(environment,.04).texture;scene.environmentIntensity=.45;environment.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xfff0dd,0x8b7fa0,.8));const key=new THREE.DirectionalLight(0xffe7d2,2.2);key.position.set(-3,5,4);scene.add(key);const fill=new THREE.DirectionalLight(0xd4ddff,.7);fill.position.set(3,3,-2);scene.add(fill);camera=new THREE.PerspectiveCamera(31,1,.01,100);camera.position.set(0,2.25,8.1);camera.lookAt(0,2.05,0);const resize=()=>{const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;const halfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));camera.position.z=Math.max(4.55/(2*halfFov),3.3/(2*halfFov*camera.aspect));camera.lookAt(0,2.05,0);camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(canvas.parentElement);resize();
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const gltf=await loader.loadAsync('./assets/models/beluga.glb?v=wardrobe-clear-15',progress=>{const text=$('#loading p');if(text)text.textContent=progress.total?`Waking up… ${Math.round(progress.loaded/progress.total*100)}%`:'Waking up…';});character=gltf.scene;characterPicker=new CharacterPicker(character);eyeSkinTint=installEyeSkinTint(character);character.traverse(o=>{if(o.name.startsWith('Outfit_'))o.visible=false});scene.add(character);grounding=new TailGrounding(character);contactShadows=createContactShadows(scene);character.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list){if(!m.color)continue;if(!originalColors.has(m.uuid))originalColors.set(m.uuid,m.color.clone());const key=m.name.replace(/\.\d+$/,'');if(!materials.has(key))materials.set(key,[]);if(!materials.get(key).includes(m))materials.get(key).push(m)}}});wardrobeAssets=new WardrobeAssets(character,loader,{onLoading:loading=>{$('#wardrobe-loading').hidden=!loading},onError:()=>toast('That piece couldn’t load. Select it again to retry.')});motion=new CharacterMotion(character,gltf.animations,{onSignal:type=>{if(type==='kiss')burst();if(type==='reveal')burst('✧')},onChange:type=>{$$('[data-action]').forEach(button=>button.classList.toggle('is-playing',button.closest('.poses')?button.dataset.action===motion.selectedPose:button.dataset.action===type))}});motion.setGentle(state.gentle);summonedSalami=new SalamiSummon(scene,wardrobeAssets,{onLand:()=>{syncSummon();saySalami();loveLetter.discover()}});salamiLoader=loader;applyCharacter();$('#loading').hidden=true;requestAnimationFrame(animate);setTimeout(()=>say('Oh, there you are ♡'),800);
 }catch(error){console.error(error);$('#loading').classList.add('error');$('#loading').replaceChildren();const p=document.createElement('p');p.textContent='Our little beluga couldn’t load.';const b=document.createElement('button');b.textContent='Try again';b.onclick=()=>location.reload();$('#loading').append(p,b)}}
function drawCover(ctx,img,w,h){const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,(w-img.width*scale)/2,(h-img.height*scale)/2,img.width*scale,img.height*scale)}
$('#photo').onclick=async()=>{if(!character)return;try{const bg=new Image();bg.src=`./assets/backgrounds/${state.place}.webp`;await bg.decode();const out=document.createElement('canvas');out.width=1200;out.height=1200;const c=out.getContext('2d');drawCover(c,bg,1200,1200);await salami.drawPhoto(c,bg,1200,1200);renderer.render(scene,camera);const h=1160,w=h*canvas.width/canvas.height;c.drawImage(canvas,(1200-w)/2,-20,w,h);photoSnapshot=out;$('#photo-preview').src=out.toDataURL('image/png');$('#photo-caption').value='';$('#photo-dialog').showModal();chime()}catch{toast('The photo couldn’t be made. Please try again.')}};
$('#download-photo').onclick=()=>{if(!photoSnapshot)return;const out=document.createElement('canvas');out.width=1200;out.height=1280;const c=out.getContext('2d');c.fillStyle='#fff8ef';c.fillRect(0,0,1200,1280);c.drawImage(photoSnapshot,24,24,1152,1152);c.fillStyle='#6a4b65';c.font='28px Georgia';c.textAlign='center';c.fillText($('#photo-caption').value||'A little moment with you ♡',600,1230,1120);out.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='beluga-little-keepsake.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')};
renderItems();setPlace(state.place,true);init3D();

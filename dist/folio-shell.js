// A live paper folio around the existing wardrobe and WebGL scene.
const $=s=>document.querySelector(s);
const icon=name=>name==='shirt'?'<svg class="icon" viewBox="0 0 28 28" aria-hidden="true"><path d="M11 7a3 3 0 1 1 5 2c-1 1-2 1.5-2 3l10 6a2 2 0 0 1-1 4H5a2 2 0 0 1-1-4l10-6"/></svg>':`<svg class="icon" aria-hidden="true"><use href="./assets/icons.svg?v=folio-release-4#${name}"/></svg>`;
const nav=document.createElement('nav');nav.className='destinations';nav.setAttribute('aria-label','Main navigation');
nav.innerHTML=[['wardrobe','shirt','Wardrobe'],['room','room','Room'],['play','reveal','Play'],['looks','heart','Looks']].map(([id,symbol,label])=>`<button type="button" data-destination="${id}" aria-pressed="${id==='wardrobe'}">${icon(symbol)}<span>${label}</span></button>`).join('');
$('.topbar').insertBefore(nav,$('.top-actions'));
const folio=$('.wardrobe');folio.classList.add('folio');
folio.insertAdjacentHTML('afterbegin','<div class="folio-spine" aria-hidden="true"><i></i><i></i><i></i></div><button type="button" class="drawer-handle" id="drawer-handle" aria-expanded="true" aria-label="Collapse wardrobe"><span></span></button><div class="folio-title"><h1>Your wardrobe</h1><p>A little mix, a little match.</p></div>');
const tabs=$('.tabs');tabs.innerHTML=[['dresses','dress','Dresses'],['outfits','shirt','Outfits'],['extras','extras','Accessories']].map(([id,symbol,label])=>`<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="items" aria-selected="${id==='outfits'}" tabindex="${id==='outfits'?0:-1}">${icon(symbol)}<span>${label}</span></button>`).join('');
$('.folio-title').after(tabs);
const footer=document.createElement('div');footer.className='folio-footer';
footer.innerHTML=`<button type="button" class="folio-undo" id="undo-look" disabled><span aria-hidden="true">↶</span> Undo</button>`;
const save=$('#save-look');save.innerHTML=icon('heart')+'<span>Save this look</span>';footer.append(save);footer.prepend($('#wardrobe-tools'));folio.append(footer);
const selected=document.createElement('div');selected.id='finishing-touches';selected.className='finishing-touches';$('.carousel').after(selected);
document.querySelectorAll('.poses [data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action==='relaxed')));
const performance=$('.performance-panel');performance.classList.add('folio-play');footer.before(performance);
$('.rotate-hint span').textContent='Front view';$('.rotate-hint span').outerHTML='<button type="button" id="front-view">Front view</button>';
$('#photo').insertAdjacentHTML('beforeend','<span>Photo</span>');
const photoControls=document.createElement('div');photoControls.className='photo-controls';photoControls.innerHTML=`<button type="button" id="photo-return">← Return</button><div class="photo-capture-bar"><button type="button" data-framing="portrait" aria-pressed="true">Portrait</button><button type="button" id="photo-capture" aria-label="Capture photo">${icon('camera')}</button><button type="button" data-framing="landscape" aria-pressed="false">Landscape</button></div>`;document.body.append(photoControls);document.body.dataset.photoFraming='portrait';
$('#summon-salami').querySelector('span').innerHTML='<img src="./assets/folio/salami.png" alt="">';
document.body.dataset.destination='wardrobe';document.body.dataset.drawer='expanded';

export function connectFolio({navigate,undo,front,removeExtra}){
 document.querySelectorAll('button[data-destination]').forEach(b=>b.onclick=()=>navigate(b.dataset.destination));
 $('#drawer-handle').onclick=()=>{const expanded=document.body.dataset.drawer!=='expanded';document.body.dataset.drawer=expanded?'expanded':'collapsed';$('#drawer-handle').setAttribute('aria-expanded',String(expanded));$('#drawer-handle').setAttribute('aria-label',expanded?'Collapse wardrobe':'Expand wardrobe');};
 $('#undo-look').onclick=undo;$('#front-view').onclick=front;
 $('#finishing-touches').addEventListener('click',e=>{const b=e.target.closest('[data-remove-extra]');if(b)removeExtra(b.dataset.removeExtra)});
}
export function renderFolio({destination,tab,extras,canUndo,thumbnail}){
 document.body.dataset.destination=destination;document.body.dataset.wardrobeTab=tab;
 document.querySelectorAll('button[data-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.destination===destination)));
 $('.folio-title h1').textContent=destination==='room'?'Pick a room':destination==='play'?'Bring her to life':'Your wardrobe';
 $('.folio-title p').textContent=destination==='room'?'A lovely place to be.':destination==='play'?'A little personality, a lot of love.':'A little mix, a little match.';
 $('#undo-look').disabled=!canUndo;
 const box=$('#finishing-touches');box.replaceChildren();box.hidden=!extras.length||tab!=='outfits'||destination!=='wardrobe';
 if(!box.hidden){const label=document.createElement('h2');label.textContent='Finishing touches';box.append(label);const row=document.createElement('div');row.className='extras-chips';for(const item of extras){const b=document.createElement('button');b.type='button';b.dataset.removeExtra=item.id;b.setAttribute('aria-label','Remove '+item.name);const img=document.createElement('img');img.src=thumbnail(item.id);img.alt='';const name=document.createElement('span');name.textContent=item.name;const cross=document.createElement('span');cross.textContent='×';cross.className='chip-remove';b.append(img,name,cross);row.append(b)}box.append(row)}
}

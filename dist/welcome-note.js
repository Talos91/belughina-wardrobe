export const WELCOME_PARAGRAPHS=[
 'If you are reading this, you must be the real-life beluga!',
 "Welcome to Belughina's Little Wardrobe, a fun minigame where you can dress up this cute beluga.",
 'But something… ehm ehm… someone else is hidden in this wardrobe. Will you be able to find it?',
 'Have fun!'
];

export function showWelcome({storageKey='beluga-welcome-v1',gentle=()=>false}={}){
 let storage;try{storage=window.localStorage;if(storage.getItem(storageKey)==='seen')return;}catch{}
 const dialog=document.createElement('dialog');dialog.className='welcome-note';dialog.setAttribute('aria-labelledby','welcome-title');
 const ornament=document.createElement('div');ornament.className='welcome-seal';ornament.textContent='♡';ornament.setAttribute('aria-hidden','true');dialog.append(ornament);
 const heading=document.createElement('h1');heading.id='welcome-title';heading.textContent='Hello there!';dialog.append(heading);
 const copy=document.createElement('div');copy.className='welcome-copy';
 for(const text of WELCOME_PARAGRAPHS){const p=document.createElement('p');p.textContent=text;copy.append(p);}dialog.append(copy);
 const start=document.createElement('button');start.type='button';start.className='welcome-start';start.textContent='Let’s play';dialog.append(start);
 for(let i=0;i<7;i++){const star=document.createElement('span');star.className='note-sparkle';star.textContent=i%3?'✧':'♡';star.setAttribute('aria-hidden','true');star.style.setProperty('--i',i);dialog.append(star);}
 dialog.classList.toggle('gentle',gentle());document.body.append(dialog);
 start.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{try{storage?.setItem(storageKey,'seen');}catch{}dialog.remove();document.querySelector('.destinations button')?.focus({preventScroll:true});},{once:true});
 dialog.showModal();start.focus({preventScroll:true});
}

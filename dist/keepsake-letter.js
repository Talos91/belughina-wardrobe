export const LETTER_PARAGRAPHS=[
 'Congratulations on finding THE SALAMI. I hope you enjoyed this little thing I did for our monthversary.',
 "I want you to know how important you are to me and how much I love you. You are not just my sweet amazing belughina, you are also a source of inspiration (like this cute game I made for you). Then again, I probably had a lot of free time to make it, because I know it has only been 2 days since you left but I miss you already, and I can't wait for you to be back to do botox and whatever other activities possibly not involving syringes ehehehe",
 'Thanks belughina for being the fantastic person you are, and I promise you that this salami will keep doing everything in his power to make sure you are the happiest mammal in the universe.',
 'To many more cringey monthversary celebrations, and to us.'
];

export class LetterUnlock{
 constructor(storage,key='beluga-letter-v1'){
  this.storage=storage;this.key=key;this.unlocked=false;
  try{this.unlocked=storage?.getItem(key)==='unlocked';}catch{}
 }
 discover(){
  if(this.unlocked)return false;
  this.unlocked=true;try{this.storage?.setItem(this.key,'unlocked');}catch{}
  return true;
 }
}

export function createKeepsakeLetter({storageKey='beluga-letter-v1',gentle=()=>false}={}){
 let storage;try{storage=window.localStorage;}catch{}
 const memory=new LetterUnlock(storage,storageKey),button=document.querySelector('#letter-button'),dialog=document.querySelector('#love-letter');
 const body=dialog.querySelector('.letter-copy');
 for(const text of LETTER_PARAGRAPHS){const p=document.createElement('p');p.textContent=text;body.append(p);}
 const signature=document.createElement('p');signature.className='letter-signature';signature.append('I love you,',document.createElement('br'),'Salami');body.append(signature);
 button.hidden=!memory.unlocked;
 function open(){
  if(!memory.unlocked||dialog.open)return;
  dialog.classList.toggle('gentle',gentle());dialog.showModal();body.scrollTop=0;
  dialog.querySelector('.letter-close').focus({preventScroll:true});
 }
 button.addEventListener('click',open);
 dialog.addEventListener('close',()=>{if(!button.hidden)button.focus({preventScroll:true});});
 window.addEventListener('storage',event=>{if(event.key===storageKey&&event.newValue==='unlocked'){memory.unlocked=true;button.hidden=false;}});
 return {discover(){
  if(!memory.discover())return;
  button.hidden=false;
  if(!gentle()&&!matchMedia('(prefers-reduced-motion: reduce)').matches)button.animate([{transform:'scale(.55)',opacity:0},{transform:'scale(1.18)',opacity:1},{transform:'scale(1)'}],{duration:600,easing:'cubic-bezier(.2,.8,.2,1)'});
  open();
 }};
}

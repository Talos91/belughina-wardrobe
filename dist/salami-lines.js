export const SALAMI_LINES=[
 'Hi Amore! ♡',
 'Ciao Beluga!',
 'Eccolo!',
 'Room for your Salami?',
 'Amore, I brought snacks!',
 'Your plus-one has arrived!',
 'Ciao bella! Going somewhere?',
 'Tiny bag. Big amore.',
 'Looking good, Beluga! ♡',
 'Special delivery: me!'
];

export function createSalamiGreetings(random=Math.random){
 let deck=[],last;
 return ()=>{
  if(!deck.length){
   deck=[...SALAMI_LINES];
   for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
   if(deck.at(-1)===last)[deck[0],deck[deck.length-1]]=[deck.at(-1),deck[0]];
  }
  return last=deck.pop();
 };
}

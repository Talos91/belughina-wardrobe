export const OUTFITS=[{id:'base',name:'Just me',description:'Our little beluga',extras:[],parts:[['primary','Pearl color']]}];
export const EXTRAS=[];
export const HAIR=[{id:'bun',name:'Her signature bun',symbol:'◉'}];
export const PLACES=[{id:'atelier',name:'Cozy atelier'},{id:'seaside',name:'Seaside cottage'},{id:'greenhouse',name:'Storybook greenhouse'},{id:'moonlit',name:'Moonlit observatory'},{id:'scrapbook',name:'Little scrapbook'},{id:'pastel',name:'Pastel playroom'},{id:'tuscany',name:'Tuscan afternoon'}];
export const PALETTE=[['Periwinkle','#aebde9'],['Lilac','#c6b6e2'],['Rose','#edb3c2'],['Buttercream','#f1dfb7'],['Sage','#b3c3a3'],['Original pearl','#f3eee5']];
export const DEFAULT_STATE={outfit:'base',hair:'bun',extras:[],colors:{},place:'moonlit',gentle:false,sparkles:true};
export function sanitizeState(value){
 const s={...DEFAULT_STATE,extras:[],colors:{}};if(!value||typeof value!=='object')return s;
 for(const [key,list] of [['outfit',OUTFITS],['hair',HAIR],['place',PLACES]])if(list.some(x=>x.id===value[key]))s[key]=value[key];
 if(Array.isArray(value.extras))s.extras=[...new Set(value.extras.filter(id=>EXTRAS.some(x=>x.id===id)))];
 if(value.colors&&typeof value.colors==='object')for(const [k,v] of Object.entries(value.colors)){if(/^[a-z]+_(primary|secondary|detail)$/.test(k)&&/^#[0-9a-f]{6}$/i.test(v))s.colors[k]=v;}
 if(typeof value.gentle==='boolean')s.gentle=value.gentle;if(typeof value.sparkles==='boolean')s.sparkles=value.sparkles;return s;
}
export function equipOutfit(state,id){const item=OUTFITS.find(x=>x.id===id);if(!item)return state;return {...state,outfit:id,extras:[...item.extras]};}
export function toggleExtra(state,id){if(!EXTRAS.some(x=>x.id===id))return state;let extras=state.extras.includes(id)?state.extras.filter(x=>x!==id):[...state.extras,id];if(extras.includes(id)&&['hat','crown'].includes(id))extras=extras.filter(x=>!['hat','crown'].includes(x)||x===id);return {...state,extras};}
export function randomLook(state,random=Math.random){const pick=arr=>arr[Math.floor(random()*arr.length)];const o=pick(OUTFITS);return {...state,outfit:o.id,hair:pick(HAIR).id,extras:[...o.extras]};}

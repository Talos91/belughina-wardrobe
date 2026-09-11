export const DRESSES=[
 {id:'bloom',name:'Blue hibiscus',description:'Blue floral halter dress with a flowing skirt',parts:[['primary','Fabric tint']]},
 {id:'moonlight',name:'Moonlight',description:'Blue and ivory ribbon gown',parts:[['primary','Blue ribbons'],['secondary','Ivory ribbons']]},
 {id:'floral',name:'Embroidered evening',description:'Black dress with golden floral embroidery',parts:[['primary','Fabric tint']]},
 {id:'pink',name:'Rose halter',description:'Rose pink gown with a softly wrapped bodice',parts:[['primary','Fabric tint']]}
];
export const CLOTHES=[
 {id:'stripe',slot:'top',name:'Seaside stripes',description:'Blue striped shirt with a relaxed collar',parts:[['primary','Fabric tint']]},
 {id:'halter',slot:'top',name:'Cream halter',description:'Ribbed ivory halter top',parts:[['primary','Knit tint']]},
 {id:'noir',slot:'top',name:'Midnight halter',description:'Charcoal gathered halter with an open neckline',parts:[['primary','Fabric tint']]},
 {id:'satin',slot:'bottom',name:'Champagne skirt',description:'Long satin skirt with a soft flowing hem',parts:[['primary','Satin tint']]},
 {id:'shorts',slot:'bottom',name:'Linen shorts',description:'White shorts with rolled cuffs',parts:[['primary','Fabric tint']]},
 {id:'trousers',slot:'bottom',name:'Cocoa trousers',description:'Soft pleats and wide flowing legs',parts:[['primary','Fabric tint']]}
];
export const EXTRAS=[
 {id:'sunglasses',name:'Sunglasses',parts:[['primary','Frame tint']]},
 {id:'earrings',name:'Crystal drops',description:'Sparkling crystal drop earrings',parts:[['primary','Crystal tint']]},
 {id:'hat',name:'Straw sunhat',parts:[['primary','Woven tint']]},
 {id:'crown',name:'Flower crown',parts:[['primary','Flower tint']]},
 {id:'scarf',name:'Printed scarf',parts:[['primary','Fabric tint']]},
 {id:'wrap',name:'Coastal wrap',description:'Turquoise waist wrap with a golden border and side knot',parts:[['primary','Fabric tint']]},
 {id:'tote',name:'Woven tote',parts:[['primary','Woven tint']]}
];
export const OUTFITS=[{id:'base',name:'Just me',parts:[['primary','Pearl color']]},...DRESSES];
export const HAIR=[{id:'bun',name:'Her signature bun'}];
export const ITEMS=[...OUTFITS,...CLOTHES,...EXTRAS];
export const PLACES=[{id:'atelier',name:'Cozy atelier'},{id:'seaside',name:'Seaside cottage'},{id:'greenhouse',name:'Storybook greenhouse'},{id:'moonlit',name:'Moonlit observatory'},{id:'scrapbook',name:'Little scrapbook'},{id:'pastel',name:'Pastel playroom'},{id:'tuscany',name:'Tuscan afternoon'},{id:'bedroom',name:'Cozy chic bedroom'},{id:'resort',name:'Seaside resort'},{id:'villa',name:'A little Tuscany'},{id:'manor',name:'Salami manor'},{id:'starlight',name:'Moonlit pastel room'},{id:'cafe',name:'Fashionista café'}];
export const PALETTE=[['Periwinkle','#aebde9'],['Lilac','#c6b6e2'],['Rose','#edb3c2'],['Buttercream','#f1dfb7'],['Sage','#b3c3a3'],['Original pearl','#f3eee5']];
export const DEFAULT_STATE={outfit:'base',top:null,bottom:null,hair:'bun',extras:[],glassesPosition:'eyes',colors:{},place:'moonlit',gentle:false,sparkles:true};
export function sanitizeState(value){
 const s={...DEFAULT_STATE,extras:[],colors:{}};if(!value||typeof value!=='object')return s;
 for(const [key,list] of [['outfit',OUTFITS],['hair',HAIR],['place',PLACES]])if(list.some(x=>x.id===value[key]))s[key]=value[key];
 if(s.outfit==='base')for(const slot of ['top','bottom'])if(CLOTHES.some(x=>x.slot===slot&&x.id===value[slot]))s[slot]=value[slot];
 if(Array.isArray(value.extras))s.extras=[...new Set(value.extras.filter(id=>EXTRAS.some(x=>x.id===id)))];
 // Preserve previously saved looks when moving the wrap out of Bottoms.
 if(value.bottom==='wrap'&&!s.extras.includes('wrap'))s.extras.push('wrap');
 if(value.glassesPosition==='forehead')s.glassesPosition='forehead';
 if(value.colors&&typeof value.colors==='object')for(const [k,v] of Object.entries(value.colors))if(/^[a-z]+_(primary|secondary|detail)$/.test(k)&&/^#[0-9a-f]{6}$/i.test(v))s.colors[k]=v;
 if(typeof value.gentle==='boolean')s.gentle=value.gentle;if(typeof value.sparkles==='boolean')s.sparkles=value.sparkles;return s;
}
export function equipOutfit(state,id){if(!OUTFITS.some(x=>x.id===id))return state;return {...state,outfit:id,top:null,bottom:null};}
export function equipClothing(state,id){const item=CLOTHES.find(x=>x.id===id);if(!item)return state;return {...state,outfit:'base',[item.slot]:state[item.slot]===id?null:id};}
export function toggleExtra(state,id){if(!EXTRAS.some(x=>x.id===id))return state;const remove=id==='hat'?'crown':id==='crown'?'hat':null;return {...state,extras:state.extras.includes(id)?state.extras.filter(x=>x!==id):[...state.extras.filter(x=>x!==remove),id]};}
export function activeItems(state){return [...(state.outfit==='base'?[state.top,state.bottom].filter(Boolean):[state.outfit]),...state.extras];}
export function lookName(state){return state.outfit!=='base'?OUTFITS.find(x=>x.id===state.outfit).name:[state.top,state.bottom].filter(Boolean).map(id=>ITEMS.find(x=>x.id===id).name).join(' + ')||'Just me';}
export function thumbnail(id){return './assets/thumbnails/'+(['base','moonlight'].includes(id)?'outfits':'item')+'-'+id+'.png?v=gift-web-1';}
export function randomLook(state,random=Math.random){const pick=arr=>arr[Math.min(arr.length-1,Math.floor(random()*arr.length))];const dress=pick([null,...DRESSES]);return {...state,outfit:dress?.id||'base',top:dress?null:pick(['stripe','halter','noir']),bottom:dress?null:pick(['shorts','trousers','satin']),extras:random()>.5?[pick(EXTRAS).id]:[]};}

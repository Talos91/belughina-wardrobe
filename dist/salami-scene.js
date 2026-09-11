// Small illustrated keepsakes are anchored in the artwork's coordinates.
// The same prop is included in exported photos, with no interface chrome.
const details={
 atelier:{x:.485,y:.26,w:.086,angle:0,kind:'frame',caption:'SALAMI',sub:'a little love, every day',color:'#ba925e'},
 seaside:{x:.354,y:.28,w:.045,angle:2,kind:'tag',caption:'SALAMI',sub:'sea you soon ♡',color:'#79a3aa'},
 greenhouse:{x:.272,y:.365,w:.052,angle:-4,kind:'tag',caption:'SALAMI',sub:'grown with love',color:'#849468'},
 moonlit:{x:.675,y:.15,w:.087,angle:0,kind:'stars',caption:'SALAMI',sub:'my favorite constellation',color:'#e9c98d'},
 scrapbook:{x:.157,y:.205,w:.064,angle:4,kind:'postcard',caption:'SALAMI',sub:'wish you were here ♡',color:'#bd846d'},
 pastel:{x:.655,y:.225,w:.086,angle:0,kind:'frame',caption:'SALAMI',sub:'you make my day',color:'#b0a0cc'},
 tuscany:{x:.404,y:.594,w:.050,angle:-5,kind:'tag',caption:'SALAMI',sub:'amore mio ♡',color:'#b58660'}
};
// Quiet notes placed on walls, furniture and book spines in each scene.
const notes={
 atelier:[{x:.546,y:.108,w:.080,ratio:1.16,angle:-2,kind:'note',lines:['Same beluga.','Brighter days.','♡'],color:'#ac865f'}],
 seaside:[{x:.69,y:.515,w:.112,ratio:.53,angle:0,kind:'plaque',lines:['Salami saved','you a seat ♡'],color:'#678990'}],
 greenhouse:[{x:.846,y:.594,w:.088,ratio:.65,angle:0,kind:'plaque',lines:['A little sunshine.','A little patience.','A lot of love.'],color:'#718265'},{x:.298,y:.680,w:.066,ratio:.39,angle:-2,kind:'spines',lines:['More Love','Good Food','Brighter Days'],color:'#796b4f'}],
 moonlit:[{x:.476,y:.15,w:.064,ratio:1.26,angle:1,kind:'night',lines:['More rest.','More good days.','Salami nearby.','♡'],color:'#d7b87c'}],
 scrapbook:[{x:.215,y:.294,w:.069,ratio:1.02,angle:3,kind:'note',lines:['Little things.','Lovely days.','You & me. ♡'],color:'#a0775e'}],
 pastel:[{x:.076,y:.677,w:.084,ratio:.46,angle:-3,kind:'spines',lines:['More Love','Good Food','Brighter Days'],color:'#8e7c80'},{x:.327,y:.095,w:.072,ratio:1.02,angle:0,kind:'note',lines:['You make','ordinary days','my favorites.','♡'],color:'#9a82a4'}],
 tuscany:[{x:.695,y:.594,w:.106,ratio:.65,angle:0,kind:'plaque',lines:['Good food.','Better company.','Salami, obviously. ♡'],color:'#987048'}]
};
function quoteArtwork(d){
 const width=220,height=width*d.ratio,night=d.kind==='night',spines=d.kind==='spines';
 const bg=night?'#26354f':d.kind==='plaque'?'#e8d9b9':'#fff3de';
 let paper=spines?'':`<rect x="2" y="2" width="216" height="${height-4}" rx="2" fill="${d.color}"/><rect x="6" y="6" width="208" height="${height-12}" fill="${bg}"/><rect x="11" y="11" width="198" height="${height-22}" fill="none" stroke="${d.color}" opacity=".35"/>`;
 if(d.kind==='note')paper+=`<path d="M84 0h52v16H84Z" fill="#d3bfa0" opacity=".65"/>`;
 const lineHeight=spines?height/3:24,font=spines?17:17,start=spines?lineHeight*.73:height/2-(d.lines.length-1)*lineHeight/2+5;
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="${height*2}" viewBox="0 0 220 ${height}">${paper}${d.lines.map((line,i)=>`<text x="110" y="${start+i*lineHeight}" text-anchor="middle" font-family="Georgia,serif" font-size="${font}" fill="${d.color}">${escape(line)}</text>`).join('')}</svg>`;
}
const drawing=`<g transform="translate(36 33) rotate(-30 50 64)"><path d="M42 12 38 1l10 5 9-5-1 13" fill="#ad6d50" stroke="#915a43" stroke-width="2"/><rect x="17" y="12" width="69" height="104" rx="33" fill="url(#sausage)" stroke="#a16a55" stroke-width="2"/><path d="M21 36q31 13 61 0M18 71q34 12 67 0M27 17l48 86M65 16l-38 88" fill="none" stroke="#edccb2" stroke-width="2" opacity=".75"/><ellipse cx="51.5" cy="109" rx="33" ry="19" fill="#cb8280" stroke="#945a4d" stroke-width="2"/><g fill="#f1c8b2"><ellipse cx="36" cy="105" rx="4" ry="3"/><circle cx="50" cy="117" r="3"/><ellipse cx="63" cy="105" rx="3" ry="4"/><circle cx="72" cy="112" r="2.5"/><circle cx="51" cy="99" r="2.8"/><circle cx="30" cy="114" r="2"/><circle cx="61" cy="116" r="2"/></g><g fill="#513f35"><ellipse cx="37" cy="54" rx="3" ry="4"/><ellipse cx="67" cy="54" rx="3" ry="4"/></g><path d="M45 63q7 9 14 0" fill="none" stroke="#664236" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="31" cy="61" rx="6" ry="3" fill="#e89689"/><ellipse cx="73" cy="61" rx="6" ry="3" fill="#e89689"/></g><path d="M91 30c-20-13-23-22-15-26 6-3 11 1 12 5 4-6 12-6 15-1 5 9-3 17-12 22" fill="#da8077" transform="translate(0 2) scale(.8)"/>`;
function artwork(d){
 const stars=d.kind==='stars';let frame='';
 if(d.kind==='frame')frame=`<rect x="2" y="2" width="156" height="204" rx="2" fill="${d.color}"/><rect x="7" y="7" width="146" height="194" fill="#e7c69a"/><rect x="11" y="11" width="138" height="186" fill="${d.color}"/><rect x="17" y="17" width="126" height="174" fill="#fff5e5"/>`;
 else if(d.kind==='tag')frame=`<path d="M80 8V-55" stroke="#aa8b64" stroke-width="3"/><path d="m10 36 22-25h96l22 25v159H10Z" fill="#f5e8d2" stroke="${d.color}" stroke-width="3"/><circle cx="80" cy="22" r="4" fill="${d.color}"/>`;
 else if(!stars)frame='<rect x="4" y="4" width="152" height="200" fill="#fff4df"/><path d="M51 3h61v15H51Z" fill="#ceb690" opacity=".7"/>';
 const art=stars?`<g stroke="#f0d6aa" stroke-width="1.2" fill="none" opacity=".9"><path d="m47 63 45-31 31 26-18 74-47 30-23-29Z M47 63l76-5M35 133l70-1M47 63l58 69"/>${[[47,63],[92,32],[123,58],[105,132],[58,162],[35,133]].map(([x,y])=>`<path d="m${x-5} ${y}h10m-5-5v10" stroke-width="2"/>`).join('')}<path d="M91 22 84 9l11 3 10-4-5 17"/><path d="M66 89q5-7 9 0m18-14q5-7 9 0M78 99q8 6 15-5"/></g>`:`<g transform="translate(0 18)">${drawing}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="416" viewBox="0 0 160 208"><defs><linearGradient id="sausage" x2="1" y2="1"><stop stop-color="#cf9a72"/><stop offset=".5" stop-color="#be815e"/><stop offset="1" stop-color="#965d45"/></linearGradient></defs>${frame}${art}<text x="80" y="177" text-anchor="middle" font-family="Georgia,serif" font-size="17" letter-spacing="2" fill="${stars?'#f0d6aa':'#98664f'}">${d.caption}</text><text x="80" y="188" text-anchor="middle" font-family="Georgia,serif" font-size="5.8" fill="${stars?'#e0c9a6':'#ac9076'}">${d.sub}</text></svg>`;
}
export class SalamiScene{
 constructor(host){this.host=host;this.cache=new Map();this.props=[];window.addEventListener('resize',()=>this.resize(),{passive:true})}
 getImage(id,index=0){const key=id+':'+index;if(!this.cache.has(key)){const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(index?quoteArtwork(notes[id][index-1]):artwork(details[id]));this.cache.set(key,image)}return this.cache.get(key)}
 setPlace(id,background){this.id=id;this.background=background;this.items=details[id]?[details[id],...notes[id]]:[];this.host.replaceChildren();this.props=this.items.map((d,i)=>{const img=new Image();img.className='salami-prop';img.alt='';img.src=this.getImage(id,i).src;this.host.append(img);return img});this.host.dataset.place=id;this.resize()}
 resize(){if(!this.background)return;const w=innerWidth,h=innerHeight,s=Math.max(w/this.background.width,h/this.background.height),iw=this.background.width*s,ih=this.background.height*s;this.items.forEach((d,i)=>{const size=d.w*iw;this.props[i].style.cssText=`left:${(w-iw)/2+d.x*iw-size/2}px;top:${(h-ih)/2+d.y*ih}px;width:${size}px;transform:rotate(${d.angle}deg)`})}
 async drawPhoto(ctx,bg,w,h){const id=this.id,items=details[id]?[details[id],...notes[id]]:[],images=items.map((_,i)=>this.getImage(id,i));await Promise.all(images.map(img=>img.decode()));const s=Math.max(w/bg.width,h/bg.height),iw=bg.width*s,ih=bg.height*s;items.forEach((d,i)=>{const size=d.w*iw,ratio=d.ratio||1.3;ctx.save();ctx.translate((w-iw)/2+d.x*iw,(h-ih)/2+d.y*ih+size*ratio/2);ctx.rotate(d.angle*Math.PI/180);ctx.drawImage(images[i],-size/2,-size*ratio/2,size,size*ratio);ctx.restore()})}
}
export {details as SALAMI_PLACES,notes as SCENE_NOTES};

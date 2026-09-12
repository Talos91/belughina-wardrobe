import assert from 'node:assert/strict';
import * as T from 'three';

// Evaluate the actual injected coverage block, not a second copy of its mask
// formula. This deliberately small GLSL subset rejects unsupported syntax.
// It supports the scalar/vector expressions, declarations and discard branches
// used by coverage, without a GPU dependency in the release checks.
export function coverageEvaluator(source){
 const text=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
 const tokens=[];const lexer=/\s*(?:(\d+\.?\d*|\.\d+)(?:[eE]([+-]?\d+))?|([A-Za-z_]\w*)|(&&|\|\||<=|>=|==|!=|[().,;{}?:+*/!<>=-]))/y;
 let offset=0;
 while(offset<text.length){
  if(!text.slice(offset).trim())break;
  lexer.lastIndex=offset;const match=lexer.exec(text);
  assert(match,'unsupported coverage GLSL near '+text.slice(offset,offset+60));
  tokens.push(match[1]!==undefined?Number(match[1]+(match[2]?'e'+match[2]:'')):match[3]||match[4]);offset=lexer.lastIndex;
 }
 let at=0;
 const next=()=>tokens[at++],peek=()=>tokens[at];
 const expect=value=>assert.equal(next(),value,'coverage GLSL token');
 const component=(a,b,fn)=>Array.isArray(a)||Array.isArray(b)?Array.from({length:(Array.isArray(a)?a:b).length},(_,i)=>fn(Array.isArray(a)?a[i]:a,Array.isArray(b)?b[i]:b)):fn(a,b);
 const unary=(value,fn)=>Array.isArray(value)?value.map(fn):fn(value);
 const builtins={
  abs:x=>unary(x,Math.abs),min:(a,b)=>component(a,b,Math.min),max:(a,b)=>component(a,b,Math.max),
  mix:(a,b,t)=>component(a,b,(x,y)=>x+(y-x)*t),
  smoothstep:(low,high,x)=>T.MathUtils.smoothstep(x,low,high),
  clamp:(x,low,high)=>unary(x,v=>T.MathUtils.clamp(v,low,high)),
  dot:(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),length:a=>Math.hypot(...a),
  vec2:(...a)=>a.length===1?[a[0],a[0]]:a.flat(),
  vec3:(...a)=>a.length===1?[a[0],a[0],a[0]]:a.flat(),
  vec4:(...a)=>a.length===1?[a[0],a[0],a[0],a[0]]:a.flat(),
 };
 const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6};
 const operations={'+':(a,b)=>a+b,'-':(a,b)=>a-b,'*':(a,b)=>a*b,'/':(a,b)=>a/b,'<':(a,b)=>a<b,'>':(a,b)=>a>b,'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b,'&&':(a,b)=>a&&b,'||':(a,b)=>a||b};
 function expression(minimum=0){
  let token=next(),left;
  if(['!','-','+'].includes(token)){
   const value=expression(7);left=env=>unary(value(env),token==='!'?x=>!x:token==='-'?x=>-x:x=>x);
  }else if(token==='('){left=expression();expect(')')}
  else if(typeof token==='number')left=()=>token;
  else if(token==='true'||token==='false')left=()=>token==='true';
  else if(peek()==='('){
   next();const args=[];if(peek()!==')')do{args.push(expression());if(peek()!==',')break;next()}while(true);expect(')');
   assert(builtins[token],'unsupported coverage GLSL function '+token);left=env=>builtins[token](...args.map(arg=>arg(env)));
  }else left=env=>{assert(Object.hasOwn(env,token),'undefined coverage GLSL variable '+token);return env[token]};
  while(peek()==='.'){
   next();const member=next(),previous=left;
   left=env=>{const value=previous(env);return Array.isArray(value)?(member.length===1?value['xyzw'.indexOf(member)]:[...member].map(c=>value['xyzw'.indexOf(c)])):value[member]};
  }
  while(precedence[peek()]>=minimum){
   const operator=next(),right=expression(precedence[operator]+1),previous=left;
   left=env=>component(previous(env),right(env),operations[operator]);
  }
  if(minimum===0&&peek()==='?'){
   next();const yes=expression();expect(':');const no=expression(),condition=left;left=env=>condition(env)?yes(env):no(env);
  }
  return left;
 }
 function statement(){
  if(peek()==='{'){
   next();const statements=[];while(peek()!=='}')statements.push(statement());expect('}');
   return env=>{for(const run of statements)if(run(env))return true;return false};
  }
  if(peek()==='if'){
   next();expect('(');const condition=expression();expect(')');const yes=statement();let no=()=>false;
   if(peek()==='else'){next();no=statement()}
   return env=>condition(env)?yes(env):no(env);
  }
  if(peek()==='discard'){next();expect(';');return()=>true}
  if(['float','bool','vec2','vec3','vec4'].includes(peek()))next();
  const name=next();expect('=');const value=expression();expect(';');return env=>{env[name]=value(env);return false};
 }
 const statements=[];while(at<tokens.length)statements.push(statement());
 return variables=>{const env={...variables};for(const run of statements)if(run(env))return true;return false};
}

export function captureCoverage(material){
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n/* END_COVERAGE_PROBE */'};
 material.onBeforeCompile(shader,{});
 const coverage=shader.fragmentShader.split('#include <clipping_planes_fragment>')[1].split('/* END_COVERAGE_PROBE */')[0];
 assert(coverage.includes('discard'),'actual fragment coverage was captured');
 const discarded=coverageEvaluator(coverage);
 const uniforms=Object.fromEntries(Object.entries(shader.uniforms).map(([name,value])=>[name,value.value]));
 return (rest,arm)=>discarded({...uniforms,vWardrobeRest:rest,vWardrobeArm:arm});
}

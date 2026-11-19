export const kitNames=['kick','snare','clap','closed-hat','open-hat','rim'] as const;
export type KitName=typeof kitNames[number];
export type ReferenceKind='loop'|'tone'|'noise';
function noiseGenerator(){let state=909;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2147483648-1;};}
/** Original synthesized approximations, not recordings of a TR-909. */
export function makeSamples(name:KitName,rate=24000):Float32Array{
  const lengths={kick:.65,snare:.28,clap:.32,'closed-hat':.12,'open-hat':.65,rim:.12};
  const data=new Float32Array(Math.ceil(lengths[name]*rate)),noise=noiseGenerator();let phase=0,previous=0;
  for(let i=0;i<data.length;i++){
    const t=i/rate,n=noise(),high=(n-previous)*.5;previous=n;
    phase+=2*Math.PI*(48+110*Math.exp(-t*38))/rate;
    let value=0;
    if(name==='kick')value=.6*Math.sin(phase)*Math.exp(-t*10)+.03*high*Math.exp(-t*180);
    if(name==='snare')value=(.3*n+.18*Math.sin(2*Math.PI*180*t))*Math.exp(-t*20);
    if(name==='clap')value=.38*high*(Math.exp(-t*23)+.6*Math.exp(-Math.abs(t-.014)*220)+.4*Math.exp(-Math.abs(t-.028)*220));
    if(name==='closed-hat'||name==='open-hat')value=.35*high*Math.exp(-t*(name==='closed-hat'?60:9));
    if(name==='rim')value=.25*(Math.sin(2*Math.PI*470*t)+.5*Math.sin(2*Math.PI*1510*t))*Math.exp(-t*65);
    const fade=Math.min(1,t/.001,(data.length-1-i)/(rate*.005));data[i]=Math.max(-.65,Math.min(.65,value))*Math.max(0,fade);
  }
  return data;
}
export function makeReference(kind:ReferenceKind,rate=24000):Float32Array{
  const data=new Float32Array(rate*8);
  if(kind==='loop'){
    // Four bars, 120 BPM, sixteen eighth-note steps; original deterministic pattern.
    const hits:Array<[KitName,number[]]>=[['kick',[0,4,8,10,12,16,20,24,28]],['snare',[4,12,20,28]],['clap',[12,28]],['closed-hat',Array.from({length:32},(_,i)=>i)],['open-hat',[6,14,22,30]],['rim',[3,11,19,27]]];
    for(const [name,steps] of hits){const sample=makeSamples(name,rate);for(const step of steps){const start=Math.round(step*.25*rate);for(let i=0;i<sample.length&&start+i<data.length;i++)data[start+i]+=sample[i]*(name.includes('hat')?.4:.7);}}
    for(let i=0;i<data.length;i++)data[i]=Math.max(-.75,Math.min(.75,data[i]));
  }else{
    const noise=noiseGenerator();for(let i=0;i<data.length;i++)data[i]=(kind==='tone'?.3*Math.sin(2*Math.PI*440*i/rate):.25*noise())*Math.min(1,i/(rate*.01),(data.length-1-i)/(rate*.01));
  }
  return data;
}
export function toBuffer(context:BaseAudioContext,data:Float32Array){const buffer=context.createBuffer(1,data.length,24000);buffer.copyToChannel(new Float32Array(data),0);return buffer;}
export function wavBytes(data:Float32Array,rate=24000){
  const bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer);
  const word=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i);};
  word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,data.length*2,true);
  for(let i=0;i<data.length;i++)view.setInt16(44+2*i,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
  return bytes;
}

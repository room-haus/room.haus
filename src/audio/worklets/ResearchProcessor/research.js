/* No imports: shared final safety guard and optional bounded pre-effect capture. */
class ResearchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.guard=options.processorOptions?.guard===true;
    this.ring=null;this.cursor=0;this.count=0;this.generation=0;this.frames=0;
    this.port.onmessage=({data})=>{
      if(data.type==='start'){
        const seconds=Number.isFinite(data.seconds)?Math.max(.1,Math.min(8,data.seconds)):1;
        this.ring=[new Float32Array(Math.ceil(seconds*sampleRate)),new Float32Array(Math.ceil(seconds*sampleRate))];
        this.cursor=this.count=0;this.generation=data.generation;
      }
      if(data.type==='clear'){this.ring=null;this.cursor=this.count=0;this.generation=data.generation;}
      if(data.type==='read'){
        if(data.generation!==this.generation||!this.ring){this.port.postMessage({id:data.id,generation:data.generation,channels:null});return;}
        const count=Math.min(this.count,Math.floor(Math.max(0,Math.min(8,data.seconds))*sampleRate));
        const channels=this.ring.map(ring=>{
          const out=new Float32Array(count);for(let i=0;i<count;i++)out[i]=ring[(this.cursor-count+i+ring.length)%ring.length];return out;
        });
        this.port.postMessage({id:data.id,generation:this.generation,channels},channels.map(c=>c.buffer));
      }
    };
  }
  process(inputs,outputs) {
    const input=inputs[0]||[],output=outputs[0]||[];let peak=0,sum=0,count=0;
    const length=output[0]?.length||128;
    for(let i=0;i<length;i++){
      for(let c=0;c<output.length;c++){
        const raw=input[Math.min(c,input.length-1)]?.[i]||0;
        const value=Number.isFinite(raw)?(this.guard?Math.max(-.98,Math.min(.98,raw)):raw):0;
        output[c][i]=this.guard?value:0;
        if(this.guard){peak=Math.max(peak,Math.abs(value));sum+=value*value;count++;}
        if(this.ring&&c<2)this.ring[c][this.cursor]=value;
      }
      if(this.ring){this.cursor=(this.cursor+1)%this.ring[0].length;this.count=Math.min(this.count+1,this.ring[0].length);}
    }
    if(this.guard&&++this.frames%16===0)this.port.postMessage({type:'meter',peak,rms:Math.sqrt(sum/Math.max(1,count))});
    return true;
  }
}
registerProcessor('room-research',ResearchProcessor);

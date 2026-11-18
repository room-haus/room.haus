const rate=8000,count=rate*360;
const wav=Buffer.alloc(44+count,128);
wav.write('RIFF');wav.writeUInt32LE(36+count,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);
wav.write('data',36);wav.writeUInt32LE(count,40);
for(let i=0;i<count;i++) wav[44+i]=128+Math.round(24*Math.sin(i/rate*Math.PI*220));

async function fixture(page,{graphicsFailure=false,audioFailure=false}={}) {
  await page.addInitScript(({src,graphicsFailure,audioFailure})=>{
    sessionStorage.setItem('room-labs-session','open');
    const Native=window.Audio;window.__rallyMedia=[];
    window.Audio=function(){
      const media=new Native();window.__rallyMedia.push(media);
      media.canPlayType=()=>'probably';
      const desc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
      Object.defineProperty(media,'src',{get(){return desc.get.call(this);},set(){desc.set.call(this,audioFailure?'data:audio/wav;base64,broken':src);}});
      return media;
    };
    if(graphicsFailure){const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};}
  },{src:'data:audio/wav;base64,'+wav.toString('base64'),graphicsFailure,audioFailure});
}

module.exports={fixture};

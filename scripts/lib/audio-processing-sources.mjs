import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Reuse only a provenance-matched cache; never decode changed remote material. */
export async function cacheVerifiedSource(url,expectedHash,filename){
  try{if(digest(await readFile(filename))===expectedHash)return filename;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Reference source HTTP ${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(digest(bytes)!==expectedHash)throw Error(`Reference source SHA-256 changed: ${url}`);
  await mkdir(dirname(filename),{recursive:true});await writeFile(filename,bytes);
  return filename;
}

export async function prepareProcessingPassages(passages,directory){
  const prepared=[];
  for(const passage of passages){
    const name=`mx029-${String(passage.segment).padStart(3,'0')}`;
    const input=await cacheVerifiedSource(passage.url,passage.segmentSha256,join(directory,name+'.ts'));
    const sourceWav=join(directory,name+'-source.wav');
    try{
      execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-t',String(passage.seconds),'-ar','24000','-ac','2',sourceWav],{stdio:'pipe'});
    }catch(error){
      if(error.code==='ENOENT')throw Error('ffmpeg is required to regenerate audio-processing source WAVs.');
      throw error;
    }
    prepared.push({...passage,sourceWav});
  }
  return prepared;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {cacheVerifiedSource} from '../scripts/lib/audio-processing-sources.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t,body,status=200){
  const directory=await mkdtemp(join(tmpdir(),'room-audio-source-'));
  const server=createServer((_req,res)=>{res.writeHead(status);res.end(body);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  return {directory,server,url:`http://127.0.0.1:${server.address().port}/segment.ts`,filename:join(directory,'segment.ts')};
}

test('reference source download is hash-verified and a verified cache works offline',async t=>{
  const body=Buffer.from('known reference segment'),f=await fixture(t,body);
  await cacheVerifiedSource(f.url,digest(body),f.filename);
  assert.deepEqual(await readFile(f.filename),body);
  await new Promise(resolve=>f.server.close(resolve));
  await cacheVerifiedSource(f.url,digest(body),f.filename);
  assert.deepEqual(await readFile(f.filename),body);
});

test('reference source cache is repaired when its content no longer matches provenance',async t=>{
  const body=Buffer.from('known reference segment'),f=await fixture(t,body);
  await writeFile(f.filename,'corrupted cache');
  await cacheVerifiedSource(f.url,digest(body),f.filename);
  assert.deepEqual(await readFile(f.filename),body);
});

test('changed remote source is rejected without writing an unverified cache',async t=>{
  const f=await fixture(t,'changed segment');
  await assert.rejects(cacheVerifiedSource(f.url,digest('expected segment'),f.filename),/SHA-256/);
  await assert.rejects(readFile(f.filename),{code:'ENOENT'});
});

test('source HTTP failures are reported without caching an error body',async t=>{
  const f=await fixture(t,'unavailable',503);
  await assert.rejects(cacheVerifiedSource(f.url,digest('expected segment'),f.filename),/503/);
  await assert.rejects(readFile(f.filename),{code:'ENOENT'});
});

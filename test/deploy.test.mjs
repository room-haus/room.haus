import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const previous = 'arn:aws:cloudfront::123456789012:function/room-archive-previous';
const response = {EventType:'viewer-response', FunctionARN:'arn:aws:cloudfront::123456789012:function/headers'};
const active = state => state.config.DefaultCacheBehavior.FunctionAssociations.Items?.find(item => item.EventType === 'viewer-request')?.FunctionARN;

function run(t, {first = false, verifyFails = false, concurrent = false, uploadFails = false} = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'room-deploy-test-'));
  t.after(() => rmSync(dir, {recursive:true, force:true}));
  for (const name of ['dist/assets','scripts','bin']) mkdirSync(path.join(dir,name), {recursive:true});
  writeFileSync(path.join(dir,'dist/index.html'), '<html>tested artifact</html>');
  writeFileSync(path.join(dir,'dist/assets/main.hash.js'), 'tested script');
  copyFileSync(new URL('./fixtures/fake-aws.cjs', import.meta.url), path.join(dir,'bin/aws'));
  chmodSync(path.join(dir,'bin/aws'), 0o755);
  const items = first ? [response] : [response, {EventType:'viewer-request', FunctionARN:previous}];
  const stateFile = path.join(dir,'state.json');
  writeFileSync(stateFile, JSON.stringify({calls:[],updates:[],revision:1,uploadFails,config:{
    Comment:'Existing config',Enabled:true,CallerReference:'original',
    Aliases:{Quantity:1,Items:['room.haus']},
    Origins:{Quantity:1,Items:[{Id:'bucket',DomainName:'room.haus.s3.amazonaws.com',OriginPath:'',S3OriginConfig:{OriginAccessIdentity:''}}]},
    DefaultCacheBehavior:{TargetOriginId:'bucket',ViewerProtocolPolicy:'redirect-to-https',Compress:false,
      FunctionAssociations:{Quantity:items.length,Items:items},LambdaFunctionAssociations:{Quantity:0}},
    CacheBehaviors:{Quantity:0},
  }}));
  // Simulate only the external public verification boundary, preserving the real deploy/rollback code.
  writeFileSync(path.join(dir,'scripts/check-routes.mjs'), `
    import fs from 'node:fs';
    const file = process.env.ROOM_TEST_AWS_STATE;
    const state = JSON.parse(fs.readFileSync(file));
    state.verified = true;
    if (${concurrent}) {
      const items = state.config.DefaultCacheBehavior.FunctionAssociations.Items;
      items.find(item => item.EventType === 'viewer-request').FunctionARN = 'another-release';
      state.config.Comment = 'Concurrent update'; state.revision++;
    }
    fs.writeFileSync(file, JSON.stringify(state));
    process.exitCode = ${verifyFails ? 1 : 0};
  `);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/deploy.mjs', import.meta.url)), 'a'.repeat(40)], {
    cwd:dir, encoding:'utf8', env:{...process.env,PATH:path.join(dir,'bin') + path.delimiter + process.env.PATH,ROOM_TEST_AWS_STATE:stateFile},
  });
  return {result,state:JSON.parse(readFileSync(stateFile))};
}

test('publishing switches only after uploads and verifies the selected release', t => {
  const {result,state} = run(t);
  assert.equal(result.status,0,result.stderr);
  assert.equal(active(state),state.newArn);
  assert.equal(state.updates.length,1);
  assert.ok(state.uploaded && state.verified);
  assert.ok(state.config.DefaultCacheBehavior.Compress);
  assert.deepEqual(state.config.DefaultCacheBehavior.FunctionAssociations.Items[0],response);
  const commands=state.calls.map(call=>call.slice(0,2).join(' '));
  assert.ok(commands.indexOf('s3api put-object') < commands.indexOf('cloudfront update-distribution'));
});
test('failed public verification restores the prior function and compression setting', t => {
  const {result,state} = run(t,{verifyFails:true});
  assert.notEqual(result.status,0);
  assert.equal(active(state),previous);
  assert.equal(state.updates.length,2);
  assert.equal(state.config.DefaultCacheBehavior.Compress,false);
  assert.deepEqual(state.config.DefaultCacheBehavior.FunctionAssociations.Items[0],response);
  assert.match(result.stderr,/Restored previous viewer request function/);
});
test('first-release rollback removes its viewer-request association and preserves other associations', t => {
  const {result,state} = run(t,{first:true,verifyFails:true});
  assert.notEqual(result.status,0);
  assert.equal(active(state),undefined);
  assert.deepEqual(state.config.DefaultCacheBehavior.FunctionAssociations,{Quantity:1,Items:[response]});
});
test('rollback refuses to overwrite a concurrent release', t => {
  const {result,state} = run(t,{verifyFails:true,concurrent:true});
  assert.notEqual(result.status,0);
  assert.equal(active(state),'another-release');
  assert.equal(state.updates.length,1);
  assert.equal(state.config.Comment,'Concurrent update');
  assert.match(result.stderr,/Another release changed the active function/);
});
test('upload failure never switches the live distribution or marks the upload complete', t => {
  const {result,state} = run(t,{uploadFails:true});
  assert.notEqual(result.status,0);
  assert.equal(active(state),previous);
  assert.equal(state.updates.length,0);
  assert.equal(state.uploaded,undefined);
  assert.equal(state.verified,undefined);
});

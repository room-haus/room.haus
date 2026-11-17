#!/usr/bin/env node
// Provider boundary for deploy.test.mjs. This process never contacts AWS.
const fs = require('node:fs');
const stateFile = process.env.ROOM_TEST_AWS_STATE;
const state = JSON.parse(fs.readFileSync(stateFile));
const args = process.argv.slice(2);
state.calls.push(args);
const value = key => args[args.indexOf(key) + 1];
let result = {};
let fail = false;
const operation = args.slice(0, 2).join(' ');
switch (operation) {
  case 'cloudfront get-distribution-config':
    result = {ETag: String(state.revision), DistributionConfig: state.config};
    break;
  case 's3api list-objects-v2': result = {}; break;
  case 's3 sync': fail = state.uploadFails; break;
  case 's3api put-object': state.uploaded = true; break;
  case 'cloudfront list-functions': result = {FunctionList: {Items: []}}; break;
  case 'cloudfront create-function': result = {ETag: 'staged'}; break;
  case 'cloudfront publish-function':
    state.newArn = 'arn:aws:cloudfront::123456789012:function/' + value('--name');
    result = {FunctionSummary: {FunctionMetadata: {FunctionARN: state.newArn}}};
    break;
  case 'cloudfront update-distribution':
    if (value('--if-match') !== String(state.revision)) throw Error('Incorrect distribution revision');
    state.config = JSON.parse(fs.readFileSync(value('--distribution-config').replace('file://', '')));
    state.revision++;
    state.updates.push(state.config);
    break;
  case 'cloudfront wait': break;
  default: throw Error('Unexpected AWS call: ' + args.join(' '));
}
fs.writeFileSync(stateFile, JSON.stringify(state));
if (fail) { console.error('Upload failed'); process.exitCode = 1; }
else console.log(JSON.stringify(result));

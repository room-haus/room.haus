const {transformFileSync}=require('@babel/core');
const path=require('node:path');
// Load the actual TypeScript modules in browser unit graphs without production test hooks.
function moduleUrl(filename){
  let code=transformFileSync(filename,{configFile:false,babelrc:false,presets:['@babel/preset-typescript']}).code;
  code=code.replace(/from ['"](.+?\.(?:ts|mjs))['"]/g,(_all,relative)=>`from '${moduleUrl(path.resolve(path.dirname(filename),relative))}'`);
  return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
module.exports={moduleUrl};

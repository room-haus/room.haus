import {RawTexture, Scene, ShaderMaterial, Texture} from 'babylonjs';

export type Surface = 'wall' | 'paving' | 'iron';
const hash = (x: number, y: number, seed: number) => {
  let n = Math.imul(x + seed, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};

function pixels(kind: Surface, seed: number) {
  const data = new Uint8Array(64 * 64 * 4);
  const iron = kind === 'iron',
    paving = kind === 'paving';
  const course = paving ? 16 : 8,
    width = paving ? 32 : 16;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const row = Math.floor(y / course);
      const offset = ((row % 2) * width) / 2 + Math.floor(hash(0, row, seed) * 5);
      const edge = (i: number) => i * width + Math.floor(hash((i + 64) % (64 / width), row, seed) * 6) - 3;
      const px = x + offset;
      let col = Math.floor(px / width);
      if (px < edge(col)) col--;
      else if (px >= edge(col + 1)) col++;
      const left = px - edge(col),
        right = edge(col + 1) - 1 - px;
      const noise = hash(x, y, seed),
        broad = hash(x >> 2, y >> 2, seed + 2);
      const top = (y + (left < 2 && noise > 0.86 ? 1 : 0)) % course;
      const stone = hash((col + 64) % (64 / width), row, seed + 19);
      let value = 109 + 35 * stone + 22 * (broad - 0.5) + 27 * (noise - 0.5);
      if (top === 0 || left === 0) value *= 0.39 + noise * 0.15;
      else if (top === 1 || left === 1) value += 14 * noise;
      else if (top === course - 1 || right === 0) value *= 0.77;
      if (noise > 0.984) value -= 36;
      if (iron) value = 81 + 26 * broad + 25 * noise + (x % 16 === 0 ? 11 : 0) - (y % 32 === 0 ? 18 : 0);
      const o = (64 * y + x) * 4;
      data[o] = value * (iron ? 0.79 : 1.1);
      data[o + 1] = value * (iron ? 0.8 : 1.01);
      data[o + 2] = value * (iron ? 0.81 : 0.88);
      data[o + 3] = 255;
    }
  return data;
}

const vertexSource = `
precision highp float;
attribute vec3 position, normal;
attribute vec4 color;
uniform mat4 world, worldViewProjection;
varying vec3 P,N,L,T;
varying vec2 mark;
void main(){
  P=(world*vec4(position,1.)).xyz;
  L=position; T=normal; N=normalize(mat3(world)*normal); mark=color.rg;
  gl_Position=worldViewProjection*vec4(position,1.);
}`;

const fragmentSource = `
precision highp float;
varying vec3 P,N,L,T;
varying vec2 mark;
uniform sampler2D surfaceMap;
uniform vec3 eye, relic, hall;
uniform vec4 lamps[12];
uniform vec4 response, air, echo;
uniform vec2 screen, tempo;
uniform float scale;
void main(){
  vec3 axis=abs(T);
  vec2 uv=axis.y>max(axis.x,axis.z)?L.xz: (axis.x>axis.z?vec2(L.z,-L.y):vec2(L.x,-L.y));
  vec3 stone=texture2D(surfaceMap,uv/scale).rgb*mark.x;
  float viewDist=length(eye-P);
  vec3 lit=vec3(.145,.155,.18)*(1.+.19*N.y);
  // A dim lantern fill leaves the first few metres readable between pools.
  lit+=vec3(.47,.46,.43)/(1.+viewDist*viewDist*.081);
  for(int i=0;i<12;i++){
    vec3 ray=lamps[i].xyz-P;
    float d2=dot(ray,ray);
    float incidence=max(dot(N,ray*inversesqrt(max(.01,d2))),0.);
    float hueMix=clamp(air.x*.46+tempo.y*.22,0.,1.);
    vec3 hue=mix(vec3(1.,.53,.21),vec3(.64,.46,.66),hueMix);
    lit+=hue*lamps[i].w*(.18+.82*incidence)/(1.+d2*.50)*(.78+response.x*.98)*(1.+tempo.x*.16);
  }
  vec3 rx=relic-P, hx=hall-P;
  lit+=mix(vec3(.69,.36,.18),vec3(.57,.40,.72),air.x)*response.w*1.9/(1.+dot(rx,rx)*.27);
  lit+=vec3(.65,.56,.66)*air.y*3.7/(1.+dot(hx,hx)*.055);
  vec3 fromEnemy=P-echo.xyz;
  float echoPool=echo.w*max(0.,1.-dot(fromEnemy,fromEnemy)/14.);
  lit+=vec3(.45,.26,.095)*echoPool;
  vec3 ink=stone*lit;
  vec3 amber=mix(vec3(.98,.64,.26),vec3(.98,.70,.38),response.z);
  if(mark.y>.5) ink=mix(ink,amber*(.62+.38*response.x),clamp(mark.y,0.,1.));
  // The transmitter runes answer the other half of the torch pulse.
  if(mark.y>1.5) ink=mix(vec3(.26,.21,.18),mix(amber,vec3(.76,.57,.77),air.x),clamp(.22+.72*response.w+.22*echoPool-tempo.x*.14,0.,1.));
  vec3 mist=mix(vec3(.043,.040,.047),vec3(.094,.078,.11),air.x*.50+air.y*.42);
  ink=mix(mist,ink,exp(-viewDist*(.025+air.z*.033)));
  // Tiny drifting mineral flecks, visible only inside close lantern pools.
  vec2 speck=floor(vec2(P.x*6.+P.z*4.,P.y*8.)+vec2(0.,air.w*.25));
  float dust=fract(sin(dot(speck,vec2(12.9898,78.233)))*43758.5453);
  ink+=vec3(.14,.105,.075)*step(.995,dust)*response.z*(1.+max(0.,tempo.x)*.65)*min(1.,lit.r);
  vec2 screenUV=gl_FragCoord.xy/screen;
  ink*=1.-.22*pow(length(screenUV-.5)*1.38,2.);
  float dither=fract(dot(mod(gl_FragCoord.xy,4.),vec2(.754877,.56984)))-.5;
  gl_FragColor=vec4(clamp(floor(ink*24.+dither*.75+.5)/24.,0.,1.),1.);
}`;

export function surface(scene: Scene, kind: Surface, seed: number) {
  const mat = new ShaderMaterial(
    kind,
    scene,
    {vertexSource, fragmentSource},
    {
      attributes: ['position', 'normal', 'color'],
      uniforms: ['world', 'worldViewProjection', 'eye', 'lamps', 'relic', 'hall', 'response', 'air', 'echo', 'scale', 'screen', 'tempo'],
      samplers: ['surfaceMap'],
    },
  );
  const texture = RawTexture.CreateRGBATexture(
    pixels(kind, seed),
    64,
    64,
    scene,
    true,
    false,
    Texture.NEAREST_NEAREST_MIPNEAREST,
  );
  texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
  mat.setTexture('surfaceMap', texture);
  mat.setFloat('scale', kind === 'paving' ? 3.8 : kind === 'wall' ? 3.25 : 1.4);
  mat.backFaceCulling = false;
  return mat;
}

import {Color3, Material, Matrix, Mesh, MeshBuilder, RawTexture, Scene, StandardMaterial, Texture} from 'babylonjs';
import type {EnemyDefinition, EnemyState} from '../contracts';

// A half-stamp, mirrored around the spine. Each ink cell is two tall pixels.
const stamps = {
  bone: [
    '......oo', '....oott', '....otbb', '....otxx', '.....too', '.....ott',
    '......od', '..ooootb', '.obbddob', '.oboobbt', '.bo.ttob', '.bo..ttb',
    '.bb.ootb', 'obb.otbd', 'oob..ott', '.....obd', '....obb.', '....ob..',
    '...obb..', '..obbb..',
  ],
  eye: [
    '........', '..o.....', '..oo....', '.ootoooo', '..obbtbb', '.oobbbtt',
    'obbtttbb', 'obttxxxx', 'obtxbbtt', 'obxttbdd', 'obxttbdd', '.obxtbtt',
    '.oobxxtt', '...obbxx', '....otbb', '....obbo', '....obo.', '.....ob.',
    '......o.', '........',
  ],
  moth: [
    '........', 'o....o..', 'bo...bo.', 'bto...bo', 'tbto..ob', 'tbtxo.ob',
    'dbbtxoob', 'dxxbttob', 'tbxxbdot', '.ttbbtob', '..bbbtdb', '...odtob',
    '..ottbot', '.otxxbob', '.obxttob', '.obbtbob', '..obot.o', '..oboo..',
    '...bo...', '...o....',
  ],
};
const inks = {
  bone: {o:0x331c21, t:0xf0d49a, b:0xb3996d, d:0x715547, x:0x381f2a},
  eye: {o:0x202921, t:0x99bd5b, b:0x4e703a, d:0xc13e22, x:0xe4d5a0},
  moth: {o:0x32243b, t:0xd198c7, b:0x995997, d:0x6e406b, x:0xedb34f},
};
const cardWidth = 48, cardHeight = 64;
const editions = {
  bone: {rank: ['010', '110', '010', '010', '111'], frame: 0xbfa067, stock: 0xe6cb8d, field: 0x494046, tilt: -.075},
  eye: {rank: ['110', '001', '010', '100', '111'], frame: 0x8f9b65, stock: 0xc8cf95, field: 0x403b51, tilt: .095},
  moth: {rank: ['110', '001', '010', '001', '110'], frame: 0xa880a2, stock: 0xdcc1cb, field: 0x44384a, tilt: -.12},
};

// One cutout contains the stock, offset ink shadow and stamped portrait.
// Updating the printing does not add meshes or draw calls.
function printCard(data: Uint8Array, def: EnemyDefinition, health: number, eyeOpen: boolean) {
  const {stock, frame, field, rank} = editions[def.kind];
  const ink = 0x302a32;
  const pixel = (x: number, y: number, rgb: number) => {
    const index = ((cardHeight - 1 - y) * cardWidth + x) * 4;
    data[index] = rgb >> 16;
    data[index + 1] = rgb >> 8;
    data[index + 2] = rgb;
    data[index + 3] = 255;
  };
  const rect = (left: number, top: number, w: number, h: number, color: number) => {
    for (let y = top; y < top + h; y++)
      for (let x = left; x < left + w; x++) pixel(x, y, color);
  };
  const dieCut = (x: number, y: number) =>
    x >= 1 && y >= 1 && x <= 43 && y <= 59 && x + y >= 5 && x - y < 40 && x + y < 101;
  for (let y = 0; y < cardHeight; y++) {
    for (let x = 0; x < cardWidth; x++) {
      if (dieCut(x - 3, y - 3)) pixel(x, y, ink);
      if (dieCut(x, y)) pixel(x, y, (x + 2 * y) % 17 === 0 ? frame : stock);
    }
  }
  rect(4, 11, 37, 40, ink);
  rect(5, 12, 35, 38, field);
  // Fine diagonal hatch remains visible around the silhouette.
  for (let y = 13; y < 49; y++)
    for (let x = 6; x < 39; x++) if ((x + y) % 9 === 0) pixel(x, y, 0x635662);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 32; x++) {
      const cell = stamps[def.kind][y >> 1][Math.min(x, 31 - x) >> 1];
      if (cell === '.') continue;
      let rgb = inks[def.kind][cell as keyof typeof inks.bone];
      if (eyeOpen && def.kind === 'eye' && y >= 16 && y < 24 && x >= 11 && x < 21) {
        rgb = x >= 15 && x <= 16 && y >= 18 && y <= 21 ? 0x281b24 : 0xdf532f;
      }
      pixel(7 + x, 11 + y, rgb);
    }
  }
  rank.forEach((row, y) => [...row].forEach((bit, x) => {
    if (bit === '1') pixel(5 + x, 4 + y, ink);
  }));
  // Filing-machine barcode and a three-notch life gauge.
  for (const x of [13, 15, 16, 19, 22, 23, 24, 27, 29]) rect(x, 4, 1, 5, ink);
  rect(36, 4, 3, 3, field);
  rect(5, 53, 35, 5, ink);
  for (let i = 0; i < 3; i++) rect(6 + i * 11, 54, 10, 3, i < health ? 0xbd4938 : 0x625052);
}

export function enemySprite(scene: Scene, def: EnemyDefinition) {
  const width = cardWidth, height = cardHeight;
  const data = new Uint8Array(width * height * 4);
  printCard(data, def, 3, false);
  const texture = RawTexture.CreateRGBATexture(data, width, height, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  texture.hasAlpha = true;
  texture.wrapU = texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  const material = new StandardMaterial(def.id, scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.alphaCutOff = .5;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.backFaceCulling = false;
  const mesh = MeshBuilder.CreatePlane(def.id, {width: def.width, height: def.height}, scene);
  mesh.bakeTransformIntoVertices(Matrix.RotationZ(editions[def.kind].tilt));
  mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
  mesh.metadata = {
    enemyId: def.id,
    opaqueAt(u: number, v: number) {
      const x = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const y = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
      return data[(y * width + x) * 4 + 3] === 255;
    },
  };
  mesh.material = material;
  const base = def.height / 2 + (def.kind === 'bone' ? 0.32 : 0.52);
  mesh.position.set(def.x, base, def.z);
  let eyeOpen = false, printedHealth = 3;
  return (state: EnemyState | undefined, time: number, moving: boolean, cadence: number, beatPulse?: number) => {
    mesh.setEnabled(Boolean(state?.visible && !state.defeated));
    if (!state?.visible || state.defeated) return;
    const cel = beatPulse === undefined ? Math.floor(time * 2 + cadence) % 2
      : Math.round(Math.max(0, beatPulse) * 3) / 3;
    const pose = moving ? cel * state.energy : 0;
    const hit = state.reaction;
    const nextEyeOpen = def.kind === 'eye' && (pose > .35 || hit > .1);
    if (nextEyeOpen !== eyeOpen || state.health !== printedHealth) {
      eyeOpen = nextEyeOpen;
      printedHealth = state.health;
      printCard(data, def, printedHealth, eyeOpen);
      texture.update(data);
    }
    mesh.scaling.x = 1 + pose * (def.kind === 'moth' ? -.32 : .10) + (moving ? hit * .12 : 0);
    mesh.scaling.y = 1 - (moving ? hit * .10 : 0);
    mesh.position.y = base + pose * .15;
    material.emissiveColor.set(.82 + hit * .18, .84 - hit * .30, .81 - hit * .28);
  };
}

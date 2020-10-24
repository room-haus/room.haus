import * as BABYLON from 'babylonjs';
import CaseTexture from '../../images/mix-art/rm004.jpg';
import CDLabelTexture from '../../images/mix-labels/cd_template_RM004.png';
import {createGrid} from '../BabylonHelpers';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  const a = 1;
  scene.clearColor = new BABYLON.Color3(a, a, a);

  const grid = createGrid(scene, BABYLON.Color3.Black(), 0, 0.03);
  grid.chassis.rotation.z += Math.PI / 2;
  grid.chassis.position.y = -10;

  // Make sure the CD is rendered in front of everything else i.e. top layer
  const CD = scene.getTransformNodeByName('CDChassis');
  CD.getChildren().forEach((child) => (child.renderingGroupId = 1)); // eslint-disable-line no-return-assign

  const loadBumpyGrid = () => {
    const m = new BABYLON.StandardMaterial('texture1', scene);
    m.wireframe = true;

    const g = new BABYLON.Mesh.CreateGroundFromHeightMap(
      'ground',
      'http://i1198.photobucket.com/albums/aa455/BelindaSaxondale/album/HeightMap.jpg',
      800,
      800,
      50,
      -20,
      20,
      scene,
      true,
    );
    g.material = m;
    m.diffuseColor = BABYLON.Color3.Black();
    scene.registerBeforeRender(() => {
      const pos = g.getVerticesData('position');

      if (pos) {
        const size = 51;
        const step = 3;
        const temp1 = new Array(size);
        for (let k = 0; k < size; k++) {
          temp1[k] = pos[k * step + 1];
        }

        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            if (i > 0) {
              const indb = (i - 1) * size * step + j * step + 1;
              const ind = i * size * step + j * step + 1;
              pos[indb] = pos[ind];
            }
          }
        }
        for (let l = 0; l < size; l++) {
          pos[50 * size * step + l * step + 1] = temp1[l];
        }
        g.setVerticesData('position', pos);
      }
    });
  };

  loadBumpyGrid();

  return scene;
};

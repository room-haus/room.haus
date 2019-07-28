import * as BABYLON from 'babylonjs';
import * as Pts from 'pts';
import PtsCanvas from '../../components/PtsCanvas';
import CaseTexture from 'src/images/mix-art/mx011.jpg';
import CDLabelTexture from '../../images/cd_template_MX011.png';
import {scaleLinear} from 'd3';

export const caseTexture = CaseTexture;
export const cdLabelTexture = CDLabelTexture;

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  return scene;
};

export class Background extends PtsCanvas {
  buildScene(space, form) {
    let lines = [];
    let rotations = [];
    const createLines = () => {
      lines = [];
      rotations = [];
      const ps = Pts.Create.distributeRandom(space.innerBound, 100);
      for (let i = 0, len = ps.length; i < len; i++) {
        lines.push(
          new Pts.Group(
            ps[i],
            ps[i].clone().toAngle(Math.random() * Pts.Const.pi, (Math.random() * space.size.y) / 2 + 20, true),
          ),
        );
        rotations.push(Math.random() * 0.0002 + 0.0002);
      }
    };

    space.add({
      start: () => createLines(),
      resize: () => createLines(),
      animate: (time) => {
        const size = Math.min(space.size.y, space.size.x);
        var freqScale = scaleLinear()
          .domain([0, 100])
          .range([150, size / 2])
          .clamp(true);

        const source = this.props.source;
        const avgFreq = (source && source.getAverageFrequency()) || 0;
        const radius = freqScale(avgFreq);
        let range = Pts.Circle.fromCenter(space.center, radius);
        form.stroke('#fff').lines(lines);
        for (let i = 0, len = lines.length; i < len; i++) {
          lines[i].rotate2D(rotations[i], space.center);
          // check rays and lines intersection with pointer's range
          let inPath = Pts.Circle.intersectRay2D(range, lines[i]);
          let inLine = Pts.Circle.intersectLine2D(range, lines[i]);
          if (inPath.length > 1) {
            form.stroke('rgba(255,255,255,.20)').line(lines[i].concat(inPath[0], inPath[1]));
            form.stroke('#fe6').line(lines[i]);
            form.fillOnly('#fff').points(inPath, 2, 'circle');
          }
          if (inLine.length > 0) {
            form.stroke('#fe6').line(lines[i]);
            form.fillOnly('#ff6').points(inLine, 3, 'circle');
          }
        }
      },
    });
  }
}

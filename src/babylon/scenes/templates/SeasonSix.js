import * as BABYLON from 'babylonjs';
// import {scaleLinear} from 'd3';

// eslint-disable-next-line import/prefer-default-export
export const builder = () => ({scene}) => {
  const CD = scene.getTransformNodeByName('CDChassis');
  // Make sure the CD is rendered in front of everything else i.e. top layer
  CD.getChildren().forEach((child) => (child.renderingGroupId = 1)); // eslint-disable-line no-return-assign
  // const light = new BABYLON.PointLight('Omni', new BABYLON.Vector3(20, 20, 100), scene);
  const baseLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(-1, 1, 0), scene);
  baseLight.diffuse = new BABYLON.Color3(1, 1, 1);

  let time = 0;
  const rate = 0.01;
  scene.registerBeforeRender(() => {
    // const camera = scene.activeCamera;
    // camera.alpha = time;
    // light.position = camera.position;
    time += scene.getAnimationRatio() * rate;
  });

  initShaders();

  const shaderMaterial = new BABYLON.ShaderMaterial(
    'shader',
    scene,
    {
      vertex: 'customEffect',
      fragment: 'customEffect',
    },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['iTime', 'iResolution'],
    },
  );

  const postEffect = new BABYLON.PostProcess(
    'customEffect',
    'customEffect',
    ['iTime', 'iResolution'],
    [],
    1,
    scene.activeCamera,
  );

  postEffect.onApply = function(effect) {
    effect.setVector2('iResolution', new BABYLON.Vector2(postEffect.width, postEffect.height));
    effect.setFloat('iTime', time);
  };

  return scene;
};

function initShaders() {
  BABYLON.Effect.ShadersStore['customEffectFragmentShader'] = `
  /*--------------------------------------------------------------------------------------
  License CC0 - http://creativecommons.org/publicdomain/zero/1.0/
  To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.
  ----------------------------------------------------------------------------------------
  ^ This means do ANYTHING YOU WANT with this code. Because we are programmers, not lawyers.
  -Otavio Good
  */

  uniform float iTime;
  uniform vec2 iResolution;
  uniform sampler2D textureSampler;

  varying vec3 vPosition;
  varying vec2 vUV;

  #define iChannel0 textureSampler

  const int MAX_RAY_STEPS = 64;
  const float RAY_STOP_TRESHOLD = 0.0001;
  const int MENGER_ITERATIONS = 3;

  float maxcomp(vec2 v) { return max(v.x, v.y); }

  float sdCross(vec3 p) {
    p = abs(p);
    vec3 d = vec3(max(p.x, p.y),
            max(p.y, p.z),
            max(p.z, p.x));
    return min(d.x, min(d.y, d.z)) - (1.0 / 3.0);
  }

  float sdCrossRep(vec3 p) {
    vec3 q = mod(p + 1.0, 2.0) - 1.0;
    return sdCross(q);
  }

  float sdCrossRepScale(vec3 p, float s) {
    return sdCrossRep(p * s) / s;	
  }

  float scene(vec3 p) {
    float scale = 1.0;
    float dist = 0.0;
    for (int i = 0; i < MENGER_ITERATIONS; i++) {
      dist = max(dist, -sdCrossRepScale(p, scale));
      scale *= 3.0;
    }
    return dist;
  }

  vec3 hsv2rgb(vec3 c)
  {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  vec4 colorize(float c) {
    
    float hue = mix(0.6, 1.15, min(c * 1.2 - 0.05, 1.0));
    float sat = 1.0 - pow(c, 4.0);
    float lum = c;
    vec3 hsv = vec3(hue, sat, lum);
    vec3 rgb = hsv2rgb(hsv);
    return vec4(rgb, 1.0);	
  }


  void mainImage( out vec4 fragColor, in vec2 fragCoord )
  {
    vec2 screenPos = fragCoord.xy / iResolution.xy * 2.0 - 1.0;
  //	vec2 mousePos = iMouse.xy / iResolution.xy * 2.0 - 1.0;
    
    //vec3 cameraPos = vec3(0.16 * sin(iTime), 0.16 * cos(iTime), iTime);
    //vec3 cameraPos = vec3(0.0);
    vec3 cameraPos = vec3(0.0, 0.0, iTime);
    vec3 cameraDir = vec3(0.0, 0.0, 1.0);
    vec3 cameraPlaneU = vec3(1.0, 0.0, 0.0);
    vec3 cameraPlaneV = vec3(0.0, 1.0, 0.0) * (iResolution.y / iResolution.x);

    vec3 rayPos = cameraPos;
    vec3 rayDir = cameraDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV;
    
    rayDir = normalize(rayDir);
    
    float dist = scene(rayPos);
    int stepsTaken;
    for (int i = 0; i < MAX_RAY_STEPS; i++) {
      if (dist < RAY_STOP_TRESHOLD) {
        continue;
      }
      rayPos += rayDir * dist;
      dist = scene(rayPos);
      stepsTaken = i;
    }
    
    vec4 color = colorize(pow(float(stepsTaken) / float(MAX_RAY_STEPS), 0.9));
    
    fragColor = color;
  }
  void main() 
  {
      mainImage(gl_FragColor, vUV * iResolution.xy);
  }
  `;
}

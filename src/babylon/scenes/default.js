import * as BABYLON from 'babylonjs';

// eslint-disable-next-line import/prefer-default-export
export const build = ({scene}) => {
  scene.clearColor = new BABYLON.Color4(0.7, 0.3, 0.4, 0);
  const light = new BABYLON.HemisphericLight('hemilight', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;

  BABYLON.Effect.ShadersStore['customVertexShader'] =
    'precision highp float;\r\n' +
    '// Attributes\r\n' +
    'attribute vec3 position;\r\n' +
    'attribute vec3 normal;\r\n' +
    'attribute vec2 uv;\r\n' +
    '// Uniforms\r\n' +
    'uniform mat4 worldViewProjection;\r\n' +
    '// Varying\r\n' +
    'varying vec4 vPosition;\r\n' +
    'varying vec3 vNormal;\r\n' +
    'void main() {\r\n' +
    '    vec4 p =  vec4( position, 1. );\r\n' +
    '    vPosition = p;\r\n' +
    '    vNormal = normal;\r\n' +
    '    gl_Position = worldViewProjection * p;\r\n' +
    '}\r\n';

  BABYLON.Effect.ShadersStore['customFragmentShader'] =
    'precision highp float;\r\n' +
    'uniform mat4 worldView;\r\n' +
    'varying vec4 vPosition;\r\n' +
    'varying vec3 vNormal;\r\n' +
    'uniform sampler2D textureSampler;\r\n' +
    'uniform sampler2D refSampler;\r\n' +
    'uniform vec3 iResolution;\r\n' +
    'const float tau = 6.28318530717958647692;\r\n' +
    '// Gamma correction\r\n' +
    '#define GAMMA (2.2)\r\n' +
    'vec3 ToLinear( in vec3 col )\r\n' +
    '{\r\n' +
    '	// simulate a monitor, converting colour values into light values\r\n' +
    '	return pow( col, vec3(GAMMA) );\r\n' +
    '}\r\n' +
    'vec3 ToGamma( in vec3 col )\r\n' +
    '{\r\n' +
    '	// convert back into colour values, so the correct light will come out of the monitor\r\n' +
    '	return pow( col, vec3(1.0/GAMMA) );\r\n' +
    '}\r\n' +
    'vec4 Noise( in ivec2 x )\r\n' +
    '{\r\n' +
    '	return texture2D( refSampler, (vec2(x)+0.5)/256.0, -100.0 );\r\n' +
    '}\r\n' +
    'vec4 Rand( in int x )\r\n' +
    '{\r\n' +
    '	vec2 uv;\r\n' +
    '	uv.x = (float(x)+0.5)/256.0;\r\n' +
    '	uv.y = (floor(uv.x)+0.5)/256.0;\r\n' +
    '	return texture2D( refSampler, uv, -100.0 );\r\n' +
    '}\r\n' +
    'uniform float time;\r\n' +
    'void main(void) {\r\n' +
    '    vec3 ray;\r\n' +
    '	ray.xy = .2*(vPosition.xy-vec2(1));\r\n' +
    '	ray.z = 1.;\r\n' +
    '	float offset = time*.5;	\r\n' +
    '	float speed2 = (cos(offset)+1.0)*2.0;\r\n' +
    '	float speed = speed2+.01;\r\n' +
    '	offset += sin(offset)*.96;\r\n' +
    '	offset *= 0.1;\r\n' +
    '	\r\n' +
    '	\r\n' +
    '	vec3 col = vec3(0.);\r\n' +
    '	\r\n' +
    '	vec3 stp = ray/max(abs(ray.x),abs(ray.y));\r\n' +
    '	\r\n' +
    '	vec3 pos = 2.0*stp+.5;\r\n' +
    '	for ( int i=0; i < 20; i++ )\r\n' +
    '	{\r\n' +
    '		float z = Noise(ivec2(pos.xy)).x;\r\n' +
    '		z = fract(z-offset);\r\n' +
    '		float d = 100.0*z-pos.z;\r\n' +
    '		float w = pow(max(0.0,1.0-16.0*length(fract(pos.xy)-.5)),2.0);\r\n' +
    '		vec3 c = max(vec3(0),vec3(1.0-abs(d+speed2*.5)/speed,1.0-abs(d)/speed,1.0-abs(d-speed2*.5)/speed));\r\n' +
    '		col += 1.5*(1.0-z)*c*w;\r\n' +
    '		pos += stp;\r\n' +
    '	}\r\n' +
    '	\r\n' +
    '	gl_FragColor = vec4(ToGamma(col),1.);\r\n' +
    '}\r\n';

  const shaderMaterial = new BABYLON.ShaderMaterial(
    'shader',
    scene,
    {
      vertex: 'custom',
      fragment: 'custom',
    },
    {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'worldView', 'worldViewProjection', 'view', 'projection'],
    },
  );

  const mesh = BABYLON.Mesh.CreateBox('mesh', 100.0, scene);
  // const mesh = BABYLON.Mesh.CreateSphere('mesh', 32, 10, scene);
  mesh.position = new BABYLON.Vector3(0, 0, 0);

  const refTexture = new BABYLON.Texture('https://i.imgur.com/HP1V7TJ.png', scene);

  shaderMaterial.setTexture('refSampler', refTexture);
  shaderMaterial.setFloat('time', 0);
  shaderMaterial.setVector3('cameraPosition', BABYLON.Vector3.Zero());
  shaderMaterial.backFaceCulling = false;

  mesh.material = shaderMaterial;

  let time = -1000;

  scene.registerBeforeRender(() => {
    shaderMaterial.setFloat('time', time);
    time += 0.005;
  });

  return scene;
};

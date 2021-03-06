import React from 'react';
import * as BABYLON from 'babylonjs';
import useWindowSize from '@rehooks/window-size';
import VideoGrid from '../../components/VideoGrid';

export const build = ({scene}) => {
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 10;
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  const CAMERA_DISTANCE = 30;
  scene.activeCamera.lowerRadiusLimit = CAMERA_DISTANCE;
  scene.activeCamera.upperRadiusLimit = CAMERA_DISTANCE;

  return scene;
};

export const Background = (props) => {
  const {innerWidth, innerHeight} = useWindowSize();
  const isLandscape = innerWidth > innerHeight;
  const columns = isLandscape ? 4 : 2;
  const rows = isLandscape ? 2 : 4;
  return (
    <VideoGrid
      {...props}
      columns={columns}
      rows={rows}
      videos={[
        'https://roomhauscdnprd.blob.core.windows.net/assets/RM001/RM001BGV1/RM001BGV1.m3u8',
        'https://roomhauscdnprd.blob.core.windows.net/assets/RM001/RM001BGV2/RM001BGV2.m3u8',
        'https://roomhauscdnprd.blob.core.windows.net/assets/RM001/RM001BGV3/RM001BGV3.m3u8',
        'https://roomhauscdnprd.blob.core.windows.net/assets/RM001/RM001BGV4/RM001BGV4.m3u8',
        'https://roomhauscdnprd.blob.core.windows.net/assets/RM001/RM001BGV5/RM001BGV5.m3u8',
      ]}
    />
  );
};

/** Keep renderer perspective and interaction visibility in the same coordinates. */
export const CAMERA_VERTICAL_FOV = 1.04;

export function horizontalViewHalfAngle(width: number, height: number): number {
  return Math.atan(Math.tan(CAMERA_VERTICAL_FOV / 2) * Math.max(1, width) / Math.max(1, height));
}

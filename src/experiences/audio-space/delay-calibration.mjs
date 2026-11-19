export const SPACE_DELAY_CALIBRATION_V1 = Object.freeze({
  lowpassHz: 6500,
  highpassHz: 80,
  filterQDb: -6.0206,
  rightOffsetSeconds: 0.008,
  maxFeedback: 0.48,
  sendGain: 0.85,
  maxStereoWidth: 0.35,
});

export function spaceDelaySendGain(feedback) {
  return SPACE_DELAY_CALIBRATION_V1.sendGain * (1 - feedback);
}

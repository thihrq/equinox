export const HUMAN_CALIBRATION_POLICY_VERSION = 'champions-mb-human-calibration-v1';
export const HUMAN_CALIBRATION_ANONYMIZATION_VERSION = 'blind-review-v1';
export const HUMAN_CALIBRATION_METRIC_VERSION = 'human-calibration-metrics-v1';
export const HUMAN_REVIEW_COUNT = 20;
export const HUMAN_REVIEW_SEED = 'champions-mb-human-calibration-v1';
export function assertHumanCalibrationFlags(env: Record<string, string | undefined> = process.env): void {
  if (env.EQUINOX_ENABLE_CHAMPIONS_HUMAN_CALIBRATION !== 'true') throw new Error('CHAMPIONS_HUMAN_CALIBRATION_DISABLED');
  if (env.EQUINOX_CHAMPIONS_HUMAN_CALIBRATION_ONLY !== 'true') throw new Error('CHAMPIONS_HUMAN_CALIBRATION_MODE_REQUIRED');
  if (env.EQUINOX_CHAMPIONS_ALLOW_NETWORK_READS === 'true') throw new Error('CHAMPIONS_HUMAN_CALIBRATION_NETWORK_MUST_BE_DISABLED');
  if (env.EQUINOX_ALLOW_DATABASE_WRITES === 'true') throw new Error('CHAMPIONS_DATABASE_WRITES_MUST_BE_DISABLED');
  if (env.EQUINOX_CHAMPIONS_REGULATION_ID !== 'M-B') throw new Error('CHAMPIONS_REGULATION_ID_MISMATCH');
  if (env.EQUINOX_CHAMPIONS_HUMAN_REVIEW_COUNT !== String(HUMAN_REVIEW_COUNT)) throw new Error('CHAMPIONS_HUMAN_REVIEW_COUNT_INVALID');
}

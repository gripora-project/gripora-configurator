// Drift mode (firmware flight/pid.c pidApplyDrift(), pg/drift.c): while the
// DRIFT mode is on, the steering wheel goes straight to the servo and the
// gyro only counter-steers turn rate beyond an allowance. Per PID profile.
// Next API version; support is detected by whether
// MSP2_GRIPORA_DRIFT_CONFIG answers with a payload.
//
// Pure helpers, so the MSP decoder, the Virtual FC and the tests share them.

// Permanent box id of the DRIFT mode (msp/msp_box.c)
export const DRIFT_BOX_ID = 68;

// pg/drift.h limits
export const DRIFT_GAIN_MAX = 200; // %
export const DRIFT_ALLOW_MAX = 720; // deg/s
export const DRIFT_LIMIT_MIN = 10; // % of full lock
export const DRIFT_LIMIT_MAX = 100; // % of full lock

// drift_gain 100 % gives full counter-lock this far past the allowance
export const DRIFT_FULL_LOCK_RATE = 360; // deg/s

// U8 gain + U16 allow + U8 limit
export const DRIFT_CONFIG_LENGTH = 4;

// pg/drift.c reset template
export function defaultDriftConfig() {
  return {
    gain: 100,
    allow: 30,
    limit: 100,
  };
}

// MSP2_GRIPORA_DRIFT_CONFIG reply. Null when the payload is too short (a
// Virtual FC or firmware that doesn't fill it).
export function readDriftConfig(data) {
  if (data.byteLength < DRIFT_CONFIG_LENGTH) return null;
  return {
    gain: data.readU8(),
    allow: data.readU16(),
    limit: data.readU8(),
  };
}

// MSP2_GRIPORA_SET_DRIFT_CONFIG request, the same three fields.
export function writeDriftConfig(buffer, config) {
  buffer.push8(config.gain).push16(config.allow).push8(config.limit);
  return buffer;
}

// The checks msp.c makes on MSP2_GRIPORA_SET_DRIFT_CONFIG: any value out of
// range refuses the whole request.
export function isValidDriftConfig(config) {
  const inRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  return (
    inRange(config.gain, 0, DRIFT_GAIN_MAX) &&
    inRange(config.allow, 0, DRIFT_ALLOW_MAX) &&
    inRange(config.limit, DRIFT_LIMIT_MIN, DRIFT_LIMIT_MAX)
  );
}

// The SET request as bytes (the Virtual FC gets a plain array) back into a
// config, or null when it is shorter than the firmware accepts.
export function parseDriftConfigRequest(bytes) {
  if (!bytes || bytes.length < DRIFT_CONFIG_LENGTH) return null;
  return {
    gain: bytes[0],
    allow: bytes[1] | (bytes[2] << 8),
    limit: bytes[3],
  };
}

// Turn rate (deg/s) at which the counter-steer reaches its limit: full lock
// at limit 100 %. Null with gain 0 (no counter-steer at all).
export function driftLimitRate(config) {
  if (!(config.gain > 0)) return null;
  return Math.round(
    config.allow + (DRIFT_FULL_LOCK_RATE * config.limit) / config.gain,
  );
}

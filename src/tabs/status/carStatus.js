// Pure helpers for the Status tab's car readouts. No FC import, so
// scripts/tests/status-car.test.mjs can load this file in plain Node.

// Servo config flags (SERVO_FLAG_REVERSED).
const SERVO_FLAG_REVERSE = 1;

// MSP_RC_COMMAND steering (yaw) is -500..500, stick right positive.
const RC_COMMAND_RANGE = 500;

// The steering stick as a fraction, -1 (full left) .. 1 (full right).
export function steeringStick(rcCommandYaw) {
  if (!Number.isFinite(rcCommandYaw)) return null;
  return clamp(rcCommandYaw / RC_COMMAND_RANGE, -1, 1);
}

// The stabilized steering command a steering servo is being sent, worked
// back from its output pulse (MSP_SERVO), as a fraction with right positive,
// like the stick. Undoes servoUpdate() in the firmware's flight/servos.c
// (mid + output * scale, scale rpos on the positive side and rneg on the
// negative, output negated by Reverse) and the rule weight. The firmware
// negates RC yaw once in setpoint.c, so stabilized yaw is positive for a
// left turn: the sign is flipped back here. Null when there is no pulse yet
// (0, as before the first MSP_SERVO reply or on the Virtual FC).
//
// `surface` is a surfacesFromRules() entry (its axes.yaw weights), `config`
// the servo's FC.SERVO_CONFIG entry.
export function steeringOutput(pulse, config, surface) {
  if (!(pulse > 0) || !config || !surface?.axes?.yaw) return null;
  const offset = pulse - config.mid;
  const scale = offset >= 0 ? config.rpos : config.rneg;
  if (!(scale > 0)) return null;
  let output = offset / scale;
  if ((config.flags & SERVO_FLAG_REVERSE) !== 0) output = -output;

  // output = yaw * pos for yaw >= 0, yaw * neg below: the side whose
  // weight gives the output's sign is the one yaw is on.
  const { pos, neg } = surface.axes.yaw;
  let yaw;
  if (output === 0) yaw = 0;
  else if (pos !== 0 && output / pos > 0) yaw = output / pos;
  else if (neg !== 0 && output / neg < 0) yaw = output / neg;
  else return null;
  return clamp(-yaw, -1, 1) || 0;
}

// MSP_RAW_IMU sends each gyro axis in sensor counts (gyroRateDps() in the
// firmware's sensors/gyro_init.c divides deg/s by the sensor scale, which is
// GYRO_SCALE_2000DPS for every supported gyro). The shared decoder
// (MSPHelper.js, as in Betaflight) multiplies by 4 / 16.4, so this undoes
// that and applies the real scale.
const DECODER_FACTOR = 4 / 16.4;
const GYRO_SCALE_2000DPS = 2000 / (1 << 15);

// Turn rate in deg/s from FC.SENSOR_DATA.gyroscope[2], right positive (the
// gyro's yaw is positive for a left turn, like stabilized yaw).
export function turnRate(decodedGyroYaw) {
  if (!Number.isFinite(decodedGyroYaw)) return null;
  return -(decodedGyroYaw / DECODER_FACTOR) * GYRO_SCALE_2000DPS || 0;
}

// Throttle command -1000..1000 (MSP2_GRIPORA_DRIVE_AIDS_STATUS) as a
// fraction, negative is brake/reverse.
export function throttleFraction(command) {
  if (!Number.isFinite(command)) return null;
  return clamp(command / 1000, -1, 1);
}

// MSP_RC_COMMAND throttle is signed -500..500 around rc_center.
export function rcThrottleFraction(rcCommandThrottle) {
  if (!Number.isFinite(rcCommandThrottle)) return null;
  return clamp(rcCommandThrottle / RC_COMMAND_RANGE, -1, 1);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

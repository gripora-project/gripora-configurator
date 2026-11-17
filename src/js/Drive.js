// Drive state (firmware flight/drive.c, pg/drive.c): how the ESC treats a
// command below neutral, the driven tyre size, and how the steering gyro
// fades in with speed and works in reverse. Next API version; support is
// detected by whether MSP2_GRIPORA_DRIVE_CONFIG answers with a payload.
//
// Pure helpers, so the MSP decoder, the Virtual FC and the tests share them.

// drive_esc_mode (driveEscMode_e)
export const DRIVE_ESC_MODES = ["AUTO", "FWD_BRK_REV", "FWD_REV", "FWD_BRK"];
export const DRIVE_ESC_AUTO = 0;
export const DRIVE_ESC_FWD_BRK_REV = 1;
export const DRIVE_ESC_FWD_REV = 2;
export const DRIVE_ESC_FWD_BRK = 3;

// driveEscState_e
export const DRIVE_STATES = ["NEUTRAL", "FORWARD", "BRAKE", "REVERSE"];

// pg/drive.h limits
export const DRIVE_WHEEL_DIAMETER_MIN = 20; // mm
export const DRIVE_WHEEL_DIAMETER_MAX = 300; // mm
export const DRIVE_GYRO_SPEED_MAX = 2000; // 0.1 km/h
export const DRIVE_GYRO_MIN_SPEED_MIN = 10; // 0.1 km/h
export const DRIVE_GYRO_REVERSE_GAIN_MAX = 100; // %

// U8 + U16 + U16 + U16 + U8 + U8
export const DRIVE_CONFIG_LENGTH = 9;
// U8 + U8 + S8 + U8 + U16 + U8
export const DRIVE_STATUS_LENGTH = 7;

// pg/drive.c reset template
export function defaultDriveConfig() {
  return {
    esc_mode: DRIVE_ESC_AUTO,
    wheel_diameter: 100,
    gyro_min_speed: 20,
    gyro_full_speed: 60,
    gyro_reverse: 1,
    gyro_reverse_gain: 50,
  };
}

// MSP2_GRIPORA_DRIVE_CONFIG reply. Null when the payload is too short (a
// Virtual FC or firmware that doesn't fill it).
export function readDriveConfig(data) {
  if (data.byteLength < DRIVE_CONFIG_LENGTH) return null;
  return {
    esc_mode: data.readU8(),
    wheel_diameter: data.readU16(),
    gyro_min_speed: data.readU16(),
    gyro_full_speed: data.readU16(),
    gyro_reverse: data.readU8(),
    gyro_reverse_gain: data.readU8(),
  };
}

// MSP2_GRIPORA_SET_DRIVE_CONFIG request, the same six fields.
export function writeDriveConfig(buffer, config) {
  buffer
    .push8(config.esc_mode)
    .push16(config.wheel_diameter)
    .push16(config.gyro_min_speed)
    .push16(config.gyro_full_speed)
    .push8(config.gyro_reverse ? 1 : 0)
    .push8(config.gyro_reverse_gain);
  return buffer;
}

// The checks msp.c makes on MSP2_GRIPORA_SET_DRIVE_CONFIG: any value out of
// range (or full speed not above min speed) refuses the whole request.
export function isValidDriveConfig(config) {
  const int = (v) => Number.isInteger(v);
  return (
    int(config.esc_mode) &&
    config.esc_mode >= 0 &&
    config.esc_mode < DRIVE_ESC_MODES.length &&
    int(config.wheel_diameter) &&
    config.wheel_diameter >= DRIVE_WHEEL_DIAMETER_MIN &&
    config.wheel_diameter <= DRIVE_WHEEL_DIAMETER_MAX &&
    int(config.gyro_min_speed) &&
    config.gyro_min_speed >= DRIVE_GYRO_MIN_SPEED_MIN &&
    int(config.gyro_full_speed) &&
    config.gyro_full_speed <= DRIVE_GYRO_SPEED_MAX &&
    config.gyro_full_speed > config.gyro_min_speed &&
    (config.gyro_reverse === 0 || config.gyro_reverse === 1) &&
    int(config.gyro_reverse_gain) &&
    config.gyro_reverse_gain >= 0 &&
    config.gyro_reverse_gain <= DRIVE_GYRO_REVERSE_GAIN_MAX
  );
}

// The SET request as bytes (the Virtual FC gets a plain array) back into a
// config, or null when it is too short.
export function parseDriveConfigRequest(bytes) {
  if (!bytes || bytes.length < DRIVE_CONFIG_LENGTH) return null;
  const u16 = (i) => bytes[i] | (bytes[i + 1] << 8);
  return {
    esc_mode: bytes[0],
    wheel_diameter: u16(1),
    gyro_min_speed: u16(3),
    gyro_full_speed: u16(5),
    gyro_reverse: bytes[7],
    gyro_reverse_gain: bytes[8],
  };
}

// MSP2_GRIPORA_DRIVE_STATUS reply. Speed in 0.1 km/h, correction in %.
export function readDriveStatus(data) {
  if (data.byteLength < DRIVE_STATUS_LENGTH) return null;
  return {
    esc_mode: data.readU8(),
    state: data.readU8(),
    direction: data.read8() < 0 ? -1 : 1,
    speed_known: data.readU8() !== 0,
    speed: data.readU16(),
    correction: data.readU8(),
  };
}

export function writeDriveStatus(buffer, status) {
  buffer
    .push8(status.esc_mode)
    .push8(status.state)
    .push8(status.direction < 0 ? -1 : 1)
    .push8(status.speed_known ? 1 : 0)
    .push16(status.speed)
    .push8(status.correction);
  return buffer;
}

// driveResolveEscMode(): AUTO is FWD_REV on DShot, FWD_BRK_REV otherwise.
export function resolveEscMode(mode, dshot) {
  if (
    mode === DRIVE_ESC_FWD_BRK_REV ||
    mode === DRIVE_ESC_FWD_REV ||
    mode === DRIVE_ESC_FWD_BRK
  ) {
    return mode;
  }
  return dshot ? DRIVE_ESC_FWD_REV : DRIVE_ESC_FWD_BRK_REV;
}

// Motor turns per wheel turn from motorN_gear_ratio [output, motor]: the
// firmware's motor speed is motor RPM x output / motor (each at least 1).
export function motorTurnsPerWheelTurn(gearRatio) {
  const output = Math.max(gearRatio?.[0] ?? 1, 1);
  const motor = Math.max(gearRatio?.[1] ?? 1, 1);
  return motor / output;
}

// driveWheelRpmToKmh(): circumference in km per turn, times turns per hour.
export function wheelRpmToKmh(wheelRpm, diameterMm) {
  return Math.abs(wheelRpm) * Math.PI * diameterMm * 1e-6 * 60;
}

export function motorRpmToKmh(motorRpm, gearRatio, diameterMm) {
  return wheelRpmToKmh(
    motorRpm / motorTurnsPerWheelTurn(gearRatio),
    diameterMm,
  );
}

// driveGetCorrectionScale() once settled (no direction-change ramp), in %:
// with a known speed none below min speed, rising linearly to full at full
// speed; in reverse, the reverse gain (or nothing with the gyro off in
// reverse). Without a speed it isn't scaled by speed.
export function driveCorrectionPercent(config, speedKmh, speedKnown, direction) {
  let speedFactor = 1;
  if (speedKnown) {
    const min = config.gyro_min_speed * 0.1;
    const full = config.gyro_full_speed * 0.1;
    if (speedKmh < min) speedFactor = 0;
    else if (full <= min || speedKmh >= full) speedFactor = 1;
    else speedFactor = (speedKmh - min) / (full - min);
  }

  let reverseFactor = 1;
  if (direction < 0) {
    reverseFactor = config.gyro_reverse
      ? Math.min(config.gyro_reverse_gain, DRIVE_GYRO_REVERSE_GAIN_MAX) * 0.01
      : 0;
  }

  return Math.min(
    Math.max(Math.round(speedFactor * reverseFactor * 100), 0),
    100,
  );
}

// What the firmware's DRIVE_STATUS reports for a car that isn't driving
// (NEUTRAL, forward): the Virtual FC's reply. The wheel speed is motor 1's,
// averaged with motor 2 when that has an RPM reading too (driveUpdate()).
export function idleDriveStatus({
  config,
  dshot,
  speedKnown,
  motorRpm = [],
  gearRatios = [],
  direction = 1,
}) {
  let speedKmh = 0;
  if (speedKnown) {
    const speeds = [0, 1]
      .filter((i) => i === 0 || Number.isFinite(motorRpm[i]))
      .map((i) =>
        motorRpmToKmh(motorRpm[i] ?? 0, gearRatios[i], config.wheel_diameter),
      );
    speedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  }
  return {
    esc_mode: resolveEscMode(config.esc_mode, dshot),
    state: 0,
    direction: direction < 0 ? -1 : 1,
    speed_known: !!speedKnown,
    speed: Math.min(Math.max(Math.round(speedKmh * 10), 0), 0xffff),
    correction: driveCorrectionPercent(
      config,
      speedKmh,
      speedKnown,
      direction,
    ),
  };
}

// Drive aids (firmware flight/drive_aids.c, pg/drive_aids.c): shape the
// throttle/brake command before it reaches the ESC: timed ABS, timed
// traction control and launch control, per PID profile. Later aids
// (speed-based steering) will append their fields to the same messages. Next
// API version; support is detected by whether MSP2_GRIPORA_DRIVE_AIDS_CONFIG
// answers with a payload, and traction control and launch control by whether
// the reply carries their fields.
//
// Pure helpers, so the MSP decoder, the Virtual FC and the tests share them.

// drive_abs_mode (driveAbsMode_e)
export const DRIVE_ABS_MODES = ["OFF", "STATIC", "DYNAMIC"];
export const DRIVE_ABS_OFF = 0;
export const DRIVE_ABS_STATIC = 1;
export const DRIVE_ABS_DYNAMIC = 2;

// drive_tc_mode (driveTcMode_e)
export const DRIVE_TC_MODES = ["OFF", "RAMP"];
export const DRIVE_TC_OFF = 0;
export const DRIVE_TC_RAMP = 1;

// drive_lc_mode (driveLcMode_e)
export const DRIVE_LC_MODES = ["OFF", "SWITCH"];
export const DRIVE_LC_OFF = 0;
export const DRIVE_LC_SWITCH = 1;

// pg/drive_aids.h limits
export const DRIVE_TC_RAMP_TIME_MIN = 50; // ms, zero to full throttle
export const DRIVE_TC_RAMP_TIME_MAX = 2000; // ms
export const DRIVE_LC_THROTTLE_MIN = 10; // %, throttle allowed as a launch starts
export const DRIVE_LC_THROTTLE_MAX = 100; // %
export const DRIVE_LC_RAMP_TIME_MIN = 100; // ms, from lc_throttle to full
export const DRIVE_LC_RAMP_TIME_MAX = 5000; // ms
export const DRIVE_ABS_FREQ_MIN = 2; // Hz
export const DRIVE_ABS_FREQ_MAX = 33; // Hz
export const DRIVE_ABS_FLOOR_MAX = 100; // %
export const DRIVE_ABS_HOLD_MAX = 100; // ms
export const DRIVE_ABS_TRIGGER_MIN = 5; // %
export const DRIVE_ABS_TRIGGER_MAX = 100; // %
export const DRIVE_ABS_CORNER_FREQ_MAX = 10; // Hz added at full lock

// flight/drive_aids.h
export const DRIVE_ABS_MIN_BRAKE = 0.1; // The released brake never goes below this
export const DRIVE_ABS_FREQ_LIMIT = 40; // Hz, with the steering rate added
export const DRIVE_ABS_FULL_MAX = 0.85; // Share of a cycle at most at full brake

// MSP2_GRIPORA_DRIVE_AIDS_STATUS flags
export const DRIVE_AIDS_FLAG_ENABLED = 1 << 0;
export const DRIVE_AIDS_FLAG_ABS_ARMED = 1 << 1;
export const DRIVE_AIDS_FLAG_ABS_ACTIVE = 1 << 2;
export const DRIVE_AIDS_FLAG_TC_ARMED = 1 << 3;
export const DRIVE_AIDS_FLAG_TC_ACTIVE = 1 << 4;
export const DRIVE_AIDS_FLAG_LC_STAGED = 1 << 5;
export const DRIVE_AIDS_FLAG_LC_ACTIVE = 1 << 6;

// Nine ABS U8s; firmware without traction control stops there.
export const DRIVE_AIDS_CONFIG_LENGTH = 9;
// Then U8 tc mode + U16 tc ramp time; firmware without launch control stops
// there.
export const DRIVE_AIDS_CONFIG_TC_LENGTH = 12;
// Then U8 lc mode + U8 lc throttle + U16 lc ramp time; later aids append theirs.
export const DRIVE_AIDS_CONFIG_LC_LENGTH = 16;
// U8 + S16 + S16
export const DRIVE_AIDS_STATUS_LENGTH = 5;

// pg/drive_aids.c reset template
export function defaultDriveAidsConfig() {
  return {
    abs_mode: DRIVE_ABS_OFF,
    abs_freq: 10,
    abs_floor: 40,
    abs_hold: 20,
    abs_trigger: 30,
    abs_dyn_freq: 15,
    abs_dyn_hold: 0,
    abs_corner_freq: 0,
    abs_corner_hold: 0,
    tc_mode: DRIVE_TC_OFF,
    tc_ramp_time: 500,
    lc_mode: DRIVE_LC_OFF,
    lc_throttle: 50,
    lc_ramp_time: 1000,
  };
}

// The nine ABS fields, all U8, in wire order
const ABS_FIELDS = [
  "abs_mode",
  "abs_freq",
  "abs_floor",
  "abs_hold",
  "abs_trigger",
  "abs_dyn_freq",
  "abs_dyn_hold",
  "abs_corner_freq",
  "abs_corner_hold",
];

// MSP2_GRIPORA_DRIVE_AIDS_CONFIG reply. Reads the fields it knows and ignores
// any a newer firmware appends. `tc_supported` says whether the reply had the
// traction control fields (firmware without them sends 9 bytes),
// `lc_supported` the launch control ones (firmware without them sends 12).
// Null when the payload is too short.
export function readDriveAidsConfig(data) {
  if (data.byteLength < DRIVE_AIDS_CONFIG_LENGTH) return null;
  const config = {};
  for (const field of ABS_FIELDS) {
    config[field] = data.readU8();
  }
  config.tc_supported = data.byteLength >= DRIVE_AIDS_CONFIG_TC_LENGTH;
  if (config.tc_supported) {
    config.tc_mode = data.readU8();
    config.tc_ramp_time = data.readU16();
  }
  config.lc_supported = data.byteLength >= DRIVE_AIDS_CONFIG_LC_LENGTH;
  if (config.lc_supported) {
    config.lc_mode = data.readU8();
    config.lc_throttle = data.readU8();
    config.lc_ramp_time = data.readU16();
  }
  return config;
}

// MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG request: the ABS fields, then the
// traction control fields unless the FC doesn't have them (tc_supported
// false), then the launch control fields likewise (lc_supported false). The
// firmware leaves traction control as it is on a 9-byte request, and launch
// control on one under 16 bytes.
export function writeDriveAidsConfig(buffer, config) {
  for (const field of ABS_FIELDS) {
    buffer.push8(config[field]);
  }
  if (config.tc_supported !== false) {
    buffer.push8(config.tc_mode).push16(config.tc_ramp_time);
    if (config.lc_supported !== false) {
      buffer
        .push8(config.lc_mode)
        .push8(config.lc_throttle)
        .push16(config.lc_ramp_time);
    }
  }
  return buffer;
}

// The checks msp.c makes on MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG: any value out
// of range refuses the whole request. The traction control fields are checked
// when the config has them (a request of at least 12 bytes), the launch
// control fields likewise (at least 16 bytes).
export function isValidDriveAidsConfig(config) {
  const inRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  return (
    inRange(config.abs_mode, 0, DRIVE_ABS_MODES.length - 1) &&
    inRange(config.abs_freq, DRIVE_ABS_FREQ_MIN, DRIVE_ABS_FREQ_MAX) &&
    inRange(config.abs_floor, 0, DRIVE_ABS_FLOOR_MAX) &&
    inRange(config.abs_hold, 0, DRIVE_ABS_HOLD_MAX) &&
    inRange(config.abs_trigger, DRIVE_ABS_TRIGGER_MIN, DRIVE_ABS_TRIGGER_MAX) &&
    inRange(config.abs_dyn_freq, DRIVE_ABS_FREQ_MIN, DRIVE_ABS_FREQ_MAX) &&
    inRange(config.abs_dyn_hold, 0, DRIVE_ABS_HOLD_MAX) &&
    inRange(config.abs_corner_freq, 0, DRIVE_ABS_CORNER_FREQ_MAX) &&
    inRange(config.abs_corner_hold, 0, DRIVE_ABS_HOLD_MAX) &&
    (config.tc_mode === undefined ||
      (inRange(config.tc_mode, 0, DRIVE_TC_MODES.length - 1) &&
        inRange(
          config.tc_ramp_time,
          DRIVE_TC_RAMP_TIME_MIN,
          DRIVE_TC_RAMP_TIME_MAX,
        ))) &&
    (config.lc_mode === undefined ||
      (inRange(config.lc_mode, 0, DRIVE_LC_MODES.length - 1) &&
        inRange(
          config.lc_throttle,
          DRIVE_LC_THROTTLE_MIN,
          DRIVE_LC_THROTTLE_MAX,
        ) &&
        inRange(
          config.lc_ramp_time,
          DRIVE_LC_RAMP_TIME_MIN,
          DRIVE_LC_RAMP_TIME_MAX,
        )))
  );
}

// The SET request as bytes (the Virtual FC gets a plain array) back into a
// config, or null when it is shorter than the firmware accepts. Without the
// traction control fields (under 12 bytes) the config has none, nor launch
// control fields under 16 bytes.
export function parseDriveAidsConfigRequest(bytes) {
  if (!bytes || bytes.length < DRIVE_AIDS_CONFIG_LENGTH) return null;
  const config = Object.fromEntries(
    ABS_FIELDS.map((field, i) => [field, bytes[i]]),
  );
  if (bytes.length >= DRIVE_AIDS_CONFIG_TC_LENGTH) {
    config.tc_mode = bytes[9];
    config.tc_ramp_time = bytes[10] | (bytes[11] << 8);
  }
  if (bytes.length >= DRIVE_AIDS_CONFIG_LC_LENGTH) {
    config.lc_mode = bytes[12];
    config.lc_throttle = bytes[13];
    config.lc_ramp_time = bytes[14] | (bytes[15] << 8);
  }
  return config;
}

// MSP2_GRIPORA_DRIVE_AIDS_STATUS reply. Throttle in/out are -1000..1000,
// negative is brake or reverse.
export function readDriveAidsStatus(data) {
  if (data.byteLength < DRIVE_AIDS_STATUS_LENGTH) return null;
  const flags = data.readU8();
  return {
    enabled: !!(flags & DRIVE_AIDS_FLAG_ENABLED),
    abs_armed: !!(flags & DRIVE_AIDS_FLAG_ABS_ARMED),
    abs_active: !!(flags & DRIVE_AIDS_FLAG_ABS_ACTIVE),
    tc_armed: !!(flags & DRIVE_AIDS_FLAG_TC_ARMED),
    tc_active: !!(flags & DRIVE_AIDS_FLAG_TC_ACTIVE),
    lc_staged: !!(flags & DRIVE_AIDS_FLAG_LC_STAGED),
    lc_active: !!(flags & DRIVE_AIDS_FLAG_LC_ACTIVE),
    throttle_in: data.read16(),
    throttle_out: data.read16(),
  };
}

export function writeDriveAidsStatus(buffer, status) {
  buffer
    .push8(
      (status.enabled ? DRIVE_AIDS_FLAG_ENABLED : 0) |
        (status.abs_armed ? DRIVE_AIDS_FLAG_ABS_ARMED : 0) |
        (status.abs_active ? DRIVE_AIDS_FLAG_ABS_ACTIVE : 0) |
        (status.tc_armed ? DRIVE_AIDS_FLAG_TC_ARMED : 0) |
        (status.tc_active ? DRIVE_AIDS_FLAG_TC_ACTIVE : 0) |
        (status.lc_staged ? DRIVE_AIDS_FLAG_LC_STAGED : 0) |
        (status.lc_active ? DRIVE_AIDS_FLAG_LC_ACTIVE : 0),
    )
    .push16(status.throttle_in & 0xffff)
    .push16(status.throttle_out & 0xffff);
  return buffer;
}

// What a disarmed FC reports: aids off, nothing shaped.
export function idleDriveAidsStatus() {
  return {
    enabled: false,
    abs_armed: false,
    abs_active: false,
    tc_armed: false,
    tc_active: false,
    lc_staged: false,
    lc_active: false,
    throttle_in: 0,
    throttle_out: 0,
  };
}

// driveAbsApply()'s pulse shape for a brake command and steering lock (both
// 0..1), once past the trigger: pulse rate (Hz), floor (share of the brake),
// hold (s), the full-brake time of each cycle (s) and the brake the release
// part keeps (0..1). For the panel's preview; null when ABS would not run.
export function absPulse(config, brake, steer = 0) {
  const trigger = config.abs_trigger * 0.01;
  if (config.abs_mode === DRIVE_ABS_OFF || brake < trigger) return null;

  let freq = config.abs_freq;
  let floor = config.abs_floor * 0.01;
  let hold = config.abs_hold * 0.001;

  if (config.abs_mode === DRIVE_ABS_DYNAMIC) {
    const depth =
      trigger < 1
        ? Math.min(Math.max((brake - trigger) / (1 - trigger), 0), 1)
        : 1;
    freq += (config.abs_dyn_freq - freq) * depth;
    floor *= 1 - 0.4 * depth;
    if (config.abs_dyn_hold) {
      hold = Math.min(hold, hold + (config.abs_dyn_hold * 0.001 - hold) * depth);
    }
  }

  const lock = Math.min(Math.abs(steer), 1);
  if (config.abs_corner_freq) {
    freq += config.abs_corner_freq * lock;
  }
  if (config.abs_corner_hold) {
    hold = Math.min(
      hold,
      hold + (config.abs_corner_hold * 0.001 - hold) * lock,
    );
  }

  freq = Math.min(Math.max(freq, DRIVE_ABS_FREQ_MIN), DRIVE_ABS_FREQ_LIMIT);
  const period = 1 / freq;
  const fullTime = Math.min(period * 0.5 + hold, period * DRIVE_ABS_FULL_MAX);
  const released = Math.min(brake, Math.max(brake * floor, DRIVE_ABS_MIN_BRAKE));

  return { freq, floor, hold, period, fullTime, released };
}

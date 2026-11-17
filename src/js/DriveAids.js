// Drive aids (firmware flight/drive_aids.c, pg/drive_aids.c): shape the
// throttle/brake command before it reaches the ESC. Timed ABS first;
// traction control and speed-based steering will append their fields to the
// same messages. Next API version; support is detected by whether
// MSP2_GRIPORA_DRIVE_AIDS_CONFIG answers with a payload.
//
// Pure helpers, so the MSP decoder, the Virtual FC and the tests share them.

// drive_abs_mode (driveAbsMode_e)
export const DRIVE_ABS_MODES = ["OFF", "STATIC", "DYNAMIC"];
export const DRIVE_ABS_OFF = 0;
export const DRIVE_ABS_STATIC = 1;
export const DRIVE_ABS_DYNAMIC = 2;

// pg/drive_aids.h limits
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

// Nine U8 fields; later aids append theirs.
export const DRIVE_AIDS_CONFIG_LENGTH = 9;
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
  };
}

const CONFIG_FIELDS = Object.keys(defaultDriveAidsConfig());

// MSP2_GRIPORA_DRIVE_AIDS_CONFIG reply. Reads the fields it knows and ignores
// any a newer firmware appends. Null when the payload is too short.
export function readDriveAidsConfig(data) {
  if (data.byteLength < DRIVE_AIDS_CONFIG_LENGTH) return null;
  const config = {};
  for (const field of CONFIG_FIELDS) {
    config[field] = data.readU8();
  }
  return config;
}

// MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG request: exactly the nine fields.
export function writeDriveAidsConfig(buffer, config) {
  for (const field of CONFIG_FIELDS) {
    buffer.push8(config[field]);
  }
  return buffer;
}

// The checks msp.c makes on MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG: any value out
// of range refuses the whole request.
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
    inRange(config.abs_corner_hold, 0, DRIVE_ABS_HOLD_MAX)
  );
}

// The SET request as bytes (the Virtual FC gets a plain array) back into a
// config, or null when it is shorter than the firmware accepts.
export function parseDriveAidsConfigRequest(bytes) {
  if (!bytes || bytes.length < DRIVE_AIDS_CONFIG_LENGTH) return null;
  return Object.fromEntries(CONFIG_FIELDS.map((field, i) => [field, bytes[i]]));
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
    throttle_in: data.read16(),
    throttle_out: data.read16(),
  };
}

export function writeDriveAidsStatus(buffer, status) {
  buffer
    .push8(
      (status.enabled ? DRIVE_AIDS_FLAG_ENABLED : 0) |
        (status.abs_armed ? DRIVE_AIDS_FLAG_ABS_ARMED : 0) |
        (status.abs_active ? DRIVE_AIDS_FLAG_ABS_ACTIVE : 0),
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

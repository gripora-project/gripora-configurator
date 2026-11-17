// Driving-style starting points. Only the yaw (steering) values are applied
// and shown (STYLE_AXES below); the roll and pitch rates are left as they were
// and are not written.
//  - rates: deg/s at full steering and expo percent (the Rates tab holds
//    rate as deg/s / 500 and expo as a fraction). Sport matches the
//    firmware's default rates;
//  - I-term relax score (1-10, pidItermRelaxCutoff() in the firmware's
//    flight/pid.c: higher holds I back longer after a steering input) and
//    relax level (deg/s of input movement at which I is held fully).
// Sport is the firmware default for relax. Beginner (key "trainer") lets I
// hold the car straight sooner; Drift (key "3d") keeps I from winding up
// through big, fast counter-steer, which shows as a snap back at the end of
// a slide.
export const STYLES = [
  {
    key: "trainer",
    rate: { roll: 150, pitch: 120, yaw: 90 },
    expo: 20,
    relax: 3,
    relaxLevel: 30,
  },
  {
    key: "sport",
    rate: { roll: 250, pitch: 200, yaw: 150 },
    expo: 30,
    relax: 5,
    relaxLevel: 22,
  },
  {
    key: "3d",
    rate: { roll: 500, pitch: 400, yaw: 300 },
    expo: 60,
    relax: 7,
    relaxLevel: 15,
  },
];

// Only yaw is stabilised (yaw-rate gyro steering), so a style only sets and
// matches the yaw rate, expo and relax. Roll and pitch are left as they are.
export const STYLE_AXES = ["yaw"];
const AXIS_SUFFIX = { roll: "Roll", pitch: "Pitch", yaw: "Yaw" };

export function rateOf(rcTuning, axis) {
  return Math.round(rcTuning[`${axis}_rc_rate`] * 500);
}

export function expoOf(rcTuning, axis) {
  return Math.round(rcTuning[`${axis}_rc_expo`] * 100);
}

export function relaxOf(pidProfile, axis) {
  return pidProfile[`bounceback${AXIS_SUFFIX[axis]}`];
}

export function relaxLevelOf(pidProfile, axis) {
  return pidProfile[`itermRelaxLevel${AXIS_SUFFIX[axis]}`];
}

export function matchingStyle(rcTuning, pidProfile) {
  return (
    STYLES.find((style) =>
      STYLE_AXES.every(
        (a) =>
          rateOf(rcTuning, a) === style.rate[a] &&
          expoOf(rcTuning, a) === style.expo &&
          relaxOf(pidProfile, a) === style.relax &&
          relaxLevelOf(pidProfile, a) === style.relaxLevel,
      ),
    ) ?? null
  );
}

export function applyStyle(style, rcTuning, pidProfile) {
  for (const axis of STYLE_AXES) {
    rcTuning[`${axis}_rc_rate`] = style.rate[axis] / 500;
    rcTuning[`${axis}_rc_expo`] = style.expo / 100;
    pidProfile[`bounceback${AXIS_SUFFIX[axis]}`] = style.relax;
    pidProfile[`itermRelaxLevel${AXIS_SUFFIX[axis]}`] = style.relaxLevel;
  }
}

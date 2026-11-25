// Pure helpers for the Setup Wizard's Receiver step: channel order labels
// and detecting the order from which channel moves for each stick.
//
// RC_MAP[function] = receiver channel, functions in the order roll, pitch,
// yaw, throttle, aux 1-4 (firmware rxConfig()->rcmap).

// Letters for roll, pitch, yaw, throttle, as in "AETR".
const LETTERS = ["A", "E", "R", "T"];

// The order as the receiver sends it, e.g. [0, 1, 3, 2, ...] -> "AETR1234".
export function orderLabel(map) {
  let label = "";
  for (let channel = 0; channel < map.length; channel++) {
    const fn = map.indexOf(channel);
    label += fn < 0 ? "-" : fn < 4 ? LETTERS[fn] : String(fn - 3);
  }
  return label;
}

// A full map from the channels found for roll, pitch, yaw and throttle (in
// that order); the aux functions take the remaining channels in order.
export function mapFromDetected(found, length) {
  const rest = [];
  for (let channel = 0; channel < length; channel++) {
    if (!found.includes(channel)) rest.push(channel);
  }
  return [...found, ...rest].slice(0, length);
}

// Minimum movement (us) that counts as "this stick moved", and how much
// further it must have moved than any other channel.
export const DETECT_MIN_US = 300;
const DETECT_RATIO = 2;

// Given each channel's largest movement from its starting value so far,
// the one channel that clearly moved, or -1 while it isn't clear yet.
// Channels in `exclude` (already found) are ignored. `minUs` is lower for
// a radio trim, which moves its channel only a little.
export function movedChannel(peaks, exclude = [], minUs = DETECT_MIN_US) {
  let best = -1;
  let second = 0;
  for (let channel = 0; channel < peaks.length; channel++) {
    if (exclude.includes(channel)) continue;
    const peak = peaks[channel];
    if (best < 0 || peak > peaks[best]) {
      if (best >= 0) second = Math.max(second, peaks[best]);
      best = channel;
    } else {
      second = Math.max(second, peak);
    }
  }
  if (best < 0 || peaks[best] < minUs) return -1;
  return peaks[best] >= second * DETECT_RATIO ? best : -1;
}

//// Stick center (rc_center). Radios don't all send 1500 us at neutral
//// (some ELRS setups send 1520), and an offset reads as the wheel and
//// trigger held slightly off neutral: throttle is signed around rc_center,
//// so the car creeps or brakes.

// The range the firmware's rc_center accepts here (the Receiver tab's).
export const CENTRE_MIN = 1400;
export const CENTRE_MAX = 1600;
// A channel whose readings spread more than this (us) is still moving.
export const CENTRE_STILL_US = 10;
// The controls must agree to within this (us); otherwise a trim (or
// subtrim) is off center.
export const CENTRE_AGREE_US = 5;
// Center is worth changing when it is off by more than this (us).
export const CENTRE_OFF_US = 3;
// Controls resting this close (us) to rc_center are taken to be at neutral.
const CENTRE_NEAR_US = 60;

// From samples of the controls at neutral, each [steering, throttle] in us,
// the center, or why there isn't one:
//   { status: "ok", centre }
//   { status: "noSignal" }        no samples, or a channel reads 0
//   { status: "moving" }          a control moved while sampling
//   { status: "trim", centre }    the controls differ by more than
//                                 CENTRE_AGREE_US: a trim is off center
//   { status: "range", centre }   centre outside CENTRE_MIN..CENTRE_MAX
export function centreFromSamples(samples) {
  if (!samples?.length) return { status: "noSignal" };
  const count = samples[0].length;
  const means = [];
  for (let c = 0; c < count; c++) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const s of samples) {
      const v = s[c] ?? 0;
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
    }
    if (min <= 0) return { status: "noSignal" };
    if (max - min > CENTRE_STILL_US) return { status: "moving" };
    means.push(sum / samples.length);
  }
  const centre = Math.round(means.reduce((a, b) => a + b, 0) / count);
  if (Math.max(...means) - Math.min(...means) > CENTRE_AGREE_US) {
    return { status: "trim", centre };
  }
  if (centre < CENTRE_MIN || centre > CENTRE_MAX) {
    return { status: "range", centre };
  }
  return { status: "ok", centre };
}

// Whether a measured centre differs enough from rc_center to change it.
export function centreIsOff(centre, rcCenter) {
  return Math.abs(centre - rcCenter) > CENTRE_OFF_US;
}

// For the live hint: the centre the controls show while they rest near
// rc_center, when it differs from rc_center, otherwise null.
export function suggestedCentre(samples, rcCenter) {
  const result = centreFromSamples(samples);
  if (result.status !== "ok") return null;
  if (Math.abs(result.centre - rcCenter) > CENTRE_NEAR_US) return null;
  return centreIsOff(result.centre, rcCenter) ? result.centre : null;
}

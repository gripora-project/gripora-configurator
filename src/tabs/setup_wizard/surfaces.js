// Pure helpers for the Setup Wizard: which servos steer, how far full
// steering drives each one, and the gain/scale changes that turn a measured
// throw into a wanted one. Mirrors the firmware signal chain
// (gripora-firmware flight/mixer.c mixerUpdateRules() and flight/servos.c
// servoUpdate()):
//
//   input (+-1) * axis throw -> rule weight (input >= 0) / weightNeg (< 0)
//   -> sum on the output -> balance curve -> servo reverse
//   -> scale rpos/rneg (us) -> min/max

// Relative, not "@/js/...": scripts/tests/setup-wizard-surfaces.test.mjs
// loads this file in plain Node, which doesn't know Vite's alias.
import { ServoBalanceCurve } from "../../js/ServoBalanceCurve.js";

// The stabilized mixer input that moves a steering servo
// (MIXER_IN_STABILIZED_YAW). A car only stabilises yaw: the firmware holds
// stabilized roll and pitch at zero, so rules from them never move a servo
// and are left out.
export const AXES = [{ key: "yaw", input: 3 }];

const OP_SET = 1;
const OP_ADD = 2;

// Servo config flags (SERVO_FLAG_REVERSED).
export const SERVO_FLAG_REVERSE = 1;

// Axis Throw range offered by the Mixer tab (percent).
export const AXIS_GAIN_MIN = 0;
export const AXIS_GAIN_MAX = 200;

// Scale range the wizard will set (us per unit of output). Below the
// minimum a side has almost no travel; the maximum is the servo travel limit
// (SERVO_LIMIT_MAX in the firmware's flight/servos.h).
export const SCALE_MIN = 50;
export const SCALE_MAX = 1000;

function isSteeringInput(src) {
  return AXES.some((a) => a.input === src);
}

// The steering servos: every servo output stabilized yaw moves, with the
// weight fractions for positive and negative input. Only SET/ADD rules
// count; MUL rules and logic conditions are ignored, since the wizard sets
// up the plain steering mix. `kind` is always "steering" (the locale key
// setupWizardSurface_steering and the servo name STEER).
export function surfacesFromRules(rules, servoCount) {
  const byServo = new Map();

  for (const rule of rules) {
    if (rule.oper !== OP_SET && rule.oper !== OP_ADD) continue;
    const axis = AXES.find((a) => a.input === rule.src);
    if (!axis) continue;
    const servo = rule.dst - 1;
    if (servo < 0 || servo >= servoCount) continue;

    if (!byServo.has(servo)) {
      byServo.set(servo, { servo, axes: {} });
    }
    const entry = byServo.get(servo);
    const prev = entry.axes[axis.key] ?? { pos: 0, neg: 0 };
    const set = rule.oper === OP_SET;
    entry.axes[axis.key] = {
      pos: (set ? 0 : prev.pos) + rule.weight / 1000,
      neg: (set ? 0 : prev.neg) + rule.weightNeg / 1000,
    };
  }

  return [...byServo.values()]
    .filter((s) => Object.values(s.axes).some(moves))
    .sort((a, b) => a.servo - b.servo)
    .map((s) => ({ ...s, kind: "steering" }));
}

// Servo numbers (1-based) that the steering mix drives but that are past
// the servos in use (up to `slots`), so surfacesFromRules() leaves them out.
// The firmware only sends a servo that has a PWM output or a bus channel
// (getServoCount() in flight/servos.c), so a rear steering servo mixed onto
// servo 5 of a board with 4 servo pins and no bus output never moves.
export function servosPastCount(rules, servoCount, slots) {
  const servos = new Set();
  for (const rule of rules) {
    if (rule.oper !== OP_SET && rule.oper !== OP_ADD) continue;
    if (!isSteeringInput(rule.src)) continue;
    if (rule.weight === 0 && rule.weightNeg === 0) continue;
    if (rule.dst > servoCount && rule.dst <= slots) servos.add(rule.dst);
  }
  return [...servos].sort((a, b) => a - b);
}

function moves(w) {
  return !!w && (w.pos !== 0 || w.neg !== 0);
}

// Mixer output for this servo with the given axis held at +1 or -1
// (stick = +1 / -1) and every other axis at 0.
export function outputForAxis(surface, axisKey, stick, axisGains) {
  const w = surface.axes[axisKey];
  if (!w) return 0;
  const gain = axisGains[axisKey] ?? 1;
  const input = stick * gain;
  return input >= 0 ? input * w.pos : input * w.neg;
}

// Servo side ("pos" uses rpos/max, "neg" uses rneg/min) that a mixer output
// lands on after the servo's reverse flag.
export function servoSide(output, reversed) {
  const signed = reversed ? -output : output;
  return signed >= 0 ? "pos" : "neg";
}

// Fraction reported for a side that is asked to move but has no travel at
// all (limit 0): past the limit, and finite so it still shows as a percentage.
const NO_TRAVEL_FRACTION = 9.99;

function reachFraction(us, limit) {
  if (limit > 0) return us / limit;
  return us > 0 ? NO_TRAVEL_FRACTION : 0;
}

// Worst-case reach of each servo side with full steering in the direction
// that pushes that side furthest, in us and as a fraction of the side's
// travel limit. reach > 1 means the servo hits its limit before full
// steering.
//
// `curve` is the servo's balance curve (FC.SERVO_CURVES entry), if it has
// one. The firmware adds it to the mixer output before reverse and scale
// (servoUpdate() in flight/servos.c), so it's applied to the extremes here
// the same way.
export function travelReach(surface, servoConfig, axisGains, curve = null) {
  const reversed = (servoConfig.flags & SERVO_FLAG_REVERSE) !== 0;
  // Highest and lowest mixer output, before reverse.
  let hi = 0;
  let lo = 0;

  for (const axisKey of Object.keys(surface.axes)) {
    const up = outputForAxis(surface, axisKey, 1, axisGains);
    const down = outputForAxis(surface, axisKey, -1, axisGains);
    hi += Math.max(up, down, 0);
    lo += Math.min(up, down, 0);
  }

  if (curve) {
    hi = Math.max(hi + balanceDelta(curve, hi), 0);
    lo = Math.min(lo + balanceDelta(curve, lo), 0);
  }

  const pos = reversed ? -lo : hi;
  const neg = reversed ? -hi : lo;

  const posUs = pos * servoConfig.rpos;
  const negUs = -neg * servoConfig.rneg;
  const posLimit = Math.max(servoConfig.max, 0);
  const negLimit = Math.max(-servoConfig.min, 0);

  return {
    pos: { us: posUs, limit: posLimit, fraction: reachFraction(posUs, posLimit) },
    neg: { us: negUs, limit: negLimit, fraction: reachFraction(negUs, negLimit) },
  };
}

// Balance curve correction at mixer output `output` (+-1 scale).
function balanceDelta(curve, output) {
  return ServoBalanceCurve.evaluate(curve, output * 1000) / 1000;
}

// Axis Throw of each stabilized axis as a multiplier, from FC.MIXER_INPUTS.
export function axisGainsFromInputs(mixerInputs) {
  return Object.fromEntries(
    AXES.map((a) => [a.key, (mixerInputs?.[a.input]?.rate ?? 1000) / 1000]),
  );
}

// travelReach() for one mixer output (the rules' dst, see
// Mixer.servoOutput()), for tabs outside the wizard. Returns null when no rule moves the output, and
// { estimated: false } when its rules use something travelReach() doesn't
// model: a MUL rule, a source other than stabilized steering (yaw), a mixer
// curve, a condition, an offset, or a SET after the first rule
// (which overwrites what came before rather than adding to it).
// `servoConfig` should carry the min/max the output can actually use, and
// `curve` is the balance curve the firmware applies to it (PWM servos only).
export function outputTravelReach(
  rules,
  dst,
  servoConfig,
  axisGains,
  curve = null,
) {
  const own = rules.filter(
    (rule) =>
      rule.dst === dst &&
      (rule.weight !== 0 || rule.weightNeg !== 0 || rule.offset !== 0),
  );
  if (own.length === 0) return null;

  const modelled = own.every(
    (rule, i) =>
      (rule.oper === OP_ADD || (rule.oper === OP_SET && i === 0)) &&
      isSteeringInput(rule.src) &&
      !rule.curve &&
      !rule.condition &&
      !rule.offset,
  );
  if (!modelled) return { estimated: false };

  const surface = surfacesFromRules(own, Infinity).find(
    (s) => s.servo === dst - 1,
  );
  if (!surface) return null;

  return {
    estimated: true,
    ...travelReach(surface, servoConfig, axisGains, curve),
  };
}

// Largest scale (us) for one servo side at which full steering (mixer
// output `output` on that side) still stays inside the side's binding
// limit. Past it the servo would stop at the limit before full steering.
export function maxScale(output, sideLimit) {
  const out = Math.abs(output);
  if (!(out > 0) || !(sideLimit > 0)) return SCALE_MAX;
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.floor(sideLimit / out)));
}

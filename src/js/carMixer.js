// Car mixer preset: the rules the Mixer tab and the Setup Wizard generate for
// MODEL_TYPE_CAR, and the reverse (reading those options back out of a rule
// set). Pure, with no imports, so scripts/tests/car-mixer.test.mjs can load
// it in plain Node.
//
// The default car (gripora-firmware pg/mixer.c) is steering on S1 and a
// reversible ESC on M1. Optional extras: a rear steering servo on S2 and a
// second ESC on M2.

const OP_SET = 1;

// Mixer inputs (firmware pg/mixer.h MIXER_IN_*)
export const CAR_INPUT_STEERING = 3; // MIXER_IN_STABILIZED_YAW
export const CAR_INPUT_THROTTLE = 4; // MIXER_IN_STABILIZED_THROTTLE, -1000..1000

// Mixer outputs (firmware flight/mixer.h): S1 = 1, M1 = 27
export const CAR_OUTPUT_STEERING = 1;
export const CAR_OUTPUT_REAR_STEERING = 2;
export const CAR_OUTPUT_ESC = 27;
export const CAR_OUTPUT_SECOND_ESC = 28;

const FULL_WEIGHT = 1000;

export const REAR_STEERING_MODES = ["opposite", "same"];
export const REAR_STEERING_PERCENT_MIN = 0;
export const REAR_STEERING_PERCENT_MAX = 100;

// rearMode "opposite": the rear wheels steer against the front ones (tighter
// turns), a negative weight. "same": with them (crab), a positive weight.
export const CAR_DEFAULT_OPTIONS = Object.freeze({
  rearSteering: false,
  rearMode: "opposite",
  rearPercent: 50,
  secondEsc: false,
});

export function carOptions(options) {
  const merged = { ...CAR_DEFAULT_OPTIONS, ...options };
  const percent = Math.round(Number(merged.rearPercent));
  return {
    rearSteering: !!merged.rearSteering,
    rearMode: merged.rearMode === "same" ? "same" : "opposite",
    rearPercent: Number.isFinite(percent)
      ? Math.max(REAR_STEERING_PERCENT_MIN, Math.min(REAR_STEERING_PERCENT_MAX, percent))
      : CAR_DEFAULT_OPTIONS.rearPercent,
    secondEsc: !!merged.secondEsc,
  };
}

function setRule(src, dst, weight) {
  return {
    oper: OP_SET,
    src,
    dst,
    offset: 0,
    weight,
    weightNeg: weight,
    speed: 0,
    curve: 0,
    condition: 0,
    role: 0,
  };
}

// Rules for a car with these options, in table order. Steering and throttle
// weights stay positive: which way a servo turns is the Servos tab's servo
// reverse. Throttle is a plain SET of the signed stabilized throttle, so
// brake and reverse (below neutral) reach the ESC untouched.
export function buildCarRules(options) {
  const o = carOptions(options);
  const rules = [
    setRule(CAR_INPUT_STEERING, CAR_OUTPUT_STEERING, FULL_WEIGHT),
    setRule(CAR_INPUT_THROTTLE, CAR_OUTPUT_ESC, FULL_WEIGHT),
  ];

  if (o.rearSteering) {
    const sign = o.rearMode === "opposite" ? -1 : 1;
    // `|| 0` keeps 0% from becoming -0.
    const weight = sign * o.rearPercent * 10 || 0;
    rules.push(setRule(CAR_INPUT_STEERING, CAR_OUTPUT_REAR_STEERING, weight));
  }

  if (o.secondEsc) {
    rules.push(setRule(CAR_INPUT_THROTTLE, CAR_OUTPUT_SECOND_ESC, FULL_WEIGHT));
  }

  return rules;
}

function isNullRule(rule) {
  return (
    !rule.oper &&
    !rule.src &&
    !rule.dst &&
    !rule.weight &&
    !rule.weightNeg &&
    !rule.offset &&
    !rule.speed &&
    !rule.curve &&
    !rule.condition &&
    !rule.role
  );
}

const RULE_FIELDS = [
  "oper",
  "src",
  "dst",
  "offset",
  "weight",
  "weightNeg",
  "speed",
  "curve",
  "condition",
  "role",
];

function sameRule(a, b) {
  return RULE_FIELDS.every((field) => (a[field] ?? 0) === (b[field] ?? 0));
}

// The options buildCarRules() would have been given to produce `rules`
// (null rules anywhere are ignored), or null when the rules are anything
// else: hand-edited, from Custom, or reordered.
export function carOptionsFromRules(rules) {
  const used = (rules ?? []).filter((rule) => !isNullRule(rule));

  const rear = used.find(
    (rule) =>
      rule.oper === OP_SET &&
      rule.src === CAR_INPUT_STEERING &&
      rule.dst === CAR_OUTPUT_REAR_STEERING,
  );
  const options = carOptions({
    rearSteering: !!rear,
    rearMode: rear && rear.weight > 0 ? "same" : "opposite",
    rearPercent: rear ? Math.abs(rear.weight) / 10 : CAR_DEFAULT_OPTIONS.rearPercent,
    secondEsc: used.some(
      (rule) =>
        rule.oper === OP_SET &&
        rule.src === CAR_INPUT_THROTTLE &&
        rule.dst === CAR_OUTPUT_SECOND_ESC,
    ),
  });

  const expected = buildCarRules(options);
  if (
    expected.length !== used.length ||
    !expected.every((rule, i) => sameRule(rule, used[i]))
  ) {
    return null;
  }
  return options;
}

// Stabilized throttle must keep its negative half (brake/reverse). Puts the
// input's min back to -1000 if something clamped it at or above 0; returns
// whether it changed anything.
export function ensureSignedThrottle(mixerInputs) {
  const input = mixerInputs?.[CAR_INPUT_THROTTLE];
  if (!input || input.min < 0) return false;
  input.min = -1000;
  return true;
}

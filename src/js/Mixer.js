import semver from "semver";
import { API_VERSION_22_5 } from "@/js/configurator.svelte.js";
import { FC } from "@/js/fc.svelte.js";
import { withServoName } from "@/js/ServoNames.js";
import { RC_FUNCTION, RC_MAP_LENGTH, isParkedFunction } from "@/js/rcChannels.js";
import {
    CAR_DEFAULT_OPTIONS,
    buildCarRules,
    carOptionsFromRules,
    ensureSignedThrottle,
} from "@/js/carMixer.js";

export const Mixer = {

    // Firmware whose MSP_MIXER_CONFIG carries yaw_gyro_reverse (it reverses
    // the yaw gyro for the steering loop only; board orientation and the
    // attitude estimate are untouched). Detected by the field being present
    // in the reply rather than by version. The Virtual FC has it too.
    hasYawGyroReverse: function () {
        return FC.MIXER_CONFIG.yaw_gyro_reverse != null;
    },

    // API 22.5: 24 RC channels, where older firmware has 18.
    has24Channels: function () {
        return semver.gte(FC.CONFIG.apiVersion, API_VERSION_22_5);
    },

    get inputNames() {
        if (!this.has24Channels()) {
            return this.baseInputNames;
        }
        return [
            ...this.baseInputNames,
            ...Array.from({ length: 6 }, (_, i) => `mixerInputRCChannel${i + 19}`),
        ];
    },

    baseInputNames: [
        'mixerInputNone',
        'mixerInputStabilizedRoll',
        'mixerInputStabilizedPitch',
        'mixerInputStabilizedYaw',
        'mixerInputStabilizedThrottle',
        'mixerInputRCCommandRoll',
        'mixerInputRCCommandPitch',
        'mixerInputRCCommandYaw',
        'mixerInputRCCommandThrottle',
        'mixerInputRCChannelRoll',
        'mixerInputRCChannelPitch',
        'mixerInputRCChannelYaw',
        'mixerInputRCChannelThrottle',
        'mixerInputRCChannelAux1',
        'mixerInputRCChannelAux2',
        'mixerInputRCChannelAux3',
        'mixerInputRCChannel8',
        'mixerInputRCChannel9',
        'mixerInputRCChannel10',
        'mixerInputRCChannel11',
        'mixerInputRCChannel12',
        'mixerInputRCChannel13',
        'mixerInputRCChannel14',
        'mixerInputRCChannel15',
        'mixerInputRCChannel16',
        'mixerInputRCChannel17',
        'mixerInputRCChannel18',
        'mixerInputStabilizedTVRoll',
        'mixerInputStabilizedTVPitch',
        'mixerInputStabilizedTVYaw',
    ],

    heliOnlyInputs: [],

    // mixerInputRCChannelRoll is inputNames[9] -- Pitch/Yaw/Throttle follow
    // at 10-12. These "bypass" inputs read the RC input for that logical
    // axis *after* the firmware's rcmap indirection (rx.c's rcChannel[]),
    // so "Roll" is whatever physical channel the pilot's radio has mapped to
    // it -- there's no fixed "Roll = CH1" answer (AETR vs TAER vs custom
    // maps all differ). MSP_RX_MAP (FC.RC_MAP) reports that mapping in the
    // same Roll/Pitch/Yaw/Throttle order, so resolving the real channel just
    // means indexing it with inputIndex - RC_CHANNEL_BYPASS_FIRST.
    RC_CHANNEL_BYPASS_FIRST: 9,
    RC_CHANNEL_BYPASS_ROLES: [
        'controlAxisRoll',
        'controlAxisPitch',
        'controlAxisYaw',
        'controlAxisThrottle',
    ],

    // Label for an inputNames[] entry, resolving the RC channel inputs that
    // go through the firmware's rcmap (bypass Roll/Pitch/Yaw/Throttle and
    // CH #5-#8, which are rcCommand[4..7] = AUX 1-4) to the pilot's actual
    // physical channel (e.g. "CH #1 (Steering)", "CH #3 (AUX 1)") when rcMap
    // (FC.RC_MAP, from MSP_RX_MAP) is available. A car parks roll and pitch
    // on channels it does not otherwise use, so those read as the plain
    // channel ("CH #7"). Falls back to the plain input name otherwise.
    inputLabel: function (index, i18n, rcMap) {
        const fn = index - this.RC_CHANNEL_BYPASS_FIRST;
        if (fn >= 0 && fn < RC_MAP_LENGTH && rcMap && rcMap.length > fn) {
            const channel = rcMap[fn] + 1;
            if (isParkedFunction(fn)) {
                return `CH #${channel}`;
            }
            const role = fn < this.RC_CHANNEL_BYPASS_ROLES.length
                ? i18n.getMessage(this.RC_CHANNEL_BYPASS_ROLES[fn])
                : `AUX ${fn - RC_FUNCTION.AUX1 + 1}`;
            return `CH #${channel} (${role})`;
        }

        return i18n.getMessage(this.inputNames[index]);
    },

    // Last index of the "numbered channel" run -- inputNames[13..26] are
    // rcCommand[4..17], immediately after the bypass Roll/Pitch/Yaw/Throttle
    // run (9-12). 13-16 (AUX 1-4) still go through the rcmap, so their
    // physical channel comes from rcMap; 17-26 are CH #9..#18 as numbered.
    RC_CHANNEL_RANGE_LAST: 26,

    // CH #19..#24 (API 22.5) are inputNames[30..35], after the thrust-vector
    // inputs, so existing input numbers didn't move (firmware pg/mixer.h).
    RC_CHANNEL_HIGH_FIRST: 30,
    RC_CHANNEL_HIGH_FIRST_NUMBER: 19,

    // Physical channel number (1-based) for an inputNames[] index in the
    // combined bypass-Roll/Pitch/Yaw/Throttle + CH#5-18 run, or undefined if
    // it can't be determined (an rcmap-routed index, 9-16, without a loaded
    // rcMap, or an index outside that run entirely).
    rcChannelNumber: function (index, rcMap) {
        const fn = index - this.RC_CHANNEL_BYPASS_FIRST;
        if (fn >= 0 && fn < RC_MAP_LENGTH) {
            return rcMap && rcMap.length > fn ? rcMap[fn] + 1 : undefined;
        }
        if (index > this.RC_CHANNEL_BYPASS_FIRST + RC_MAP_LENGTH - 1 &&
            index <= this.RC_CHANNEL_RANGE_LAST) {
            return index - 8;
        }
        if (index >= this.RC_CHANNEL_HIGH_FIRST && index < this.inputNames.length) {
            return index - this.RC_CHANNEL_HIGH_FIRST + this.RC_CHANNEL_HIGH_FIRST_NUMBER;
        }
        return undefined;
    },

    // Full {value,label} input-option list, in *display* order. Same wire
    // values as inputNames, but once rcMap resolves the bypass Roll/Pitch/
    // Yaw/Throttle channels, the whole bypass+CH#5-18 run (9-26) is
    // re-sorted into ascending physical-channel order -- otherwise a
    // non-AETR radio would show e.g. "CH #2 (Roll)" ahead of "CH #1
    // (Throttle)", then jump straight to "CH #5" right after, which reads
    // as out of order even though every value is correct. Falls back to
    // plain wire-value order (bypass group by function, then CH#5-18) when
    // rcMap hasn't loaded yet, since there's nothing to sort by then.
    buildInputOptions: function (i18n, rcMap) {
        const options = this.inputNames.map((_key, i) => ({
            value: i,
            label: this.inputLabel(i, i18n, rcMap),
        }));

        const first = this.RC_CHANNEL_BYPASS_FIRST;
        const last = this.RC_CHANNEL_RANGE_LAST;
        const slice = options.slice(first, last + 1);
        const channels = slice.map((_opt, i) => this.rcChannelNumber(first + i, rcMap));
        if (channels.every((c) => c != null)) {
            slice
                .map((opt, i) => [channels[i], opt])
                .sort((a, b) => a[0] - b[0])
                .forEach(([, opt], pos) => { options[first + pos] = opt; });
        }

        // CH #19..#24 follow the thrust-vector inputs on the wire; list them
        // straight after CH #18 with the other RC channels.
        const high = options.splice(this.RC_CHANNEL_HIGH_FIRST);
        options.splice(last + 1, 0, ...high);

        return options;
    },

    // Mixer output numbers never move (firmware flight/mixer.h): 1-24 are
    // servos S1-S24, 25 and 26 are reserved and 27-30 are the motors. Servo N
    // is sent on PWM output N where the board has one and on channel N of a
    // bus output (SBUS, F.Bus) when one is set up.
    SERVO_OUTPUT_COUNT: 24,
    MOTOR_OUTPUT_COUNT: 4,
    MOTOR_OUTPUT_OFFSET: 27,

    // Servos in use, S1 up to this: the larger of the board's PWM servo
    // outputs and the servos a bus output sends (getServoCount() in the
    // firmware's flight/servos.c). null before MSP_STATUS.
    servoCount: function ()
    {
        const reported = FC.CONFIG.servoCount;
        if (reported === undefined) {
            return null;
        }
        return Math.max(0, Math.min(this.SERVO_OUTPUT_COUNT, reported));
    },

    // Servo outputs a car setup would use that aren't sent anywhere, so
    // the steering on them would never move. buildWizardRules() numbers
    // servos from 1, so it's every one past servoCount(). Returns
    // { needed, available, missing }, or null while the count is unknown.
    missingServoOutputs: function (options)
    {
        const available = this.servoCount();
        if (available === null) {
            return null;
        }
        const outputs = new Set();
        for (const rule of this.buildWizardRules(options)) {
            if (rule.dst >= 1 && !this.isMotorOutput(rule.dst)) {
                outputs.add(rule.dst);
            }
        }
        const sorted = [...outputs].sort((a, b) => a - b);
        return {
            needed: sorted.length,
            available,
            missing: sorted.filter((output) => output > available),
        };
    },

    // By mixer output number; 25 and 26 are reserved and never offered.
    get outputNames() {
        return [
            'mixerOutputNone',
            ...Array.from({ length: 26 }, (_, i) => `mixerOutputServo${i + 1}`),
            ...Array.from({ length: 4 }, (_, i) => `mixerOutputMotor${i + 1}`),
        ];
    },

    // Output numbers in display order: servos by number, then the motors.
    outputOrder: function () {
        const servos = Array.from({ length: this.SERVO_OUTPUT_COUNT }, (_, i) => i + 1);
        const motors = Array.from({ length: this.MOTOR_OUTPUT_COUNT }, (_, i) => this.MOTOR_OUTPUT_OFFSET + i);
        return [0, ...servos, ...motors];
    },

    isMotorOutput: function (index) {
        return index >= this.MOTOR_OUTPUT_OFFSET && index < this.MOTOR_OUTPUT_OFFSET + this.MOTOR_OUTPUT_COUNT;
    },

    // Mixer output number (rule dst) for a 0-based servo index (S1 = 0).
    servoOutput: function (servoIndex) {
        return servoIndex + 1;
    },

    // With the servo's name, when it has one (FC.SERVO_NAMES)
    outputLabel: function (index, i18n) {
        const label = i18n.getMessage(this.outputNames[index]);
        if (index >= 1 && index <= this.SERVO_OUTPUT_COUNT) {
            return withServoName(label, index - 1);
        }
        return label;
    },

    operNames: [
        'mixerRuleNOP',
        'mixerRuleSet',
        'mixerRuleAdd',
        'mixerRuleMul',
    ],

    OP_NUL: 0,
    OP_SET: 1,
    OP_ADD: 2,
    OP_MUL: 3,

    // Descriptive tag only -- the firmware mixer evaluator never reads it.
    // Lets tooling (this UI, RC adjustment ranges, LUA scripts) find "the"
    // rule serving a given role regardless of its array position.
    roleNames: [
        'mixerRoleNone',
        'mixerRoleFlapCompensation',
        'mixerRoleDifferentialThrustYaw',
    ],

    ROLE_NONE: 0,
    ROLE_FLAP_COMPENSATION: 1,
    ROLE_DIFFERENTIAL_THRUST_YAW: 2,

    UNINIT: -1,

    RULE_COUNT: 32,

    SPEED_MIN: 0,
    SPEED_MAX: 60000,

    // Weight/weightNeg are signed on the wire (their sign is the rule's only
    // notion of polarity now that firmware no longer has a separate reverse
    // bit), but the GUI only ever asks for a magnitude here -- polarity comes
    // from the Reverse checkbox instead. Firmware allows magnitudes up to
    // MIXER_WEIGHT_MIN/MAX (10000), but that's a 10x gain on a PWM/RX-driven
    // rule -- never a deliberate choice in practice, just a typo. Cap the GUI
    // well below that.
    WEIGHT_MIN: 0,
    WEIGHT_MAX: 5000,

    // Matches firmware's MIXER_INPUT_MIN/MAX.
    OFFSET_MIN: -2500,
    OFFSET_MAX:  2500,

    // Matches firmware's MIXER_OVERRIDE_MIN/MAX/OFF (flight/mixer.h). Values
    // in range are a forced mixer input (raw units, /1000 on the wire);
    // OFF restores normal RC/mixing control of that input.
    OVERRIDE_MIN: -2500,
    OVERRIDE_MAX:  2500,
    OVERRIDE_OFF:  2501,

    overrideEnabled: function (value)
    {
        return value >= Mixer.OVERRIDE_MIN && value <= Mixer.OVERRIDE_MAX;
    },

    //// Functions

    nullRule: function ()
    {
        return { oper: 0, src: 0, dst: 0, weight: 0, weightNeg: 0, offset: 0, speed: 0, curve: 0, condition: 0, role: 0 };
    },

    cloneRule: function (a)
    {
        return Object.assign({}, a);
    },

    compareRule : function (a, b)
    {
        return( a.oper      === b.oper &&
                a.src       === b.src &&
                a.dst       === b.dst &&
                a.weight    === b.weight &&
                a.weightNeg === b.weightNeg &&
                a.offset    === b.offset &&
                a.speed     === b.speed &&
                a.curve     === b.curve &&
                a.condition === b.condition &&
                a.role      === b.role );
    },

    cloneRules : function (a)
    {
        const self = this;
        const copy = [];

        if (a) {
            a.forEach(function (rule) {
                copy.push(self.cloneRule(rule));
            });
        }

        return copy;
    },

    //// Model types
    //
    // Mirrors mixerConfig_t.model_type in firmware (pg/mixer.h) -- purely
    // descriptive there. Here it picks the Mixer tab's view: CAR shows the
    // simplified car setup (steering, ESC, optional rear steering and second
    // ESC, see carMixer.js), CUSTOM the raw rule editor.

    MODEL_TYPE_CAR: 0,
    MODEL_TYPE_CUSTOM: 1,

    MODEL_TYPES: [
        {
            value: 0,
            key: 'CAR',
            labelKey: 'mixerModelTypeCar',
            car: true,
        },
        {
            value: 1,
            key: 'CUSTOM',
            labelKey: 'mixerModelTypeCustom',
            car: false,
        },
    ],

    modelTypeInfo: function (value)
    {
        return Mixer.MODEL_TYPES.find((t) => t.value === value) || Mixer.MODEL_TYPES[0];
    },

    // Shared by the Custom-mode preset dialog and the car setup dialog --
    // both stage a freshly generated rule set into a rule table padded/
    // truncated to match the currently loaded rule count.
    buildRuleTableFromOptions: function (options, currentRules)
    {
        const generatedRules = Mixer.buildWizardRules(options);
        const ruleCount = (currentRules && currentRules.length) || Mixer.RULE_COUNT;
        const nextRules = Array.from({ length: ruleCount }, () => Mixer.nullRule());

        generatedRules.forEach((rule, index) => {
            if (index < nextRules.length) {
                nextRules[index] = rule;
            }
        });

        return nextRules;
    },

    //// Car setup
    //
    // Options: { rearSteering, rearMode: 'opposite' | 'same', rearPercent,
    // secondEsc } (CAR_DEFAULT_OPTIONS). The result is loaded into the
    // editable rule table, not sent; servo directions are set afterwards
    // with servo reverse.

    CAR_DEFAULT_OPTIONS,

    buildWizardRules : function (options)
    {
        return buildCarRules(options);
    },

    // The car options that produced `rules`, or null if they aren't a car
    // preset (hand-edited, or from Custom).
    carOptionsFromRules : function (rules)
    {
        return carOptionsFromRules(rules);
    },

    ensureSignedThrottle : function (mixerInputs)
    {
        return ensureSignedThrottle(mixerInputs);
    },

    isNullRule : function (a) {
        return( a.oper      == 0 &&
                a.src       == 0 &&
                a.dst       == 0 &&
                a.weight    == 0 &&
                a.weightNeg == 0 &&
                a.offset    == 0 &&
                a.speed     == 0 &&
                a.curve     == 0 &&
                a.condition == 0 &&
                a.role      == 0 );
    },

    isNullMixer : function (a) {
        const self = this;

        for (let i=0; i<a.length; i++)
            if (!self.isNullRule(a[i]))
                return false;

        return true;
    },

    compareMixer : function (a, b, cnt)
    {
        const self = this;

        for (let i=0; i<cnt; i++)
            if (!self.compareRule(a[i],b[i]))
                return false;

        return true;
    },

    firstFreeRuleIndex : function (rules)
    {
        const self = this;

        for (let i=0; i<rules.length; i++)
            if (self.isNullRule(rules[i]))
                return i;

        return -1;
    },

    swapRules : function (rules, i, j)
    {
        const tmp = rules[i];
        rules[i] = rules[j];
        rules[j] = tmp;
    },

    cloneInput : function (a)
    {
        return Object.assign({}, a);
    },

    cloneInputs : function (a)
    {
        const b = [];

        a.forEach( function (input) {
            b.push(Mixer.cloneInput(input));
        });

        return b;
    },

    cloneConfig : function (orig)
    {
        return Object.assign({}, orig);
    },

};

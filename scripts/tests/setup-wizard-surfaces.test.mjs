import assert from 'node:assert/strict';
import test from 'node:test';
import {
    surfacesFromRules, outputForAxis, servoSide, servosPastCount,
    travelReach, outputTravelReach, maxScale,
} from '../../src/tabs/setup_wizard/surfaces.js';
import { STYLES, applyStyle, matchingStyle } from '../../src/tabs/setup_wizard/styles.js';

const SET = 1, ADD = 2, MUL = 3;
const ROLL = 1, PITCH = 2, YAW = 3, THROTTLE = 4, AUX1 = 13;
const rule = (oper, src, dst, weight, weightNeg = weight) => ({ oper, src, dst, weight, weightNeg, offset: 0 });
const servo = (overrides = {}) => ({ mid: 1520, min: -500, max: 500, rneg: 500, rpos: 500, flags: 0, ...overrides });
const gains = { yaw: 1 };

test('servos moved by stabilized yaw are steering; other inputs are not servos to set up', () => {
    const rules = [
        rule(SET, YAW, 1, 1000), rule(SET, YAW, 2, -500),
        rule(SET, ROLL, 3, 1000), rule(SET, PITCH, 4, 1000), rule(SET, AUX1, 5, 1000),
        rule(SET, THROTTLE, 27, 1000), // throttle to the ESC, not a servo
    ];
    const surfaces = surfacesFromRules(rules, 8);
    assert.deepEqual(surfaces.map((s) => [s.servo, s.kind]), [[0, 'steering'], [1, 'steering']]);
    assert.equal(surfaces[1].axes.yaw.pos, -0.5);
    assert.deepEqual(Object.keys(surfaces[0].axes), ['yaw']);
});

test('a later SET replaces earlier rules on the same output, ADD adds on', () => {
    const [replaced] = surfacesFromRules([rule(SET, YAW, 1, 1000), rule(SET, YAW, 1, 600)], 8);
    assert.equal(replaced.axes.yaw.pos, 0.6);
    const [added] = surfacesFromRules([rule(SET, YAW, 1, 600), rule(ADD, YAW, 1, 200)], 8);
    assert.ok(Math.abs(added.axes.yaw.pos - 0.8) < 1e-9);
});

test('a steering servo past the servos in use is reported', () => {
    const rules = [rule(SET, YAW, 1, 1000), rule(SET, YAW, 5, 1000), rule(SET, ROLL, 6, 1000)];
    assert.deepEqual(servosPastCount(rules, 4, 24), [5]);
});

test('differential weights give different reach per side', () => {
    const [steering] = surfacesFromRules([rule(SET, YAW, 1, 1000, 500)], 8);
    assert.equal(outputForAxis(steering, 'yaw', 1, gains), 1);
    assert.equal(outputForAxis(steering, 'yaw', -1, gains), -0.5);
    const reach = travelReach(steering, servo(), gains);
    assert.equal(reach.pos.us, 500);
    assert.equal(reach.neg.us, 250);
});

test('servo reverse moves the output to the other side', () => {
    assert.equal(servoSide(0.8, false), 'pos');
    assert.equal(servoSide(0.8, true), 'neg');
    const [steering] = surfacesFromRules([rule(SET, YAW, 1, 1000, 500)], 8);
    const reach = travelReach(steering, servo({ flags: 1 }), gains);
    assert.equal(reach.pos.us, 250);
    assert.equal(reach.neg.us, 500);
});

test('axis gain scales the reach, and a limit inside full steering is past 1', () => {
    const [steering] = surfacesFromRules([rule(SET, YAW, 1, 1000)], 8);
    assert.equal(travelReach(steering, servo(), { yaw: 0.5 }).pos.fraction, 0.5);
    const tight = travelReach(steering, servo({ max: 400, min: -400 }), gains);
    assert.equal(tight.pos.fraction, 1.25);
});

test('output travel is only estimated for a plain steering mix', () => {
    const config = servo();
    assert.equal(outputTravelReach([rule(SET, THROTTLE, 27, 1000)], 1, config, gains), null);
    assert.equal(outputTravelReach([rule(SET, YAW, 1, 1000)], 1, config, gains).estimated, true);
    assert.equal(outputTravelReach([rule(SET, YAW, 1, 1000), rule(MUL, AUX1, 1, 500)], 1, config, gains).estimated, false);
    assert.equal(outputTravelReach([rule(SET, AUX1, 1, 1000)], 1, config, gains).estimated, false);
});

test('largest scale that keeps full stick inside the binding limit', () => {
    assert.equal(maxScale(1, 700), 700);
    // axis gain 83%: full stick is output 0.83, so the scale may be larger
    assert.equal(maxScale(0.83, 700), 843);
    assert.equal(maxScale(-0.83, 700), 843); // either side, by magnitude
    assert.equal(maxScale(0.5, 700), 1000);  // never past the servo travel limit
    assert.equal(maxScale(1, 20), 50);       // never below the minimum
    assert.equal(maxScale(0, 700), 1000);    // axis gain 0: nothing to limit
});

test('flying styles set yaw rates and I-term relax, and are recognised afterwards', () => {
    const rcTuning = {};
    const pidProfile = {};
    for (const axis of ['roll', 'pitch', 'yaw']) {
        rcTuning[`${axis}_rc_rate`] = 0.5;
        rcTuning[`${axis}_rc_expo`] = 0;
    }
    assert.equal(matchingStyle(rcTuning, pidProfile), null);

    const threeD = STYLES.find((s) => s.key === '3d');
    applyStyle(threeD, rcTuning, pidProfile);
    assert.equal(rcTuning.yaw_rc_rate, 0.6);   // 300 deg/s, stored as deg/s / 500
    assert.equal(rcTuning.yaw_rc_expo, 0.6);
    assert.equal(pidProfile.bouncebackYaw, 7);
    assert.equal(pidProfile.itermRelaxLevelYaw, 15);
    // Only yaw is stabilised: roll and pitch are left as they were.
    assert.equal(rcTuning.roll_rc_rate, 0.5);
    assert.equal(rcTuning.pitch_rc_expo, 0);
    assert.equal(pidProfile.bouncebackPitch, undefined);
    assert.equal(matchingStyle(rcTuning, pidProfile).key, '3d');

    rcTuning.yaw_rc_rate = 0.7; // edited on the Rates tab: no longer a preset
    assert.equal(matchingStyle(rcTuning, pidProfile), null);
});

test('mode range from a flicked switch', async () => {
    const { rangeForSwitch } = await import('../../src/tabs/setup_wizard/modeRanges.js');
    // 2-position switch, low to high and high to low
    assert.deepEqual(rangeForSwitch(1000, 2000), { start: 1500, end: 2100 });
    assert.deepEqual(rangeForSwitch(2000, 1000), { start: 900, end: 1500 });
    // 3-position switch: low to middle gives the middle band only
    assert.deepEqual(rangeForSwitch(1000, 1500), { start: 1250, end: 1750 });
    // middle to high
    assert.deepEqual(rangeForSwitch(1500, 2000), { start: 1750, end: 2100 });
    // radios with 988-2012 endpoints still reach the end stops
    assert.deepEqual(rangeForSwitch(988, 2012), { start: 1500, end: 2100 });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CAR_DEFAULT_OPTIONS, buildCarRules, carOptions, carOptionsFromRules, ensureSignedThrottle,
} from '../../src/js/carMixer.js';
import { surfacesFromRules } from '../../src/tabs/setup_wizard/surfaces.js';

const SET = 1;
const YAW = 3, THROTTLE = 4;
const S1 = 1, S2 = 2, M1 = 27, M2 = 28;
const nul = () => ({ oper: 0, src: 0, dst: 0, offset: 0, weight: 0, weightNeg: 0, speed: 0, curve: 0, condition: 0, role: 0 });
const brief = (rules) => rules.map((r) => [r.oper, r.src, r.dst, r.weight, r.weightNeg]);

test('base car: steering on S1 and a reversible ESC on M1, as the firmware defaults', () => {
    const rules = buildCarRules(CAR_DEFAULT_OPTIONS);
    assert.deepEqual(brief(rules), [
        [SET, YAW, S1, 1000, 1000],
        [SET, THROTTLE, M1, 1000, 1000],
    ]);
    // Nothing that would bend or clamp the signed throttle.
    for (const rule of rules) {
        assert.equal(rule.offset, 0);
        assert.equal(rule.curve, 0);
        assert.equal(rule.condition, 0);
    }
});

test('rear steering opposite: negative weight on S2 at the chosen percentage', () => {
    const rules = buildCarRules({ rearSteering: true, rearMode: 'opposite', rearPercent: 50 });
    assert.deepEqual(brief(rules)[2], [SET, YAW, S2, -500, -500]);
    assert.equal(rules.length, 3);
});

test('rear steering same direction: positive weight on S2', () => {
    const rules = buildCarRules({ rearSteering: true, rearMode: 'same', rearPercent: 30 });
    assert.deepEqual(brief(rules)[2], [SET, YAW, S2, 300, 300]);
});

test('rear steering percentage is clamped to 0..100 and 0% is not -0', () => {
    assert.equal(buildCarRules({ rearSteering: true, rearPercent: 150 })[2].weight, -1000);
    const zero = buildCarRules({ rearSteering: true, rearPercent: -5 })[2];
    assert.ok(Object.is(zero.weight, 0));
    assert.equal(carOptions({ rearPercent: 'x' }).rearPercent, CAR_DEFAULT_OPTIONS.rearPercent);
});

test('second ESC: throttle also on M2, after rear steering', () => {
    const rules = buildCarRules({ secondEsc: true, rearSteering: true });
    assert.deepEqual(brief(rules), [
        [SET, YAW, S1, 1000, 1000],
        [SET, THROTTLE, M1, 1000, 1000],
        [SET, YAW, S2, -500, -500],
        [SET, THROTTLE, M2, 1000, 1000],
    ]);
});

test('options round-trip through the rules, with null rules in between', () => {
    const cases = [
        CAR_DEFAULT_OPTIONS,
        { rearSteering: true, rearMode: 'opposite', rearPercent: 50, secondEsc: false },
        { rearSteering: true, rearMode: 'same', rearPercent: 75, secondEsc: true },
        { rearSteering: false, rearMode: 'opposite', rearPercent: 50, secondEsc: true },
    ];
    for (const options of cases) {
        const table = [...buildCarRules(options), nul(), nul()];
        table.splice(1, 0, nul());
        assert.deepEqual(carOptionsFromRules(table), carOptions(options));
    }
});

test('hand-edited or aircraft rules are not a car setup', () => {
    const edited = buildCarRules(CAR_DEFAULT_OPTIONS);
    edited[0] = { ...edited[0], weight: 800 };
    assert.equal(carOptionsFromRules(edited), null);

    const extra = [...buildCarRules(CAR_DEFAULT_OPTIONS), { ...nul(), oper: SET, src: 1, dst: 3, weight: 1000, weightNeg: 1000 }];
    assert.equal(carOptionsFromRules(extra), null);

    const swapped = buildCarRules(CAR_DEFAULT_OPTIONS).reverse();
    assert.equal(carOptionsFromRules(swapped), null);

    assert.equal(carOptionsFromRules([]), null);
});

test('the wizard sees the steering servos and not the ESCs', () => {
    const rules = buildCarRules({ rearSteering: true, secondEsc: true });
    const surfaces = surfacesFromRules(rules, 8);
    assert.deepEqual(surfaces.map((s) => [s.servo, s.kind]), [[0, 'rudder'], [1, 'rudder']]);
    assert.equal(surfaces[1].axes.yaw.pos, -0.5);
});

test('a throttle input clamped to 0..1000 gets its reverse half back', () => {
    const inputs = [];
    inputs[4] = { rate: 1000, min: 0, max: 1000 };
    assert.equal(ensureSignedThrottle(inputs), true);
    assert.equal(inputs[4].min, -1000);
    assert.equal(ensureSignedThrottle(inputs), false);
});

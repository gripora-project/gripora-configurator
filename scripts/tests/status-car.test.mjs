import assert from 'node:assert/strict';
import test from 'node:test';
import {
    steeringStick, steeringOutput, turnRate, throttleFraction, rcThrottleFraction,
} from '../../src/tabs/status/carStatus.js';

const config = (overrides = {}) => ({ mid: 1500, rpos: 500, rneg: 400, flags: 0, ...overrides });
const steering = (pos = 1, neg = pos) => ({ servo: 0, axes: { yaw: { pos, neg } } });

test('stick is a fraction, right positive, clamped', () => {
    assert.equal(steeringStick(250), 0.5);
    assert.equal(steeringStick(-500), -1);
    assert.equal(steeringStick(700), 1);
    assert.equal(steeringStick(undefined), null);
});

test('steering output is worked back from the servo pulse, right positive', () => {
    // Stabilized yaw is positive for a left turn: a pulse above Mid on an
    // unreversed servo with a positive weight is steering left.
    assert.equal(steeringOutput(1750, config(), steering()), -0.5);
    // Below Mid uses rneg
    assert.equal(steeringOutput(1300, config(), steering()), 0.5);
    // Reverse flips it
    assert.equal(steeringOutput(1750, config({ flags: 1 }), steering()), 0.5);
    // A half weight servo at half travel is full steering
    assert.equal(steeringOutput(1750, config(), steering(0.5)), -1);
    // A negative weight (rear servo steering against the front) flips it
    assert.equal(steeringOutput(1750, config(), steering(-0.5)), 1);
    assert.equal(steeringOutput(1500, config(), steering()), 0);
});

test('no pulse or no steering servo gives no reading', () => {
    assert.equal(steeringOutput(0, config(), steering()), null);
    assert.equal(steeringOutput(1600, config(), null), null);
    assert.equal(steeringOutput(1600, config({ rpos: 0 }), steering()), null);
});

test('turn rate undoes the decoder scale, right positive', () => {
    // 100 deg/s left: the FC sends 100 / (2000 / 32768) counts, decoded * 4 / 16.4
    const decoded = (100 / (2000 / 32768)) * (4 / 16.4);
    assert.ok(Math.abs(turnRate(decoded) + 100) < 1e-9);
    assert.equal(turnRate(0), 0);
    assert.equal(turnRate(undefined), null);
});

test('throttle fractions, negative is brake/reverse', () => {
    assert.equal(throttleFraction(-250), -0.25);
    assert.equal(throttleFraction(1200), 1);
    assert.equal(rcThrottleFraction(250), 0.5);
    assert.equal(throttleFraction(undefined), null);
});

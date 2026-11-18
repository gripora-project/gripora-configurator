import assert from 'node:assert/strict';
import test from 'node:test';
import '../../src/js/injected_methods.js';
import {
    DRIFT_BOX_ID, defaultDriftConfig, readDriftConfig, writeDriftConfig, isValidDriftConfig,
    parseDriftConfigRequest, driftLimitRate,
} from '../../src/js/Drift.js';
import { MSPCodes } from '../../src/js/msp/MSPCodes.js';

const view = (bytes) => new DataView(Uint8Array.from(bytes).buffer);

test('MSP2_GRIPORA_DRIFT_CONFIG decodes the firmware wire format', () => {
    // gain 150 %, allow 300 deg/s (U16 LE), limit 60 %
    assert.deepEqual(readDriftConfig(view([150, 0x2c, 0x01, 60])), { gain: 150, allow: 300, limit: 60 });
    // Shorter than 4 bytes: not drift config
    assert.equal(readDriftConfig(view([100, 30, 0])), null);
});

test('the SET request is the same 4 bytes, and parses back', () => {
    const bytes = writeDriftConfig([], defaultDriftConfig());
    assert.deepEqual(bytes, [100, 30, 0, 100]);
    assert.deepEqual(parseDriftConfigRequest(bytes), defaultDriftConfig());
    const tuned = { gain: 200, allow: 720, limit: 10 };
    assert.deepEqual(parseDriftConfigRequest(writeDriftConfig([], tuned)), tuned);
    assert.equal(parseDriftConfigRequest([100, 30, 0]), null);
});

test('values out of the firmware ranges are refused', () => {
    const ok = defaultDriftConfig();
    assert.equal(isValidDriftConfig(ok), true);
    assert.equal(isValidDriftConfig({ ...ok, gain: 0 }), true);
    assert.equal(isValidDriftConfig({ ...ok, gain: 201 }), false);
    assert.equal(isValidDriftConfig({ ...ok, allow: 721 }), false);
    assert.equal(isValidDriftConfig({ ...ok, limit: 9 }), false);
    assert.equal(isValidDriftConfig({ ...ok, limit: 101 }), false);
    assert.equal(isValidDriftConfig({ ...ok, allow: 1.5 }), false);
});

test('the preview rate: full lock 360 deg/s past the allowance at 100 %', () => {
    assert.equal(driftLimitRate(defaultDriftConfig()), 390);
    assert.equal(driftLimitRate({ gain: 200, allow: 30, limit: 100 }), 210);
    // Limit 50 % is reached half way
    assert.equal(driftLimitRate({ gain: 100, allow: 30, limit: 50 }), 210);
    assert.equal(driftLimitRate({ gain: 0, allow: 30, limit: 100 }), null);
});

test('DRIFT is permanent box id 68 and the MSP codes match the firmware', () => {
    assert.equal(DRIFT_BOX_ID, 68);
    assert.equal(MSPCodes.MSP2_GRIPORA_DRIFT_CONFIG, 0x5F42);
    assert.equal(MSPCodes.MSP2_GRIPORA_SET_DRIFT_CONFIG, 0x5F43);
});

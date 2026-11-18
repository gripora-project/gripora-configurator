import assert from 'node:assert/strict';
import test from 'node:test';
import '../../src/js/injected_methods.js';
import {
    defaultDriveAidsConfig, readDriveAidsConfig, writeDriveAidsConfig, isValidDriveAidsConfig,
    parseDriveAidsConfigRequest, readDriveAidsStatus, writeDriveAidsStatus, idleDriveAidsStatus,
    absPulse, DRIVE_ABS_OFF, DRIVE_ABS_STATIC, DRIVE_ABS_DYNAMIC,
} from '../../src/js/DriveAids.js';

const view = (bytes) => new DataView(Uint8Array.from(bytes).buffer);
const near = (a, b) => Math.abs(a - b) < 1e-6;

const ABS_DEFAULT_BYTES = [0, 10, 40, 20, 30, 15, 0, 0, 0];
const TC_DEFAULT_BYTES = [0, 0xf4, 0x01];
const LC_DEFAULT_BYTES = [0, 50, 0xe8, 0x03];
const { lc_mode: _lm, lc_throttle: _lt, lc_ramp_time: _lr, ...tcDefaults } = defaultDriveAidsConfig();
const { tc_mode: _m, tc_ramp_time: _t, ...absDefaults } = tcDefaults;

test('MSP2_GRIPORA_DRIVE_AIDS_CONFIG decodes the firmware wire format', () => {
    // ABS, then traction control RAMP with 750 ms, then launch control SWITCH
    // from 30 % over 1500 ms
    const config = readDriveAidsConfig(view([2, 12, 50, 25, 35, 18, 10, 4, 15, 1, 0xee, 0x02, 1, 30, 0xdc, 0x05]));
    assert.deepEqual(config, {
        abs_mode: 2, abs_freq: 12, abs_floor: 50, abs_hold: 25, abs_trigger: 35,
        abs_dyn_freq: 18, abs_dyn_hold: 10, abs_corner_freq: 4, abs_corner_hold: 15,
        tc_supported: true, tc_mode: 1, tc_ramp_time: 750,
        lc_supported: true, lc_mode: 1, lc_throttle: 30, lc_ramp_time: 1500,
    });
});

test('a 9-byte reply (firmware without traction control) has no TC fields', () => {
    const config = readDriveAidsConfig(view([2, 12, 50, 25, 35, 18, 10, 4, 15]));
    assert.equal(config.tc_supported, false);
    assert.equal(config.tc_mode, undefined);
    assert.equal(config.tc_ramp_time, undefined);
    assert.equal(config.lc_supported, false);
    assert.equal(config.abs_corner_hold, 15);
    // Bytes 10 and 11 alone are not traction control either
    assert.equal(readDriveAidsConfig(view([...ABS_DEFAULT_BYTES, 1, 0xf4])).tc_supported, false);
});

test('a 12-byte reply (firmware without launch control) has no LC fields', () => {
    const config = readDriveAidsConfig(view([...ABS_DEFAULT_BYTES, 1, 0xee, 0x02]));
    assert.deepEqual(config, { ...tcDefaults, tc_supported: true, tc_mode: 1, tc_ramp_time: 750, lc_supported: false });
    // Bytes 13 to 15 alone are not launch control either
    const short = readDriveAidsConfig(view([...ABS_DEFAULT_BYTES, ...TC_DEFAULT_BYTES, 1, 30, 0xdc]));
    assert.equal(short.tc_supported, true);
    assert.equal(short.lc_supported, false);
    assert.equal(short.lc_mode, undefined);
});

test('a longer reply (fields of later aids) reads the known fields only', () => {
    const config = readDriveAidsConfig(view([1, 10, 40, 20, 30, 15, 0, 0, 0, ...TC_DEFAULT_BYTES, ...LC_DEFAULT_BYTES, 99, 98, 97]));
    assert.deepEqual(config, { ...defaultDriveAidsConfig(), abs_mode: 1, tc_supported: true, lc_supported: true });
});

test('a short or empty DRIVE_AIDS_CONFIG reply is not a config', () => {
    assert.equal(readDriveAidsConfig(view([])), null);
    assert.equal(readDriveAidsConfig(view([0, 10, 40, 20, 30, 15, 0, 0])), null);
});

test('MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG encodes all sixteen bytes', () => {
    assert.deepEqual(writeDriveAidsConfig([], defaultDriveAidsConfig()),
        [...ABS_DEFAULT_BYTES, ...TC_DEFAULT_BYTES, ...LC_DEFAULT_BYTES]);
    // Extra keys (like FC state's `supported`) are not sent
    const config = { supported: true, tc_supported: true, lc_supported: true, abs_mode: 2, abs_freq: 33,
        abs_floor: 100, abs_hold: 100, abs_trigger: 100, abs_dyn_freq: 2, abs_dyn_hold: 100,
        abs_corner_freq: 10, abs_corner_hold: 100, tc_mode: 1, tc_ramp_time: 2000,
        lc_mode: 1, lc_throttle: 100, lc_ramp_time: 5000 };
    const bytes = writeDriveAidsConfig([], config);
    assert.deepEqual(bytes, [2, 33, 100, 100, 100, 2, 100, 10, 100, 1, 0xd0, 0x07, 1, 100, 0x88, 0x13]);
    const { supported: _, ...fields } = config;
    assert.deepEqual(readDriveAidsConfig(view(bytes)), fields);
    const { tc_supported: _s, lc_supported: _l, ...request } = fields;
    assert.deepEqual(parseDriveAidsConfigRequest(bytes), request);
    assert.equal(parseDriveAidsConfigRequest(bytes.slice(0, 8)), null);
});

test('SET sends the ABS fields only to firmware without traction control', () => {
    const config = { ...defaultDriveAidsConfig(), tc_supported: false, tc_mode: 1 };
    const bytes = writeDriveAidsConfig([], config);
    assert.deepEqual(bytes, ABS_DEFAULT_BYTES);
    // And a 9-byte request carries no traction control fields
    assert.deepEqual(parseDriveAidsConfigRequest(bytes), absDefaults);
});

test('SET sends no launch control fields to firmware without launch control', () => {
    const config = { ...defaultDriveAidsConfig(), tc_supported: true, lc_supported: false, lc_mode: 1 };
    const bytes = writeDriveAidsConfig([], config);
    assert.deepEqual(bytes, [...ABS_DEFAULT_BYTES, ...TC_DEFAULT_BYTES]);
    // And a 12-byte request carries no launch control fields
    assert.deepEqual(parseDriveAidsConfigRequest(bytes), tcDefaults);
    // Nor does one with only part of them
    assert.deepEqual(parseDriveAidsConfigRequest([...bytes, 1, 30, 0xdc]), tcDefaults);
});

test('SET is validated like msp.c', () => {
    const ok = defaultDriveAidsConfig();
    assert.ok(isValidDriveAidsConfig(ok));
    const bad = [
        { abs_mode: 3 },
        { abs_freq: 1 }, { abs_freq: 34 },
        { abs_floor: 101 },
        { abs_hold: 101 },
        { abs_trigger: 4 }, { abs_trigger: 101 },
        { abs_dyn_freq: 1 }, { abs_dyn_freq: 34 },
        { abs_dyn_hold: 101 },
        { abs_corner_freq: 11 },
        { abs_corner_hold: 101 },
        { abs_floor: 40.5 },
        { tc_mode: 2 },
        { tc_ramp_time: 49 }, { tc_ramp_time: 2001 },
        { lc_mode: 2 },
        { lc_throttle: 9 }, { lc_throttle: 101 },
        { lc_ramp_time: 99 }, { lc_ramp_time: 5001 },
    ];
    for (const change of bad) {
        assert.ok(!isValidDriveAidsConfig({ ...ok, ...change }), JSON.stringify(change));
    }
    assert.ok(isValidDriveAidsConfig({ ...ok, abs_freq: 2, abs_floor: 0, abs_hold: 0, abs_trigger: 5 }));
    assert.ok(isValidDriveAidsConfig({ ...ok, tc_mode: 1, tc_ramp_time: 50 }));
    assert.ok(isValidDriveAidsConfig({ ...ok, tc_mode: 1, tc_ramp_time: 2000 }));
    assert.ok(isValidDriveAidsConfig({ ...ok, lc_mode: 1, lc_throttle: 10, lc_ramp_time: 100 }));
    assert.ok(isValidDriveAidsConfig({ ...ok, lc_mode: 1, lc_throttle: 100, lc_ramp_time: 5000 }));
    // A 9-byte request has no traction control to check, a 12-byte one no
    // launch control
    assert.ok(isValidDriveAidsConfig(absDefaults));
    assert.ok(isValidDriveAidsConfig(tcDefaults));
});

test('MSP2_GRIPORA_DRIVE_AIDS_STATUS decodes flags and signed throttle', () => {
    // aids on, ABS armed and releasing, -800 in, -320 out
    const status = readDriveAidsStatus(view([7, 0xe0, 0xfc, 0xc0, 0xfe]));
    assert.deepEqual(status, {
        enabled: true, abs_armed: true, abs_active: true, tc_armed: false, tc_active: false,
        lc_staged: false, lc_active: false, throttle_in: -800, throttle_out: -320,
    });
    assert.deepEqual(writeDriveAidsStatus([], status), [7, 0xe0, 0xfc, 0xc0, 0xfe]);
    const on = readDriveAidsStatus(view([1, 0xe8, 0x03, 0xe8, 0x03]));
    assert.equal(on.enabled, true);
    assert.equal(on.abs_armed, false);
    assert.equal(on.throttle_out, 1000);
    assert.equal(readDriveAidsStatus(view([1, 0, 0, 0])), null);
    const idle = idleDriveAidsStatus();
    assert.deepEqual(readDriveAidsStatus(view(writeDriveAidsStatus([], idle))), idle);
});

test('traction control flags: armed (bit 3) and holding back (bit 4)', () => {
    // aids on, TC armed and limiting, 900 in, 400 out
    const status = readDriveAidsStatus(view([0x19, 0x84, 0x03, 0x90, 0x01]));
    assert.deepEqual(status, {
        enabled: true, abs_armed: false, abs_active: false, tc_armed: true, tc_active: true,
        lc_staged: false, lc_active: false, throttle_in: 900, throttle_out: 400,
    });
    assert.deepEqual(writeDriveAidsStatus([], status), [0x19, 0x84, 0x03, 0x90, 0x01]);
    const armed = readDriveAidsStatus(view([0x09, 0, 0, 0, 0]));
    assert.equal(armed.tc_armed, true);
    assert.equal(armed.tc_active, false);
});

test('launch control flags: staged (bit 5) and launching (bit 6)', () => {
    // aids on, launching, 1000 in, 600 out
    const status = readDriveAidsStatus(view([0x41, 0xe8, 0x03, 0x58, 0x02]));
    assert.deepEqual(status, {
        enabled: true, abs_armed: false, abs_active: false, tc_armed: false, tc_active: false,
        lc_staged: false, lc_active: true, throttle_in: 1000, throttle_out: 600,
    });
    assert.deepEqual(writeDriveAidsStatus([], status), [0x41, 0xe8, 0x03, 0x58, 0x02]);
    // Staged on the brake: ABS armed as usual
    const staged = readDriveAidsStatus(view([0x23, 0x18, 0xfc, 0x18, 0xfc]));
    assert.equal(staged.lc_staged, true);
    assert.equal(staged.lc_active, false);
    assert.equal(staged.abs_armed, true);
    assert.equal(staged.throttle_in, -1000);
});

test('the ABS pulse follows driveAbsApply()', () => {
    const config = { ...defaultDriveAidsConfig(), abs_mode: DRIVE_ABS_STATIC };
    // Off, or below the trigger: no ABS
    assert.equal(absPulse({ ...config, abs_mode: DRIVE_ABS_OFF }, 1), null);
    assert.equal(absPulse(config, 0.29), null);
    // 10 Hz: 50 ms + 20 ms hold of full brake, then 40 % of the brake
    const p = absPulse(config, 1);
    assert.ok(near(p.freq, 10) && near(p.fullTime, 0.07) && near(p.released, 0.4));
    // The released brake never drops below 10 %, nor above the brake
    assert.ok(near(absPulse({ ...config, abs_floor: 0 }, 0.5).released, 0.1));
    assert.ok(near(absPulse({ ...config, abs_trigger: 5, abs_floor: 0 }, 0.06).released, 0.06));
    // Full brake at most 85 % of the cycle
    assert.ok(near(absPulse({ ...config, abs_freq: 33, abs_hold: 100 }, 1).fullTime, 0.85 / 33));
    // Steering adds rate; the corner hold moves with lock
    const corner = absPulse({ ...config, abs_corner_freq: 10, abs_corner_hold: 0 }, 1, -0.5);
    assert.ok(near(corner.freq, 15));
    const cornerHold = absPulse({ ...config, abs_corner_hold: 10 }, 1, 1);
    assert.ok(near(cornerHold.hold, 0.01));
    // A longer corner hold never lengthens it
    assert.ok(near(absPulse({ ...config, abs_corner_hold: 80 }, 1, 1).hold, 0.02));
});

test('DYNAMIC moves rate, floor and hold with brake depth', () => {
    const config = { ...defaultDriveAidsConfig(), abs_mode: DRIVE_ABS_DYNAMIC, abs_dyn_hold: 0 };
    // At the trigger: the static values
    const atTrigger = absPulse(config, 0.3);
    assert.ok(near(atTrigger.freq, 10) && near(atTrigger.floor, 0.4) && near(atTrigger.hold, 0.02));
    // Full brake: dyn rate, 60 % of the floor, hold unchanged with dyn hold off
    const full = absPulse(config, 1);
    assert.ok(near(full.freq, 15) && near(full.floor, 0.24) && near(full.hold, 0.02));
    // Half way, with a dyn hold
    const half = absPulse({ ...config, abs_dyn_hold: 10 }, 0.65);
    assert.ok(near(half.freq, 12.5) && near(half.floor, 0.32) && near(half.hold, 0.015));
    // Rate clamps at 40 Hz with steering added
    assert.ok(near(absPulse({ ...config, abs_dyn_freq: 33, abs_corner_freq: 10 }, 1, 1).freq, 40));
});

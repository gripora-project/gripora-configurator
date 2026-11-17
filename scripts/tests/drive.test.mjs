import assert from 'node:assert/strict';
import test from 'node:test';
import '../../src/js/injected_methods.js';
import {
    defaultDriveConfig, readDriveConfig, writeDriveConfig, isValidDriveConfig,
    parseDriveConfigRequest, readDriveStatus, writeDriveStatus, resolveEscMode,
    motorRpmToKmh, driveCorrectionPercent, idleDriveStatus,
    DRIVE_ESC_FWD_BRK_REV, DRIVE_ESC_FWD_REV, DRIVE_ESC_FWD_BRK,
} from '../../src/js/Drive.js';

const view = (bytes) => new DataView(Uint8Array.from(bytes).buffer);

test('MSP2_GRIPORA_DRIVE_CONFIG decodes the firmware wire format', () => {
    // FWD_REV, 112 mm, 2.5 km/h, 8.0 km/h, reverse on, 40 %
    const config = readDriveConfig(view([2, 112, 0, 25, 0, 80, 0, 1, 40]));
    assert.deepEqual(config, {
        esc_mode: 2, wheel_diameter: 112, gyro_min_speed: 25,
        gyro_full_speed: 80, gyro_reverse: 1, gyro_reverse_gain: 40,
    });
    // Large values use both bytes
    assert.equal(readDriveConfig(view([0, 44, 1, 10, 0, 208, 7, 0, 0])).gyro_full_speed, 2000);
});

test('a short or empty DRIVE_CONFIG reply is not a config', () => {
    assert.equal(readDriveConfig(view([])), null);
    assert.equal(readDriveConfig(view([0, 100, 0, 20, 0, 60, 0, 1])), null);
});

test('MSP2_GRIPORA_SET_DRIVE_CONFIG encodes the same nine bytes', () => {
    assert.deepEqual(writeDriveConfig([], defaultDriveConfig()), [0, 100, 0, 20, 0, 60, 0, 1, 50]);
    const config = { esc_mode: 3, wheel_diameter: 300, gyro_min_speed: 1999,
        gyro_full_speed: 2000, gyro_reverse: true, gyro_reverse_gain: 100 };
    const bytes = writeDriveConfig([], config);
    assert.deepEqual(bytes, [3, 44, 1, 207, 7, 208, 7, 1, 100]);
    // Round trip through both the reply decoder and the request parser
    assert.deepEqual(readDriveConfig(view(bytes)), { ...config, gyro_reverse: 1 });
    assert.deepEqual(parseDriveConfigRequest(bytes), { ...config, gyro_reverse: 1 });
    assert.equal(parseDriveConfigRequest(bytes.slice(0, 8)), null);
});

test('SET is validated like msp.c', () => {
    const ok = defaultDriveConfig();
    assert.ok(isValidDriveConfig(ok));
    const bad = [
        { esc_mode: 4 },
        { wheel_diameter: 19 }, { wheel_diameter: 301 },
        { gyro_min_speed: 9 },
        { gyro_full_speed: 2001 },
        { gyro_full_speed: 20 }, // not above min
        { gyro_reverse: 2 },
        { gyro_reverse_gain: 101 },
    ];
    for (const change of bad) {
        assert.ok(!isValidDriveConfig({ ...ok, ...change }), JSON.stringify(change));
    }
    assert.ok(isValidDriveConfig({ ...ok, wheel_diameter: 20, gyro_min_speed: 10, gyro_full_speed: 11 }));
    assert.ok(isValidDriveConfig({ ...ok, gyro_min_speed: 1999, gyro_full_speed: 2000, gyro_reverse_gain: 0 }));
});

test('MSP2_GRIPORA_DRIVE_STATUS decodes, with a signed direction', () => {
    // FWD_BRK_REV, REVERSE, -1, speed known, 12.3 km/h, 50 %
    const status = readDriveStatus(view([1, 3, 0xff, 1, 123, 0, 50]));
    assert.deepEqual(status, {
        esc_mode: 1, state: 3, direction: -1, speed_known: true, speed: 123, correction: 50,
    });
    assert.equal(readDriveStatus(view([2, 1, 1, 0, 0, 0, 100])).direction, 1);
    assert.equal(readDriveStatus(view([2, 1, 1, 0, 0, 0])), null);
    assert.deepEqual(writeDriveStatus([], status), [1, 3, 0xff, 1, 123, 0, 50]);
});

test('AUTO resolves from the motor protocol', () => {
    assert.equal(resolveEscMode(0, true), DRIVE_ESC_FWD_REV);
    assert.equal(resolveEscMode(0, false), DRIVE_ESC_FWD_BRK_REV);
    assert.equal(resolveEscMode(DRIVE_ESC_FWD_BRK, true), DRIVE_ESC_FWD_BRK);
    assert.equal(resolveEscMode(DRIVE_ESC_FWD_BRK_REV, true), DRIVE_ESC_FWD_BRK_REV);
});

test('speed is motor RPM through the gear ratio and tyre circumference', () => {
    // 9000 motor RPM, 9:1 ([output 1, motor 9]) = 1000 wheel RPM, 100 mm
    // tyre: 1000 * pi * 0.1 m * 60 / 1000 = 18.85 km/h
    assert.ok(Math.abs(motorRpmToKmh(9000, [1, 9], 100) - 18.8496) < 1e-3);
    // A ratio of 0 counts as 1, as in the firmware
    assert.ok(Math.abs(motorRpmToKmh(1000, [0, 0], 100) - 18.8496) < 1e-3);
});

test('gyro correction follows the firmware rule', () => {
    const config = defaultDriveConfig(); // 2.0 .. 6.0 km/h, reverse 50 %
    assert.equal(driveCorrectionPercent(config, 0, true, 1), 0);
    assert.equal(driveCorrectionPercent(config, 1.99, true, 1), 0);
    assert.equal(driveCorrectionPercent(config, 2, true, 1), 0);
    assert.equal(driveCorrectionPercent(config, 4, true, 1), 50);
    assert.equal(driveCorrectionPercent(config, 6, true, 1), 100);
    assert.equal(driveCorrectionPercent(config, 30, true, 1), 100);
    // Reverse: the reverse gain, or nothing with the gyro off in reverse
    assert.equal(driveCorrectionPercent(config, 30, true, -1), 50);
    assert.equal(driveCorrectionPercent(config, 4, true, -1), 25);
    assert.equal(driveCorrectionPercent({ ...config, gyro_reverse: 0 }, 30, true, -1), 0);
    // No speed: not scaled by speed
    assert.equal(driveCorrectionPercent(config, 0, false, 1), 100);
    assert.equal(driveCorrectionPercent(config, 0, false, -1), 50);
});

test('the Virtual FC status comes from the virtual motor', () => {
    const config = defaultDriveConfig();
    // 10000 RPM through 9:1 on a 100 mm tyre: 20.9 km/h, gyro fully on
    const status = idleDriveStatus({
        config, dshot: false, speedKnown: true,
        motorRpm: [10000], gearRatios: [[1, 9], [1, 5]],
    });
    assert.deepEqual(status, {
        esc_mode: DRIVE_ESC_FWD_BRK_REV, state: 0, direction: 1,
        speed_known: true, speed: 209, correction: 100,
    });
    // Motor 2 with RPM too: averaged, each through its own ratio
    const twin = idleDriveStatus({
        config, dshot: true, speedKnown: true,
        motorRpm: [9000, 5000], gearRatios: [[1, 9], [1, 5]],
    });
    assert.equal(twin.speed, 188);
    assert.equal(twin.esc_mode, DRIVE_ESC_FWD_REV);
    // Slow: faded
    const slow = idleDriveStatus({
        config, dshot: false, speedKnown: true,
        motorRpm: [1910], gearRatios: [[1, 9]],
    });
    assert.equal(slow.speed, 40);
    assert.equal(slow.correction, 50);
    // No RPM source: speed unknown and 0, gyro fully on
    const none = idleDriveStatus({ config, dshot: false, speedKnown: false, motorRpm: [10000] });
    assert.equal(none.speed_known, false);
    assert.equal(none.speed, 0);
    assert.equal(none.correction, 100);
    // And it encodes to what the decoder reads back
    assert.deepEqual(readDriveStatus(view(writeDriveStatus([], status))), status);
});

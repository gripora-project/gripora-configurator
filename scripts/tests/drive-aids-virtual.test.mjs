import assert from 'node:assert/strict';
import { createRequire, register } from 'node:module';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// The Virtual FC keeps the drive aids (ABS) per PID profile, as the firmware
// does. It imports the app's FC state, so this loads it the way Vite would:
// the "@/..." alias, and .svelte.js modules compiled with the Svelte compiler.
const require = createRequire(import.meta.url);
const srcRoot = new URL('../../src/', import.meta.url).href;
const compilerUrl = pathToFileURL(require.resolve('svelte/compiler')).href;
register('data:text/javascript,' + encodeURIComponent(`
    import { readFileSync } from 'node:fs';
    import { fileURLToPath } from 'node:url';
    export function resolve(specifier, context, next) {
        if (specifier.startsWith('@/')) specifier = ${JSON.stringify(srcRoot)} + specifier.slice(2);
        return next(specifier, context);
    }
    export async function load(url, context, next) {
        if (!url.endsWith('.svelte.js')) return next(url, context);
        const compiler = await import(${JSON.stringify(compilerUrl)});
        const compileModule = compiler.compileModule ?? compiler.default.compileModule;
        const filename = fileURLToPath(url);
        const { js } = compileModule(readFileSync(filename, 'utf8'), { filename, generate: 'client' });
        return { format: 'module', source: js.code, shortCircuit: true };
    }`));

// Globals the app sets up in main.svelte.js and the Vite build
Object.assign(globalThis, {
    __BACKEND__: 'web', __APP_CHANNEL__: 'dev', __APP_VERSION__: '0.0.0',
    __APP_PRODUCT_NAME__: 'Gripora Configurator', __BUILD_LABEL__: '', __COMMIT_HASH__: '',
    LRUMap: require('lru_map').LRUMap,
    bit_check: (num, bit) => ((num >> bit) % 2 != 0),
    bit_set: (num, bit) => num | 1 << bit,
    bit_clear: (num, bit) => num & ~(1 << bit),
});
// Settings storage (config.js); empty, as on a first start
const storage = new Map();
globalThis.localStorage ??= {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    key: (i) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
};
// Module-level pollers (port usage) must not keep the test process alive
const setIntervalOrig = globalThis.setInterval;
globalThis.setInterval = (...args) => setIntervalOrig(...args).unref();

await import('../../src/js/injected_methods.js');
const configurator = await import('../../src/js/configurator.svelte.js');
const { FC } = await import('../../src/js/fc.svelte.js');
const { MSPCodes } = await import('../../src/js/msp/MSPCodes.js');
const { MspHelper } = await import('../../src/js/msp/MSPHelper.js');
Object.assign(globalThis, configurator, {
    FC, MSPCodes,
    Beepers: (await import('../../src/js/Beepers.js')).Beepers,
    Features: (await import('../../src/js/features.svelte.js')).Features,
    Mixer: (await import('../../src/js/Mixer.js')).Mixer,
});
globalThis.mspHelper = new MspHelper();

const { applyVirtualConfig, getVirtualResponse, VIRTUAL_ERROR } = await import('../../src/js/virtual_fc.js');
const { defaultDriveAidsConfig, readDriveAidsConfig, writeDriveAidsConfig } = await import('../../src/js/DriveAids.js');

// What the Virtual FC answers for the active profile
function readAids() {
    const payload = getVirtualResponse(MSPCodes.MSP2_GRIPORA_DRIVE_AIDS_CONFIG);
    return readDriveAidsConfig(new DataView(payload.buffer));
}

function setAids(config) {
    return getVirtualResponse(MSPCodes.MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG, writeDriveAidsConfig([], config));
}

function selectProfile(index) {
    getVirtualResponse(MSPCodes.MSP_SELECT_SETTING, [index]);
}

// The Virtual FC has traction control, so its replies carry the TC fields
const defaults = { ...defaultDriveAidsConfig(), tc_supported: true };
const tuned = { ...defaults, abs_mode: 2, abs_freq: 12, abs_corner_hold: 15, tc_mode: 1, tc_ramp_time: 800 };

test('each PID profile has its own drive aids', () => {
    applyVirtualConfig();
    assert.equal(FC.CONFIG.profile, 0);
    assert.equal(FC.DRIVE_AIDS_CONFIG.supported, true);
    assert.deepEqual(readAids(), defaults);

    assert.deepEqual(setAids(tuned), new Uint8Array(0));
    assert.deepEqual(readAids(), tuned);

    // Another profile: still the defaults, and FC follows the selected profile
    selectProfile(1);
    assert.deepEqual(readAids(), defaults);
    assert.equal(FC.DRIVE_AIDS_CONFIG.abs_mode, 0);

    selectProfile(0);
    assert.deepEqual(readAids(), tuned);
    assert.equal(FC.DRIVE_AIDS_CONFIG.abs_mode, 2);
    assert.equal(FC.DRIVE_AIDS_CONFIG.abs_freq, 12);
    assert.equal(FC.DRIVE_AIDS_CONFIG.tc_mode, 1);
    assert.equal(FC.DRIVE_AIDS_CONFIG.tc_ramp_time, 800);
});

test('a 9-byte SET leaves traction control as it is', () => {
    applyVirtualConfig();
    assert.equal(FC.DRIVE_AIDS_CONFIG.tc_supported, true);
    setAids(tuned);
    assert.deepEqual(setAids({ ...tuned, abs_mode: 1, tc_supported: false }), new Uint8Array(0));
    assert.deepEqual(readAids(), { ...tuned, abs_mode: 1 });
});

test('saving the PID profile keeps the drive aids', () => {
    applyVirtualConfig();
    setAids(tuned);
    getVirtualResponse(MSPCodes.MSP_SET_PID_PROFILE, []);
    getVirtualResponse(MSPCodes.MSP_SET_PID_TUNING, []);
    selectProfile(1);
    selectProfile(0);
    assert.deepEqual(readAids(), tuned);
});

test('a refused SET changes nothing', () => {
    applyVirtualConfig();
    setAids(tuned);
    assert.equal(setAids({ ...tuned, abs_freq: 34 }), VIRTUAL_ERROR);
    assert.equal(setAids({ ...tuned, tc_ramp_time: 49 }), VIRTUAL_ERROR);
    assert.equal(setAids({ ...tuned, tc_mode: 2 }), VIRTUAL_ERROR);
    assert.equal(getVirtualResponse(MSPCodes.MSP2_GRIPORA_SET_DRIVE_AIDS_CONFIG, [2, 12]), VIRTUAL_ERROR);
    assert.deepEqual(readAids(), tuned);
});

test('profile copy and reset include the drive aids', () => {
    applyVirtualConfig();
    setAids(tuned);
    // MSP_COPY_PROFILE: PID profile 0 onto 2
    getVirtualResponse(MSPCodes.MSP_COPY_PROFILE, [0, 2, 0]);
    selectProfile(2);
    assert.deepEqual(readAids(), tuned);

    // MSP_SET_RESET_CURR_PID resets only the active profile
    getVirtualResponse(MSPCodes.MSP_SET_RESET_CURR_PID);
    assert.deepEqual(readAids(), defaults);
    assert.equal(FC.DRIVE_AIDS_CONFIG.abs_mode, 0);
    selectProfile(0);
    assert.deepEqual(readAids(), tuned);
});

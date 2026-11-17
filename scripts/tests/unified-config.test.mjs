import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { register } from 'node:module';
import { test } from 'node:test';

// Resolve the app's "@/..." import alias (normally handled by Vite).
const srcRoot = new URL('../../src/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
    export function resolve(specifier, context, next) {
        if (specifier.startsWith('@/')) specifier = ${JSON.stringify(srcRoot)} + specifier.slice(2);
        return next(specifier, context);
    }`));

const require = createRequire(import.meta.url);
globalThis.LRUMap = require('lru_map').LRUMap;
globalThis.__BACKEND__ = 'web';

const { cleanUnifiedConfigFile } = await import('../../src/tabs/firmware_flasher/util.js');

// "serial 0 ..." and "set serialrx..." are stripped from Betaflight configs
// but kept for the Rotorflight-style forks.
const body = 'board_name TEST\nserial 0 64 115200 57600 0 115200\nset serialrx_provider = SBUS\n';

for (const fork of ['Gripora', 'Rotorflight', 'Wingflight']) {
    test(`${fork} target config keeps its serial lines`, () => {
        const cfg = cleanUnifiedConfigFile(`# ${fork} / STM32F405 (S405) 4.6.0\n${body}`);
        assert.match(cfg, /^# .* \/ STM32F405/);
        assert.match(cfg, /^serial 0 /m);
        assert.match(cfg, /^set serialrx_provider/m);
    });
}

test('Betaflight target config drops its serial lines', () => {
    const cfg = cleanUnifiedConfigFile(`# Betaflight / STM32F405 (S405) 4.4.0\n${body}`);
    assert.match(cfg, /^# Betaflight \/ STM32F405/);
    assert.doesNotMatch(cfg, /^serial 0 /m);
    assert.doesNotMatch(cfg, /^set serialrx_provider/m);
});

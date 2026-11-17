import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAR_RC_MAP,
  RC_FUNCTION,
  assignFunction,
  carMapFromControls,
  auxChannelLabel,
  carOrderLabel,
  channelNumber,
  controlFunctions,
  matchPreset,
  parkRollPitch,
  parseCarOrder,
  parseChannelOrder,
} from "../../src/js/rcChannels.js";

const { ROLL, PITCH, STEERING, THROTTLE, AUX1 } = RC_FUNCTION;

// Every control on its own channel, roll and pitch on two others.
function assertParked(map) {
  assert.equal(map.length, 8);
  assert.deepEqual([...map].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  const controls = controlFunctions(8).map((fn) => map[fn]);
  assert.ok(!controls.includes(map[ROLL]));
  assert.ok(!controls.includes(map[PITCH]));
}

test("the car preset matches the firmware default RT1234AE", () => {
  // Firmware parseRcChannels("RT1234AE") with rcChannelLetters "AERT1234".
  assert.deepEqual(parseChannelOrder("RT1234AE"), [6, 7, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...CAR_RC_MAP], [6, 7, 0, 1, 2, 3, 4, 5]);
  assert.equal(carOrderLabel(CAR_RC_MAP), "ST1234--");
  assert.equal(matchPreset([6, 7, 0, 1, 2, 3, 4, 5]), "car");
  assert.equal(matchPreset([0, 1, 3, 2, 4, 5, 6, 7]), null);
  assertParked(CAR_RC_MAP);
});

test("parkRollPitch leaves a valid car map alone", () => {
  assert.deepEqual(parkRollPitch([...CAR_RC_MAP]), [...CAR_RC_MAP]);
  // Roll and pitch swapped is still parked: keep it, no spurious change.
  assert.deepEqual(
    parkRollPitch([7, 6, 0, 1, 2, 3, 4, 5]),
    [7, 6, 0, 1, 2, 3, 4, 5],
  );
});

test("parkRollPitch moves roll and pitch off channels the controls use", () => {
  // An aircraft AETR1234 map: roll and pitch sit on CH1 and CH2, which is
  // fine as long as no control is there.
  const aetr = parkRollPitch([0, 1, 3, 2, 4, 5, 6, 7]);
  assert.deepEqual(aetr, [0, 1, 3, 2, 4, 5, 6, 7]);
  assertParked(aetr);

  // Roll shares CH1 with steering: it goes to a free channel, CH7 first.
  const shared = parkRollPitch([0, 7, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(shared, [6, 7, 0, 1, 2, 3, 4, 5]);
});

test("parkRollPitch repairs duplicate and out-of-range controls", () => {
  // Throttle and aux 1 both on CH2, aux 4 out of range.
  const map = parkRollPitch([6, 7, 0, 1, 1, 3, 4, 99]);
  assertParked(map);
  assert.equal(map[STEERING], 0);
  assert.equal(map[THROTTLE], 1);
  // Low channels first for the controls, CH7/CH8 kept for parking.
  assert.equal(map[AUX1], 2);
  assert.equal(map[AUX1 + 3], 5);
  assert.deepEqual([map[ROLL], map[PITCH]], [6, 7]);
});

test("assignFunction swaps and re-parks", () => {
  // Throttle to CH1: steering takes CH2.
  const swapped = assignFunction([...CAR_RC_MAP], 0, THROTTLE);
  assert.deepEqual(swapped, [6, 7, 1, 0, 2, 3, 4, 5]);
  assertParked(swapped);

  // Steering onto CH7 (where roll is parked): roll takes CH1, the one
  // steering left, and stays off every control.
  const onSeven = assignFunction([...CAR_RC_MAP], 6, STEERING);
  assertParked(onSeven);
  assert.equal(onSeven[STEERING], 6);
  assert.equal(onSeven[ROLL], 0);
  assert.equal(onSeven[PITCH], 7);
  assert.equal(carOrderLabel(onSeven), "-T1234S-");

  // Aux 4 to CH8 as well: pitch ends up on CH6.
  const both = assignFunction(onSeven, 7, AUX1 + 3);
  assertParked(both);
  assert.equal(carOrderLabel(both), "-T123-S4");
  assert.deepEqual([both[ROLL], both[PITCH]], [0, 5]);
});

test("parseCarOrder reads typed orders", () => {
  assert.deepEqual(parseCarOrder("ST1234--"), [...CAR_RC_MAP]);
  assert.deepEqual(parseCarOrder("st1234"), [...CAR_RC_MAP]);
  // Missing functions fill the next channels in order.
  assert.deepEqual(parseCarOrder("TS"), [6, 7, 1, 0, 2, 3, 4, 5]);
  assert.equal(carOrderLabel(parseCarOrder("TS")), "TS1234--");
  // "-" keeps a channel free for parking.
  const gap = parseCarOrder("S-T");
  assertParked(gap);
  assert.equal(carOrderLabel(gap), "S-T1234-");
  // Firmware R for steering is accepted too.
  assert.deepEqual(parseCarOrder("RT1234"), [...CAR_RC_MAP]);
  // Invalid: duplicates, unknown letters, too long, empty.
  assert.equal(parseCarOrder("SS"), null);
  assert.equal(parseCarOrder("SA"), null);
  assert.equal(parseCarOrder("ST1234--5"), null);
  assert.equal(parseCarOrder("ST5"), null);
  assert.equal(parseCarOrder(""), null);
});

test("round trip: every order label parses back to the same order", () => {
  // Every placement of steering and throttle over 8 channels.
  for (let s = 0; s < 8; s++) {
    for (let t = 0; t < 8; t++) {
      if (s === t) continue;
      let map = assignFunction([...CAR_RC_MAP], s, STEERING);
      map = assignFunction(map, t, THROTTLE);
      assertParked(map);
      assert.equal(map[STEERING], s);
      assert.equal(map[THROTTLE], t);
      // The label has no roll/pitch letters, so compare the controls.
      const parsed = parseCarOrder(carOrderLabel(map));
      assertParked(parsed);
      assert.equal(carOrderLabel(parsed), carOrderLabel(map));
      for (const fn of controlFunctions(8)) {
        assert.equal(parsed[fn], map[fn]);
      }
      // And what MSP_SET_RX_MAP would send reads back unchanged.
      assert.deepEqual(parkRollPitch(Uint8Array.from(map)), map);
    }
  }
});

test("channel labels follow the map", () => {
  assert.equal(channelNumber(STEERING, CAR_RC_MAP), 1);
  assert.equal(channelNumber(THROTTLE, CAR_RC_MAP), 2);
  assert.equal(channelNumber(ROLL, CAR_RC_MAP), 7);
  assert.equal(channelNumber(8, CAR_RC_MAP), 9);
  assert.equal(channelNumber(AUX1, []), null);
  assert.equal(channelNumber(8, []), 9);
  assert.equal(auxChannelLabel(0, CAR_RC_MAP), "CH #3 (AUX 1)");
  assert.equal(auxChannelLabel(3, CAR_RC_MAP), "CH #6 (AUX 4)");
  assert.equal(auxChannelLabel(4, CAR_RC_MAP), "CH #9 (AUX 5)");
  assert.equal(auxChannelLabel(0, undefined), "AUX 1");
});

test("carMapFromControls builds a car map from detected channels", () => {
  assert.deepEqual(carMapFromControls(0, 1), [...CAR_RC_MAP]);
  // Throttle found on CH1, steering on CH2.
  const swapped = carMapFromControls(1, 0);
  assertParked(swapped);
  assert.equal(carOrderLabel(swapped), "TS1234--");
  // Steering on CH4, throttle on CH7.
  const odd = carMapFromControls(3, 6);
  assertParked(odd);
  assert.equal(carOrderLabel(odd), "123S4-T-");
});

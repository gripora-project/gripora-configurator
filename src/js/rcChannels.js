// Receiver channel order (rcmap) helpers for a car.
//
// The firmware's rxConfig()->rcmap is sent as MSP_RX_MAP: one receiver
// channel (0-based) per function, functions in the order roll, pitch, yaw,
// throttle, aux 1-4 (rcChannelLetters "AERT1234"). FC.RC_MAP keeps that
// layout: RC_MAP[function] = receiver channel.
//
// A car only uses yaw (shown as Steering) and throttle as controls, plus the
// aux channels. Roll and pitch are unused, but the map still needs a channel
// for each, and a channel the controls don't use, or the control on that
// channel would also feed roll or pitch. They are "parked" on the two channels
// left over, CH7 and CH8 in the default order.
//
// Pure functions only (no FC), so they can be unit tested.

export const RC_FUNCTION = {
  ROLL: 0,
  PITCH: 1,
  STEERING: 2, // yaw
  THROTTLE: 3,
  AUX1: 4,
};

// Receiver channels the firmware's rcmap covers (RX_MAPPABLE_CHANNEL_COUNT).
// Channels after these always follow on in order: rcData[8] is CH9.
export const RC_MAP_LENGTH = 8;

// Firmware letters for the order string (`map` in the CLI, parseRcChannels()).
const FIRMWARE_LETTERS = "AERT1234";

// The car default (firmware pg/rx.c): CH1 steering, CH2 throttle, CH3-CH6
// aux 1-4, roll and pitch parked on CH7 and CH8.
export const CAR_CHANNEL_ORDER = "RT1234AE";

// The channels roll and pitch prefer to park on (CH7, CH8).
const PARK_CHANNELS = [6, 7];

// Firmware parseRcChannels(): a function whose letter is missing keeps its
// own index as its channel.
export function parseChannelOrder(order, length = RC_MAP_LENGTH) {
  const map = [];
  for (let fn = 0; fn < length; fn++) {
    const channel = order.indexOf(FIRMWARE_LETTERS[fn]);
    map.push(channel >= 0 ? channel : fn);
  }
  return map;
}

export const CAR_RC_MAP = Object.freeze(parseChannelOrder(CAR_CHANNEL_ORDER));

export const CHANNEL_ORDER_PRESETS = Object.freeze([
  { key: "car", order: CAR_CHANNEL_ORDER, map: CAR_RC_MAP },
]);

export function isParkedFunction(fn) {
  return fn === RC_FUNCTION.ROLL || fn === RC_FUNCTION.PITCH;
}

// The functions a car uses, in priority order: steering, throttle, aux 1-4.
export function controlFunctions(length = RC_MAP_LENGTH) {
  const fns = [RC_FUNCTION.STEERING, RC_FUNCTION.THROTTLE];
  for (let fn = RC_FUNCTION.AUX1; fn < length; fn++) {
    fns.push(fn);
  }
  return fns.filter((fn) => fn < length);
}

function validChannel(channel, length) {
  return Number.isInteger(channel) && channel >= 0 && channel < length;
}

// Free channels in the order they are handed out to controls: low channels
// first, the parking channels last.
function controlOrder(free) {
  return [
    ...free.filter((ch) => !PARK_CHANNELS.includes(ch)),
    ...free.filter((ch) => PARK_CHANNELS.includes(ch)),
  ];
}

// A copy of `map` where steering, throttle and aux 1-4 each have their own
// channel, and roll and pitch sit on channels none of them use. Controls keep
// their channel unless it is out of range or already taken by an earlier
// control, then they get the lowest free one. Roll and pitch keep theirs when
// it is still free and not shared; otherwise they take what is left, CH7 and
// CH8 first.
export function parkRollPitch(map) {
  const length = map?.length ?? 0;
  if (length < 4) {
    return [...(map ?? [])];
  }

  const result = new Array(length);
  const used = new Set();
  const pending = [];

  for (const fn of controlFunctions(length)) {
    const channel = map[fn];
    if (validChannel(channel, length) && !used.has(channel)) {
      result[fn] = channel;
      used.add(channel);
    } else {
      pending.push(fn);
    }
  }

  const freeChannels = () =>
    Array.from({ length }, (_, ch) => ch).filter((ch) => !used.has(ch));

  for (const fn of pending) {
    const channel = controlOrder(freeChannels())[0];
    result[fn] = channel;
    used.add(channel);
  }

  // Roll and pitch: keep a channel that is still free, else park.
  for (const fn of [RC_FUNCTION.ROLL, RC_FUNCTION.PITCH]) {
    const channel = map[fn];
    if (validChannel(channel, length) && !used.has(channel)) {
      result[fn] = channel;
      used.add(channel);
    }
  }
  for (const fn of [RC_FUNCTION.ROLL, RC_FUNCTION.PITCH]) {
    if (result[fn] !== undefined) continue;
    const free = freeChannels();
    const channel =
      PARK_CHANNELS.find((ch) => free.includes(ch)) ?? free.at(-1);
    result[fn] = channel;
    used.add(channel);
  }

  return result;
}

// The function on receiver `channel`, or -1 when none is.
export function functionOnChannel(map, channel) {
  return map?.indexOf(channel) ?? -1;
}

// Move control function `fn` to receiver `channel`. Whatever was on that
// channel moves to the channel `fn` came from, then roll and pitch are parked
// again.
export function assignFunction(map, channel, fn) {
  const next = [...map];
  const previous = next.indexOf(channel);
  const from = next[fn];
  next[fn] = channel;
  if (previous >= 0 && previous !== fn) {
    next[previous] = from;
  }
  return parkRollPitch(next);
}

// The preset key `map` matches, or null.
export function matchPreset(map) {
  return (
    CHANNEL_ORDER_PRESETS.find(
      (preset) =>
        map?.length === preset.map.length &&
        preset.map.every((ch, i) => map[i] === ch),
    )?.key ?? null
  );
}

// Car order letters, one per receiver channel: S steering, T throttle,
// 1-4 aux, "-" not used (roll and pitch are parked there).
// [6, 7, 0, 1, 2, 3, 4, 5] -> "ST1234--".
export function carOrderLabel(map) {
  let label = "";
  for (let channel = 0; channel < (map?.length ?? 0); channel++) {
    const fn = map.indexOf(channel);
    if (fn === RC_FUNCTION.STEERING) label += "S";
    else if (fn === RC_FUNCTION.THROTTLE) label += "T";
    else if (fn >= RC_FUNCTION.AUX1) label += String(fn - 3);
    else label += "-";
  }
  return label;
}

// Parse a car order typed by the user (the carOrderLabel() letters, any case,
// spaces ignored) into a full map. Functions left out go to the free channels
// in order, "-" channels last; roll and pitch are parked on what is left.
// Null when the text is not a valid order.
export function parseCarOrder(text, length = RC_MAP_LENGTH) {
  const letters = String(text ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (letters.length === 0 || letters.length > length) {
    return null;
  }

  const map = new Array(length).fill(undefined);
  const dashes = [];
  for (let channel = 0; channel < letters.length; channel++) {
    const letter = letters[channel];
    let fn;
    if (letter === "S" || letter === "R") fn = RC_FUNCTION.STEERING;
    else if (letter === "T") fn = RC_FUNCTION.THROTTLE;
    else if (/^[1-9]$/.test(letter)) fn = RC_FUNCTION.AUX1 + Number(letter) - 1;
    else if (letter === "-") {
      dashes.push(channel);
      continue;
    } else {
      return null;
    }
    if (fn >= length || map[fn] !== undefined) {
      return null;
    }
    map[fn] = channel;
  }

  return fillCarMap(map, length, dashes);
}

// A full map from the channels known for some functions (`partial`, by
// function, undefined where unknown): the other controls take the free
// channels in order (`avoid` channels last), then roll and pitch are parked.
function fillCarMap(partial, length, avoid = []) {
  const map = Array.from({ length }, (_, fn) => partial[fn]);
  const used = new Set(map.filter((ch) => ch !== undefined));
  const free = Array.from({ length }, (_, ch) => ch).filter(
    (ch) => !used.has(ch),
  );
  const order = [
    ...controlOrder(free.filter((ch) => !avoid.includes(ch))),
    ...avoid.filter((ch) => free.includes(ch)),
  ];
  for (const fn of controlFunctions(length)) {
    if (map[fn] === undefined) {
      map[fn] = order.shift();
    }
  }

  return parkRollPitch(map);
}

// A full car map from the receiver channels found for steering and
// throttle (e.g. by moving each in turn): aux 1-4 take the next free
// channels in order, roll and pitch are parked on what is left.
export function carMapFromControls(steering, throttle, length = RC_MAP_LENGTH) {
  const partial = [];
  partial[RC_FUNCTION.STEERING] = steering;
  partial[RC_FUNCTION.THROTTLE] = throttle;
  return fillCarMap(partial, length);
}

// 1-based receiver channel that rcData index `fn` (roll, pitch, steering,
// throttle, aux 1...) reads, or null when the map is not known.
export function channelNumber(fn, map) {
  const length = map?.length ?? 0;
  if (fn < length) {
    return Number.isInteger(map[fn]) ? map[fn] + 1 : null;
  }
  // Past the rcmap, channels follow on in order.
  return fn >= RC_MAP_LENGTH || length > 0 ? fn + 1 : null;
}

// rcData indexes a car shows, in order: steering, throttle, then aux 1 up to
// `count` channels in all (roll and pitch left out).
export function shownRcDataIndexes(count) {
  const shown = [RC_FUNCTION.STEERING, RC_FUNCTION.THROTTLE];
  for (let fn = RC_FUNCTION.AUX1; fn < count; fn++) {
    shown.push(fn);
  }
  return shown.filter((fn) => fn < count);
}

// Display name for rcData index `fn`: "Steering", "Throttle", "CH #3 (AUX 1)".
// Roll and pitch (parked) are named by the channel they sit on, "CH #7".
// `t` translates a locale key.
export function rcDataLabel(fn, map, t) {
  if (fn === RC_FUNCTION.STEERING) return t("controlAxisYaw");
  if (fn === RC_FUNCTION.THROTTLE) return t("controlAxisThrottle");
  if (isParkedFunction(fn)) {
    const channel = channelNumber(fn, map);
    return channel ? `CH #${channel}` : "-";
  }
  return auxChannelLabel(fn - RC_FUNCTION.AUX1, map);
}

// Label for aux channel `auxIndex` (0 = AUX 1, rcData index 4 + auxIndex),
// with the receiver channel it is on: "CH #3 (AUX 1)", or "AUX 1" when the
// map is not known.
export function auxChannelLabel(auxIndex, map) {
  const channel = channelNumber(RC_FUNCTION.AUX1 + auxIndex, map);
  const aux = `AUX ${auxIndex + 1}`;
  return channel ? `CH #${channel} (${aux})` : aux;
}

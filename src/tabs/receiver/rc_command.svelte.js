/*
 * This module produces RC_COMMAND values using RX_CHANNELS and the pending
 * RC_CONFIG and RC_MAP configuration. This allows previewing the affect of the
 * configuration without rebooting the FC.
 */

import { FC } from "@/js/fc.svelte.js";

export const CHANNELS = {
  ROLL: 0,
  PITCH: 1,
  YAW: 2,
  THROTTLE: 3,
};

const MAX_AUX_COUNT = 27;

// Firmware fc/rc.c RC_THROTTLE_NEUTRAL_DEADBAND (us around rc_center).
export const THROTTLE_NEUTRAL_DEADBAND = 10;

function applyDeadband(deflection, deadband) {
  if (deflection > deadband) {
    return deflection - deadband;
  } else if (deflection < -deadband) {
    return deflection + deadband;
  } else {
    return 0;
  }
}

function getProportional(channel, deadband, center, range) {
  const mappedChannel = FC.RC_MAP[channel];
  const raw = FC.RX_CHANNELS[mappedChannel];
  if (!raw) {
    return null;
  }

  const deflection = raw - center;
  // range = range - deadband;

  const percent = applyDeadband(deflection, deadband) / (range - deadband);

  return { pwm: raw, percent: percent.clamp(-1, 1) };
}

/**
 * Provides the current output of each receiver channel
 */
export const RC_COMMAND = {
  get roll() {
    return getProportional(
      CHANNELS.ROLL,
      FC.RC_CONFIG.rc_roll_deadband,
      FC.RC_CONFIG.rc_center,
      FC.RC_CONFIG.rc_deflection,
    );
  },
  get pitch() {
    return getProportional(
      CHANNELS.PITCH,
      FC.RC_CONFIG.rc_pitch_deadband,
      FC.RC_CONFIG.rc_center,
      FC.RC_CONFIG.rc_deflection,
    );
  },
  get yaw() {
    return getProportional(
      CHANNELS.YAW,
      FC.RC_CONFIG.rc_yaw_deadband,
      FC.RC_CONFIG.rc_center,
      FC.RC_CONFIG.rc_deflection,
    );
  },
  // A car's throttle is signed around rc_center like steering: forward
  // above it, brake/reverse below it, with the firmware's fixed neutral
  // deadband (RC_THROTTLE_NEUTRAL_DEADBAND, fc/rc.c). rc_min_throttle and
  // rc_max_throttle no longer scale it.
  get throttle() {
    return getProportional(
      CHANNELS.THROTTLE,
      THROTTLE_NEUTRAL_DEADBAND,
      FC.RC_CONFIG.rc_center,
      FC.RC_CONFIG.rc_deflection,
    );
  },

  aux: [],
};

for (let i = 0; i < MAX_AUX_COUNT; i++) {
  RC_COMMAND.aux.push({
    get pwm() {
      let mappedChannel = i;
      if (i < FC.RC_MAP.length - 4) {
        mappedChannel = FC.RC_MAP[i + 4];
      }

      const raw = FC.RX_CHANNELS[mappedChannel];
      if (!raw) {
        return null;
      }

      return {
        pwm: raw,
      };
    },
  });
}

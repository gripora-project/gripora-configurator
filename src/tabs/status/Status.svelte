<script>
  import { onMount, onDestroy, tick } from "svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import { MSPCodes } from "@/js/msp/MSPCodes.js";
  import { getTabHelpURL } from "@/js/help";
  import * as flightStats from "@/js/flight-stats.js";

  import Page from "@/components/Page.svelte";
  import Section from "@/components/Section.svelte";
  import HelpIcon from "@/components/HelpIcon.svelte";
  import Switch from "@/components/Switch.svelte";
  import Meter from "@/components/Meter.svelte";
  import Model from "@/components/Model.svelte";
  import { rcDataLabel, shownRcDataIndexes } from "@/js/rcChannels.js";
  import { DRIVE_STATES } from "@/js/Drive.js";
  import { surfacesFromRules } from "@/tabs/setup_wizard/surfaces.js";

  import CentreBar from "./CentreBar.svelte";
  import SteeringGauge from "./SteeringGauge.svelte";
  import TiltIndicator from "./TiltIndicator.svelte";
  import {
    rcThrottleFraction,
    steeringOutput,
    steeringStick,
    throttleFraction,
    turnRate,
  } from "./carStatus.js";

  const BAR_SCALE_MIN = 750;
  const BAR_SCALE_MAX = 2250;
  const DEG2RAD = 0.017453292519943295;

  function getDisarmFlags() {
    return [
      "NO_GYRO",
      "FAILSAFE",
      "RX_FAILSAFE",
      "BAD_RX_RECOVERY",
      "BOXFAILSAFE",
      "GOVERNOR",
      "RPM_SIGNAL",
      "THROTTLE",
      "ANGLE",
      "BOOT_GRACE_TIME",
      "NOPREARM",
      "LOAD",
      "CALIBRATING",
      "CLI",
      "CMS_MENU",
      "BST",
      "MSP",
      "PARALYZE",
      "GPS",
      "GPS_RTH",
      "RPMFILTER",
      "REBOOT_REQ",
      "DSHOT_BITBANG",
      "ACC_CALIB",
      "MOTOR_PROTO",
      "SETUP",
      "BACKUP_RX",
      "ARM_SWITCH",
    ];
  }

  let loading = $state(true);
  let yawFix = $state(0);
  let armEnabled = $state(false);

  let modelRef;
  let confirmDialogEl;

  let fastInterval;
  let slowInterval;
  // A poll still waiting for replies when the next is due is skipped, so a
  // slow link doesn't pile requests up.
  let fastBusy = false;
  let slowBusy = false;

  let numChs = $derived(Math.min(FC.RC.active_channels ?? 0, 24));
  let numBars = $derived(Math.max(numChs, 8));
  // MSP_RC is rcData (after the channel map): steering, throttle and aux.
  // Roll and pitch are parked on unused channels and not shown.
  let shownBars = $derived(shownRcDataIndexes(numBars));

  function channelWidth(i) {
    return (
      ((FC.RC.channels[i] - BAR_SCALE_MIN) / (BAR_SCALE_MAX - BAR_SCALE_MIN)) *
      100
    );
  }

  function channelLabel2(i) {
    if (i < 4 && Number.isFinite(FC.RC_COMMAND[i])) {
      return `${(FC.RC_COMMAND[i] / 5).toFixed(1)}%`;
    }
    return "";
  }

  let rssiPercent = $derived(((FC.ANALOG?.rssi ?? 0) / 1023) * 100);

  let disarmFlags = $derived.by(() => {
    const flags = getDisarmFlags();
    const count = FC.CONFIG.armingDisableCount ?? 0;
    const list = [];
    for (let i = 0; i < count; i++) {
      const active = (FC.CONFIG.armingDisableFlags & (1 << i)) !== 0;
      if (!active) continue;
      if (i < flags.length) {
        list.push({
          key: flags[i],
          label: flags[i],
          tooltipKey: `statusArmingDisableFlagsTooltip${flags[i]}`,
        });
      } else {
        list.push({
          key: `unknown-${i}`,
          label: String(i + 1),
          tooltipKey: null,
        });
      }
    }
    return list;
  });

  //// Car readouts, from data the tab polls: MSP_RC_COMMAND (stick),
  //// MSP_SERVO (the steering servo's pulse), MSP_RAW_IMU (gyro yaw),
  //// MSP_ATTITUDE (roll and pitch), and the drive state and drive aids
  //// status where the firmware has them.

  // The first servo the steering mix drives (S1 on the car preset).
  let steeringServo = $derived(
    surfacesFromRules(
      FC.MIXER_RULES ?? [],
      Math.min(FC.CONFIG.servoCount ?? 0, FC.SERVO_CONFIG?.length ?? 0),
    )[0] ?? null,
  );

  let stick = $derived(steeringStick(FC.RC_COMMAND[2]));
  let output = $derived(
    steeringServo
      ? steeringOutput(
          FC.SERVO_DATA?.[steeringServo.servo],
          FC.SERVO_CONFIG[steeringServo.servo],
          steeringServo,
        )
      : null,
  );

  let aids = $derived(FC.DRIVE_AIDS_STATUS);
  let drive = $derived(FC.DRIVE_STATUS);

  // Transmitter and sent-to-ESC throttle. Without the drive aids status,
  // only the transmitter (MSP_RC_COMMAND) is known.
  let throttleIn = $derived(
    aids.supported
      ? throttleFraction(aids.throttle_in)
      : rcThrottleFraction(FC.RC_COMMAND[3]),
  );
  let throttleOut = $derived(
    aids.supported ? throttleFraction(aids.throttle_out) : null,
  );

  let aidBadges = $derived([
    {
      key: "abs",
      label: "statusAidAbs",
      armed: aids.abs_armed,
      active: aids.abs_active,
    },
    {
      key: "tc",
      label: "statusAidTc",
      armed: aids.tc_armed,
      active: aids.tc_active,
    },
    {
      key: "lc",
      label: "statusAidLc",
      armed: aids.lc_staged,
      active: aids.lc_active,
    },
  ]);

  let yawRate = $derived(turnRate(FC.SENSOR_DATA.gyroscope?.[2]));

  function steerText(v) {
    if (v === null) return "—";
    const percent = Math.round(Math.abs(v) * 100);
    if (percent === 0) return $i18n.t("statusSteeringCentre");
    return $i18n.t(v > 0 ? "statusSteeringRight" : "statusSteeringLeft", {
      percent,
    });
  }

  function throttleText(v) {
    if (v === null) return "—";
    const percent = Math.round(Math.abs(v) * 100);
    if (percent === 0) return $i18n.t("profilesAbsThrottleNeutral");
    return $i18n.t(
      v > 0 ? "profilesAbsThrottleForward" : "profilesAbsThrottleBrake",
      { percent },
    );
  }

  function turnText(v) {
    if (v === null) return "—";
    const rate = Math.round(Math.abs(v));
    if (rate === 0) return $i18n.t("statusTurnRateStraight");
    return $i18n.t(v > 0 ? "statusTurnRateRight" : "statusTurnRateLeft", {
      rate,
    });
  }

  function angleText(v) {
    return $i18n.t("statusAttitude", { 1: (v ?? 0).toFixed(1) });
  }

  let armingCurrentlyPossible = $derived(
    (FC.CONFIG.armingDisableFlags ?? 1) === 0,
  );

  function renderModelTick() {
    const x = FC.SENSOR_DATA.kinematics[1] * -1.0 * DEG2RAD;
    const y = (FC.SENSOR_DATA.kinematics[2] * -1.0 - yawFix) * DEG2RAD;
    const z = FC.SENSOR_DATA.kinematics[0] * -1.0 * DEG2RAD;
    modelRef?.rotateTo(x, y, z);
  }

  function onResetYaw() {
    yawFix = FC.SENSOR_DATA.kinematics[2] * -1.0;
  }

  function updateArming(active) {
    FC.CONFIG.enableArmingFlag = active;
    armEnabled = active;
    mspHelper.setArmingEnabled(active);
  }

  function onArmingSwitchChange() {
    if (armEnabled) {
      confirmDialogEl.showModal();
    } else {
      updateArming(false);
    }
  }

  function onConfirmArming() {
    confirmDialogEl.close();
    updateArming(true);
  }

  function onCancelArming() {
    confirmDialogEl.close();
    updateArming(false);
  }

  onMount(async () => {
    await MSP.promise(MSPCodes.MSP_STATUS);
    await MSP.promise(MSPCodes.MSP_FEATURE_CONFIG);
    await MSP.promise(MSPCodes.MSP_MIXER_CONFIG);
    await MSP.promise(MSPCodes.MSP_ACC_TRIM);
    await MSP.promise(MSPCodes.MSP_NAME);
    await MSP.promise(MSPCodes.MSP_FLIGHT_STATS);
    await MSP.promise(MSPCodes.MSP_RC);
    await MSP.promise(MSPCodes.MSP_RX_MAP);
    // Which servo steers, and its Mid, scale and Reverse for the dial.
    await MSP.promise(MSPCodes.MSP_MIXER_RULES);
    await MSP.promise(MSPCodes.MSP_SERVO_CONFIGURATIONS);
    // Drive state and drive aids (next API version): `supported` stays false
    // on firmware without them, and those readouts say so.
    await mspHelper.loadDriveStatus();
    await mspHelper.loadDriveAidsStatus();

    updateArming(FC.CONFIG.enableArmingFlag);
    loading = false;
    await tick();

    fastInterval = setInterval(async () => {
      if (fastBusy) return;
      fastBusy = true;
      try {
        await MSP.promise(MSPCodes.MSP_RC);
        await MSP.promise(MSPCodes.MSP_RC_COMMAND);
        await MSP.promise(MSPCodes.MSP_ATTITUDE);
        await MSP.promise(MSPCodes.MSP_SERVO);
        await MSP.promise(MSPCodes.MSP_RAW_IMU);
        if (FC.DRIVE_AIDS_STATUS.supported) {
          await mspHelper.loadDriveAidsStatus();
        }
        renderModelTick();
      } finally {
        fastBusy = false;
      }
    }, 50);

    slowInterval = setInterval(async () => {
      if (slowBusy) return;
      slowBusy = true;
      try {
        await MSP.promise(MSPCodes.MSP_STATUS);
        await MSP.promise(MSPCodes.MSP_BATTERY_STATE);
        await MSP.promise(MSPCodes.MSP_ANALOG);
        if (FC.DRIVE_STATUS.supported) {
          await mspHelper.loadDriveStatus();
        }
      } finally {
        slowBusy = false;
      }
    }, 250);
  });

  onDestroy(() => {
    clearInterval(fastInterval);
    clearInterval(slowInterval);
  });

  function onClickHelp() {
    window.open(getTabHelpURL("tabStatus"), "_system");
  }
</script>

{#snippet header()}
  <h1>{$i18n.t("tabStatus")}</h1>
  <div class="grow"></div>
  <button class="btn help-btn" onclick={onClickHelp}>
    {$i18n.t("buttonHelp")}
  </button>
{/snippet}

<Page {header} {loading}>
  {#if armingCurrentlyPossible}
    <div class="note arm-danger">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p>{@html $i18n.t("statusArmingDanger")}</p>
    </div>
  {/if}

  <div class="top-grid">
    <Section>
      {#snippet header()}
        <div class="header">
          <span class="title">{$i18n.t("statusInfoHead")}</span>
          <div class="grow"></div>
          <span class="config-state">
            {#if FC.CONFIG.configurationState === FC.CONFIGURATION_STATES.CONFIGURED}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html $i18n.t("statusConfigConfigured")}
            {:else if FC.CONFIG.configurationState === FC.CONFIGURATION_STATES.DEFAULTS_CUSTOM}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html $i18n.t("statusConfigDefaults")}
            {:else}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html $i18n.t("statusConfigBare")}
            {/if}
          </span>
        </div>
      {/snippet}
      <table class="info-table">
        <tbody>
          <tr>
            <td>{$i18n.t("statusCraftName")}</td>
            <td>{FC.CONFIG.name}</td>
          </tr>
          <tr>
            <td>{$i18n.t("statusTargetName")}</td>
            <td>{FC.CONFIG.targetName}</td>
          </tr>
          <tr>
            <td>{$i18n.t("statusBoardName")}</td>
            <td>{FC.CONFIG.boardName}</td>
          </tr>
          <tr>
            <td>{$i18n.t("statusFlightCount")}</td>
            <td>{FC.FLIGHT_STATS.stats_total_flights.toLocaleString()}</td>
          </tr>
          <tr>
            <td>{$i18n.t("statusFlightTime")}</td>
            <td>{flightStats.getDuration()}</td>
          </tr>
        </tbody>
      </table>
    </Section>

    <Section label="statusArmingHead">
      <table class="info-table">
        <tbody>
          <tr>
            <td>{$i18n.t("statusEnableArming")}</td>
            <td>
              <Switch
                bind:checked={armEnabled}
                onchange={onArmingSwitchChange}
              />
            </td>
          </tr>
          <tr>
            <td class="flags-label">
              {$i18n.t("statusArmingDisableFlags")}
              <HelpIcon>
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html $i18n.t("statusArmingDisableFlagsTooltip")}
              </HelpIcon>
            </td>
            <td>
              {#each disarmFlags as flag (flag.key)}
                <span
                  class="disarm-flag"
                  title={flag.tooltipKey ? $i18n.t(flag.tooltipKey) : ""}
                >
                  {flag.label}
                </span>
              {/each}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>

    <Section label="statusBatteryHead">
      <table class="info-table">
        <tbody>
          <tr>
            <td>{$i18n.t("statusBattery")}</td>
            <td
              >{$i18n.t("powerVoltageValue", {
                1: FC.BATTERY_STATE?.voltage ?? 0,
              })}</td
            >
          </tr>
          <tr>
            <td>{$i18n.t("statusDrawing")}</td>
            <td
              >{$i18n.t("powerAmperageValue", {
                1: FC.BATTERY_STATE?.amperage ?? 0,
              })}</td
            >
          </tr>
          <tr>
            <td>{$i18n.t("statusDrawn")}</td>
            <td
              >{$i18n.t("powerMahValue", {
                1: FC.BATTERY_STATE?.mAhDrawn ?? 0,
              })}</td
            >
          </tr>
          <tr>
            <td>{$i18n.t("statusChargeLevel")}</td>
            <td
              >{$i18n.t("powerChargeLevel", {
                1: FC.BATTERY_STATE?.chargeLevel ?? 0,
              })}</td
            >
          </tr>
        </tbody>
      </table>
    </Section>
  </div>

  <Section label="statusInstrumentsHead">
    <div class="readouts">
      <div class="readout steering">
        <span class="readout-title">{$i18n.t("statusSteering")}</span>
        <SteeringGauge {stick} {output} />
        <dl class="pairs">
          <dt>
            <span class="key key-stick"></span>{$i18n.t("statusSteeringStick")}
          </dt>
          <dd>{steerText(stick)}</dd>
          <dt>
            <span class="key key-output"></span>{$i18n.t(
              "statusSteeringOutput",
            )}
          </dt>
          <dd>{steerText(output)}</dd>
        </dl>
        {#if !steeringServo}
          <span class="muted">{$i18n.t("statusSteeringNoServo")}</span>
        {/if}
      </div>

      <div class="readout">
        <span class="readout-title">{$i18n.t("statusThrottle")}</span>
        <div class="bar-row">
          <span class="bar-label">{$i18n.t("statusThrottleTransmitter")}</span>
          <span class="bar-value">{throttleText(throttleIn)}</span>
        </div>
        <CentreBar value={throttleIn} negativeTone="brake" />
        {#if aids.supported}
          <div class="bar-row">
            <span class="bar-label">{$i18n.t("statusThrottleEsc")}</span>
            <span class="bar-value">{throttleText(throttleOut)}</span>
          </div>
          <CentreBar
            value={throttleOut}
            marker={throttleIn}
            negativeTone="brake"
          />
          <div class="aids">
            {#each aidBadges as aid (aid.key)}
              <span
                class={[
                  "aid",
                  aids.enabled && aid.armed && "armed",
                  aid.active && "active",
                ]}>{$i18n.t(aid.label)}</span
              >
            {/each}
            {#if !aids.enabled}
              <span class="muted">{$i18n.t("statusAidsOff")}</span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="readout">
        <span class="readout-title">{$i18n.t("motorsDriveLiveSpeed")}</span>
        {#if drive.supported}
          <span class={["big", !drive.speed_known && "muted"]}>
            {drive.speed_known
              ? $i18n.t("motorsDriveSpeedValue", {
                  speed: (drive.speed / 10).toFixed(1),
                })
              : $i18n.t("motorsDriveNoRpmSource")}
          </span>
          <dl class="pairs">
            <dt>{$i18n.t("motorsDriveLiveDirection")}</dt>
            <dd>
              {drive.direction < 0
                ? $i18n.t("motorsDriveDirectionReverse")
                : $i18n.t("motorsDriveDirectionForward")}
            </dd>
            <dt>{$i18n.t("motorsDriveLiveState")}</dt>
            <dd>
              {$i18n.t(
                `motorsDriveState_${DRIVE_STATES[drive.state] ?? "NEUTRAL"}`,
              )}
            </dd>
            <dt>{$i18n.t("motorsDriveLiveCorrection")}</dt>
            <dd>{drive.correction}%</dd>
          </dl>
        {:else}
          <span class="big muted">—</span>
          <span class="muted">{$i18n.t("statusDriveUnsupported")}</span>
        {/if}
      </div>

      <div class="readout">
        <span class="readout-title">{$i18n.t("statusTurnRate")}</span>
        <span class="big">{turnText(yawRate)}</span>
        <CentreBar value={yawRate === null ? null : yawRate / 360} />
        <div class="scale">
          <span>{$i18n.t("statusTurnRateScaleLeft")}</span>
          <span>{$i18n.t("statusTurnRateScaleRight")}</span>
        </div>
      </div>

      <div class="readout">
        <span class="readout-title">{$i18n.t("statusBodyTilt")}</span>
        <div class="tilt-row">
          <TiltIndicator view="roll" angle={FC.SENSOR_DATA.kinematics[0]} />
          <dl class="pairs">
            <dt>{$i18n.t("titleRoll")}</dt>
            <dd>{angleText(FC.SENSOR_DATA.kinematics[0])}</dd>
          </dl>
        </div>
        <div class="tilt-row">
          <TiltIndicator view="pitch" angle={FC.SENSOR_DATA.kinematics[1]} />
          <dl class="pairs">
            <dt>{$i18n.t("titlePitch")}</dt>
            <dd>{angleText(FC.SENSOR_DATA.kinematics[1])}</dd>
          </dl>
        </div>
      </div>
    </div>
  </Section>

  <div class="bottom-grid">
    <div class="model-panel">
      <div class="model-wrapper">
        <Model bind:this={modelRef} />
        <div class="attitude-info">
          <dl>
            <dt>{$i18n.t("titleHeading")}:</dt>
            <dd>
              {$i18n.t("statusAttitude", { 1: FC.SENSOR_DATA.kinematics[2] })}
            </dd>
            <dt>{$i18n.t("titlePitch")}:</dt>
            <dd>
              {$i18n.t("statusAttitude", { 1: FC.SENSOR_DATA.kinematics[1] })}
            </dd>
            <dt>{$i18n.t("titleRoll")}:</dt>
            <dd>
              {$i18n.t("statusAttitude", { 1: FC.SENSOR_DATA.kinematics[0] })}
            </dd>
          </dl>
        </div>
        <button class="reset" onclick={onResetYaw}>
          {$i18n.t("statusButtonResetZaxisValue", { 1: yawFix })}
        </button>
      </div>
    </div>

    <Section label="statusReceiverHead">
      <div class="bars">
        {#each shownBars as i (i)}
          <Meter
            --fill-hue={i * 20}
            title={rcDataLabel(i, FC.RC_MAP, (key) => $i18n.t(key))}
            leftLabel={(FC.RC.channels[i] ?? 0).toFixed(0)}
            rightLabel={channelLabel2(i)}
            value={channelWidth(i)}
          />
        {/each}
        <Meter
          --fill-hue={numBars * 20}
          title="RSSI"
          leftLabel={FC.ANALOG?.rssi ?? 0}
          rightLabel={`${rssiPercent.toFixed(0)}%`}
          value={rssiPercent}
        />
      </div>
    </Section>
  </div>
</Page>

<dialog bind:this={confirmDialogEl}>
  <h3>{$i18n.t("dialogConfirmArmingTitle")}</h3>
  <div class="content">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <p>{@html $i18n.t("dialogConfirmArmingNote")}</p>
  </div>
  <div class="buttons">
    <button class="btn" onclick={onConfirmArming}>
      {$i18n.t("dialogConfirmArmingConfirm")}
    </button>
    <button class="btn" onclick={onCancelArming}>
      {$i18n.t("dialogConfirmArmingClose")}
    </button>
  </div>
</dialog>

<style lang="scss">
  h1 {
    font-weight: 600;
  }

  .btn {
    @extend %button;
  }

  .help-btn {
    padding: 4px 8px;
    min-width: 60px;
  }

  .arm-danger {
    :global(strong) {
      font-weight: 700;
    }
  }

  dialog {
    width: 32em;
    border-radius: var(--radius-lg);
  }

  dialog .content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  dialog .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 1.5em;
  }

  dialog h3 {
    margin-bottom: 0.5em;
  }

  .top-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    column-gap: var(--section-gap);
  }

  .header {
    @extend %section-header;
    padding-right: 8px;
  }

  .title {
    padding-left: 8px;
    font-weight: 600;
  }

  .grow {
    flex-grow: 1;
  }

  .config-state {
    :global(span) {
      font-size: 0.65rem;
      color: white;
      padding: 2px 6px;
      border-radius: var(--radius-xs);
    }

    :global(.configBare) {
      background-color: var(--color-status-bad);
    }

    :global(.configDefaults) {
      background-color: #f5a834;
    }

    :global(.configConfigured) {
      background-color: var(--color-status-good);
    }
  }

  .info-table {
    width: 100%;

    td {
      padding: 3px 0;
      font-size: 0.8rem;

      &:last-child {
        text-align: right;
        font-weight: 600;
      }
    }
  }

  .flags-label {
    display: flex;
    align-items: center;
  }

  .disarm-flag {
    display: inline-block;
    margin: 2px 4px 2px 0;
    padding: 2px 6px;
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: var(--radius-xs);
    background-color: var(--color-status-bad);
    color: white;
  }

  //// Car readouts, one card each.

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 12px;
    padding: 8px 0;
  }

  .readout {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
    font-size: 0.8rem;
  }

  .steering {
    align-items: center;

    .readout-title,
    .pairs,
    .muted {
      align-self: stretch;
    }
  }

  .readout-title {
    font-weight: 600;
  }

  .big {
    font-size: 1.35rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .muted {
    color: var(--color-text-soft);
    font-size: 0.75rem;
    font-weight: 400;
  }

  .pairs {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin: 0;

    dt {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--color-text-soft);
    }

    dd {
      margin: 0;
      text-align: right;
      white-space: nowrap;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  }

  .key {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .key-stick {
    background-color: var(--color-text);
  }

  .key-output {
    background-color: var(--color-accent-500);
  }

  .bar-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .bar-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-soft);
  }

  .bar-value {
    white-space: nowrap;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .aids {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  .aid {
    padding: 1px 6px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-xs);
    color: var(--color-text-soft);
    font-size: 0.7rem;
    font-weight: 600;

    &.armed {
      border-color: var(--color-accent-500);
      color: var(--color-text);
    }

    &.active {
      border-color: var(--color-accent-500);
      background-color: var(--color-accent-500);
      color: var(--color-accent-fg);
    }
  }

  .scale {
    display: flex;
    justify-content: space-between;
    color: var(--color-text-soft);
    font-size: 0.7rem;
  }

  .tilt-row {
    display: flex;
    align-items: center;
    gap: 10px;

    .pairs {
      flex: 1;
    }
  }

  .bottom-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    column-gap: var(--section-gap);

    @media only screen and (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  .model-panel {
    // Section adds its own padding-top: var(--section-gap) via its
    // .wrapper - match it here so the model box's top edge lines up with
    // the Receiver section's header instead of sitting above it.
    padding-top: var(--section-gap);
    height: calc(550px + var(--section-gap));

    @media only screen and (max-width: 480px) {
      height: calc(300px + var(--section-gap));
    }
  }

  .model-wrapper {
    position: relative;
    height: 100%;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--color-border);
  }

  .attitude-info {
    position: absolute;
    top: 10px;
    left: 10px;
    font-size: 0.75rem;
    color: var(--color-text-soft);
    pointer-events: none;

    dl {
      display: grid;
      grid-template-columns: auto auto;
      column-gap: 6px;
      margin: 0;
    }

    dt {
      font-weight: 600;
    }
  }

  .reset {
    @extend %button;
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>

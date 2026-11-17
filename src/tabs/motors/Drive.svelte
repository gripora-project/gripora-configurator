<script>
  import { slide } from "svelte/transition";

  import {
    DRIVE_ESC_MODES,
    DRIVE_GYRO_MIN_SPEED_MIN,
    DRIVE_GYRO_SPEED_MAX,
    DRIVE_STATES,
    DRIVE_WHEEL_DIAMETER_MAX,
    DRIVE_WHEEL_DIAMETER_MIN,
    motorTurnsPerWheelTurn,
  } from "@/js/Drive.js";
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Field from "@/components/Field.svelte";
  import Meter from "@/components/Meter.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Switch from "@/components/Switch.svelte";
  import Tooltip from "@/components/Tooltip.svelte";
  import InfoNote from "@/components/notes/InfoNote.svelte";

  // Drive state (firmware flight/drive.c): what the ESC does below neutral,
  // the speed from motor RPM, and how the steering gyro fades in with speed
  // and works in reverse. Shown only on firmware that answers
  // MSP2_GRIPORA_DRIVE_CONFIG; Motors.svelte loads, saves and polls it.

  const config = $derived(FC.DRIVE_CONFIG);
  const status = $derived(FC.DRIVE_STATUS);

  // motorN_gear_ratio is [output, motor]; shown the way car people say it,
  // motor turns per wheel turn.
  let gearRatios = $derived(
    FC.CONFIG.motorCount > 1
      ? [FC.MOTOR_CONFIG.motor1_gear_ratio, FC.MOTOR_CONFIG.motor2_gear_ratio]
      : [FC.MOTOR_CONFIG.motor1_gear_ratio],
  );

  function ratioText(ratio) {
    return motorTurnsPerWheelTurn(ratio).toFixed(2);
  }

  // Speeds are 0.1 km/h on the FC, km/h with one decimal here. Full speed
  // stays above min speed, as the FC requires.
  function kmh(raw) {
    return raw / 10;
  }

  function setMinSpeed(v) {
    config.gyro_min_speed = Math.round(v * 10);
    if (config.gyro_full_speed <= config.gyro_min_speed) {
      config.gyro_full_speed = config.gyro_min_speed + 1;
    }
  }

  function setFullSpeed(v) {
    config.gyro_full_speed = Math.max(
      Math.round(v * 10),
      config.gyro_min_speed + 1,
    );
  }

  let speedText = $derived(
    status.speed_known
      ? $i18n.t("motorsDriveSpeedValue", {
          speed: kmh(status.speed).toFixed(1),
        })
      : $i18n.t("motorsDriveNoRpmSource"),
  );
</script>

<Section label="motorsSectionLabelDrive" summary="motorsDriveSummary">
  <SubSection>
    <Field id="drive-esc-mode" label="motorsDriveEscMode">
      {#snippet tooltip()}
        <Tooltip help="motorsDriveEscModeHelp" />
      {/snippet}
      <select id="drive-esc-mode" bind:value={config.esc_mode}>
        {#each DRIVE_ESC_MODES as mode, index (mode)}
          <option value={index}>{$i18n.t(`motorsDriveEscMode_${mode}`)}</option>
        {/each}
      </select>
    </Field>
    <p class="explain">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html $i18n.t(
        `motorsDriveEscModeHelp_${DRIVE_ESC_MODES[config.esc_mode] ?? "AUTO"}`,
      )}
    </p>
  </SubSection>

  <SubSection label="motorsDriveSpeedTitle">
    <Field id="drive-wheel-diameter" label="motorsDriveWheelDiameter" unit="mm">
      {#snippet tooltip()}
        <Tooltip
          help="motorsDriveWheelDiameterHelp"
          attrs={[
            { name: "genericDefault", value: "100 mm" },
            {
              name: "genericRange",
              value: `${DRIVE_WHEEL_DIAMETER_MIN} - ${DRIVE_WHEEL_DIAMETER_MAX} mm`,
            },
          ]}
        />
      {/snippet}
      <NumberInput
        id="drive-wheel-diameter"
        min={DRIVE_WHEEL_DIAMETER_MIN}
        max={DRIVE_WHEEL_DIAMETER_MAX}
        bind:value={config.wheel_diameter}
      />
    </Field>
    {#each gearRatios as ratio, i (i)}
      <Field
        id={`drive-gear-motor-${i + 1}`}
        label={gearRatios.length > 1
          ? `motorsDriveGearRatioMotor${i + 1}`
          : "motorsDriveGearRatio"}
      >
        {#snippet tooltip()}
          <Tooltip help="motorsDriveGearRatioHelp" />
        {/snippet}
        <div class="ratio">
          <NumberInput
            id={`drive-gear-motor-${i + 1}`}
            min="1"
            max="50000"
            bind:value={ratio[1]}
          />
          <span>:</span>
          <NumberInput min="1" max="50000" bind:value={ratio[0]} />
        </div>
      </Field>
    {/each}
    <p class="explain">
      {$i18n.t("motorsDriveSpeedFormula", {
        ratio: ratioText(FC.MOTOR_CONFIG.motor1_gear_ratio),
        circumference: Math.round(Math.PI * config.wheel_diameter),
      })}
    </p>
  </SubSection>

  <SubSection label="motorsDriveGyroTitle">
    <Field
      id="drive-gyro-min-speed"
      label="motorsDriveGyroMinSpeed"
      unit="km/h"
    >
      {#snippet tooltip()}
        <Tooltip
          help="motorsDriveGyroMinSpeedHelp"
          attrs={[{ name: "genericDefault", value: "2.0 km/h" }]}
        />
      {/snippet}
      <NumberInput
        id="drive-gyro-min-speed"
        min={DRIVE_GYRO_MIN_SPEED_MIN / 10}
        max={(DRIVE_GYRO_SPEED_MAX - 1) / 10}
        step="0.1"
        bind:value={() => kmh(config.gyro_min_speed), setMinSpeed}
      />
    </Field>
    <Field
      id="drive-gyro-full-speed"
      label="motorsDriveGyroFullSpeed"
      unit="km/h"
    >
      {#snippet tooltip()}
        <Tooltip
          help="motorsDriveGyroFullSpeedHelp"
          attrs={[{ name: "genericDefault", value: "6.0 km/h" }]}
        />
      {/snippet}
      <NumberInput
        id="drive-gyro-full-speed"
        min={(config.gyro_min_speed + 1) / 10}
        max={DRIVE_GYRO_SPEED_MAX / 10}
        step="0.1"
        bind:value={() => kmh(config.gyro_full_speed), setFullSpeed}
      />
    </Field>
    <Field id="drive-gyro-reverse" label="motorsDriveGyroReverse">
      {#snippet tooltip()}
        <Tooltip help="motorsDriveGyroReverseHelp" />
      {/snippet}
      <Switch
        id="drive-gyro-reverse"
        bind:checked={
          () => !!config.gyro_reverse, (v) => (config.gyro_reverse = v ? 1 : 0)
        }
      />
    </Field>
    {#if config.gyro_reverse}
      <div transition:slide>
        <Field
          id="drive-gyro-reverse-gain"
          label="motorsDriveGyroReverseGain"
          unit="%"
        >
          {#snippet tooltip()}
            <Tooltip
              help="motorsDriveGyroReverseGainHelp"
              attrs={[
                { name: "genericDefault", value: "50%" },
                { name: "genericRange", value: "0 - 100%" },
              ]}
            />
          {/snippet}
          <NumberInput
            id="drive-gyro-reverse-gain"
            min="0"
            max="100"
            bind:value={config.gyro_reverse_gain}
          />
        </Field>
      </div>
    {/if}
  </SubSection>

  {#if status.supported}
    <SubSection label="motorsDriveLiveTitle">
      <dl class="live">
        <dt>{$i18n.t("motorsDriveLiveEscMode")}</dt>
        <dd>
          {$i18n.t(
            `motorsDriveEscModeShort_${DRIVE_ESC_MODES[status.esc_mode] ?? "AUTO"}`,
          )}
        </dd>
        <dt>{$i18n.t("motorsDriveLiveState")}</dt>
        <dd>
          {$i18n.t(
            `motorsDriveState_${DRIVE_STATES[status.state] ?? "NEUTRAL"}`,
          )}
        </dd>
        <dt>{$i18n.t("motorsDriveLiveDirection")}</dt>
        <dd>
          {status.direction < 0
            ? $i18n.t("motorsDriveDirectionReverse")
            : $i18n.t("motorsDriveDirectionForward")}
        </dd>
        <dt>{$i18n.t("motorsDriveLiveSpeed")}</dt>
        <dd class={[!status.speed_known && "muted"]}>{speedText}</dd>
      </dl>
      <div class="meter">
        <Meter
          title={$i18n.t("motorsDriveLiveCorrection")}
          leftLabel={`${status.correction}%`}
          rightLabel="100%"
          value={status.correction}
        />
      </div>
      {#if !status.speed_known}
        <div transition:slide>
          <InfoNote message="motorsDriveNoRpmNote" />
        </div>
      {/if}
    </SubSection>
  {/if}
</Section>

<style lang="scss">
  .explain {
    margin: 0;
    padding: 2px 8px 8px;
    font-size: 0.8rem;
    color: var(--color-text-soft);
    max-width: 70ch;
  }

  .ratio {
    display: flex;
    align-items: center;
    gap: 6px;
    --number-input-max-width: 96px;
  }

  .live {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
    padding: 4px 8px;

    dt {
      color: var(--color-text-soft);
    }

    dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .muted {
      font-weight: 400;
      color: var(--color-text-soft);
    }
  }

  .meter {
    padding: 4px 8px 8px;
  }
</style>

<script>
  import { slide } from "svelte/transition";

  import { DRIVE_ESC_FWD_REV } from "@/js/Drive.js";
  import {
    absPulse,
    DRIVE_ABS_CORNER_FREQ_MAX,
    DRIVE_ABS_DYNAMIC,
    DRIVE_ABS_FLOOR_MAX,
    DRIVE_ABS_FREQ_MAX,
    DRIVE_ABS_FREQ_MIN,
    DRIVE_ABS_HOLD_MAX,
    DRIVE_ABS_MODES,
    DRIVE_ABS_OFF,
    DRIVE_ABS_TRIGGER_MAX,
    DRIVE_ABS_TRIGGER_MIN,
  } from "@/js/DriveAids.js";
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Tooltip from "@/components/Tooltip.svelte";
  import WarningNote from "@/components/notes/WarningNote.svelte";

  // Drive aids (firmware flight/drive_aids.c): timed ABS for now, stored per
  // PID profile. Shown only on firmware that answers
  // MSP2_GRIPORA_DRIVE_AIDS_CONFIG; Profiles.svelte loads (for the active
  // profile), saves and polls it, and reloads on a profile change.

  const config = $derived(FC.DRIVE_AIDS_CONFIG);
  const status = $derived(FC.DRIVE_AIDS_STATUS);

  // ABS needs the drive state to see a brake. "Reverse directly" without
  // motor RPM can't tell a brake from reverse.
  let cannotSeeBrake = $derived(
    FC.DRIVE_STATUS.supported &&
      FC.DRIVE_STATUS.esc_mode === DRIVE_ESC_FWD_REV &&
      !FC.DRIVE_STATUS.speed_known,
  );

  // One pulse at full brake, steering straight.
  let pulse = $derived(absPulse(config, 1, 0));

  function throttleText(value) {
    const percent = Math.round(Math.abs(value) / 10);
    if (value > 0) return $i18n.t("profilesAbsThrottleForward", { percent });
    if (value < 0) return $i18n.t("profilesAbsThrottleBrake", { percent });
    return $i18n.t("profilesAbsThrottleNeutral");
  }

  let absText = $derived(
    status.abs_active
      ? $i18n.t("profilesAbsLiveReleasing")
      : status.abs_armed
        ? $i18n.t("profilesAbsLiveArmed")
        : $i18n.t("profilesAbsLiveIdle"),
  );
</script>

{#snippet numberField(key, unit, min, max, def)}
  <Field id={`abs-${key}`} label={`profilesAbs_${key}`} {unit}>
    {#snippet tooltip()}
      <Tooltip
        help={`profilesAbs_${key}_help`}
        attrs={[
          { name: "genericDefault", value: `${def} ${unit}` },
          { name: "genericRange", value: `${min} - ${max} ${unit}` },
        ]}
      />
    {/snippet}
    <NumberInput id={`abs-${key}`} {min} {max} bind:value={config[key]} />
  </Field>
{/snippet}

<Section label="profilesSectionLabelAbs" summary="profilesAbsSummary">
  <SubSection>
    <Field id="abs-mode" label="profilesAbsMode">
      {#snippet tooltip()}
        <Tooltip help="profilesAbsModeHelp" />
      {/snippet}
      <select id="abs-mode" bind:value={config.abs_mode}>
        {#each DRIVE_ABS_MODES as mode, index (mode)}
          <option value={index}>{$i18n.t(`profilesAbsMode_${mode}`)}</option>
        {/each}
      </select>
    </Field>
    <p class="explain">
      {$i18n.t(
        `profilesAbsModeHelp_${DRIVE_ABS_MODES[config.abs_mode] ?? "OFF"}`,
      )}
    </p>
    {#if config.abs_mode !== DRIVE_ABS_OFF && cannotSeeBrake}
      <div transition:slide>
        <WarningNote message="profilesAbsNoBrakeNote" />
      </div>
    {/if}
  </SubSection>

  {#if config.abs_mode !== DRIVE_ABS_OFF}
    <div transition:slide>
      <SubSection label="profilesAbsPulseTitle">
        {@render numberField(
          "abs_trigger",
          "%",
          DRIVE_ABS_TRIGGER_MIN,
          DRIVE_ABS_TRIGGER_MAX,
          30,
        )}
        {@render numberField(
          "abs_freq",
          "Hz",
          DRIVE_ABS_FREQ_MIN,
          DRIVE_ABS_FREQ_MAX,
          10,
        )}
        {@render numberField("abs_floor", "%", 0, DRIVE_ABS_FLOOR_MAX, 40)}
        {@render numberField("abs_hold", "ms", 0, DRIVE_ABS_HOLD_MAX, 20)}
        {#if pulse}
          <p class="explain">
            {$i18n.t("profilesAbsPulsePreview", {
              freq: +pulse.freq.toFixed(1),
              full: Math.round(pulse.fullTime * 1000),
              release: Math.round((pulse.period - pulse.fullTime) * 1000),
              brake: Math.round(pulse.released * 100),
            })}
          </p>
        {/if}
      </SubSection>

      {#if config.abs_mode === DRIVE_ABS_DYNAMIC}
        <div transition:slide>
          <SubSection label="profilesAbsDynamicTitle">
            {@render numberField(
              "abs_dyn_freq",
              "Hz",
              DRIVE_ABS_FREQ_MIN,
              DRIVE_ABS_FREQ_MAX,
              15,
            )}
            {@render numberField(
              "abs_dyn_hold",
              "ms",
              0,
              DRIVE_ABS_HOLD_MAX,
              0,
            )}
          </SubSection>
        </div>
      {/if}

      <SubSection label="profilesAbsCornerTitle">
        {@render numberField(
          "abs_corner_freq",
          "Hz",
          0,
          DRIVE_ABS_CORNER_FREQ_MAX,
          0,
        )}
        {@render numberField("abs_corner_hold", "ms", 0, DRIVE_ABS_HOLD_MAX, 0)}
      </SubSection>
    </div>
  {/if}

  {#if status.supported}
    <SubSection label="profilesAbsLiveTitle">
      <dl class="live">
        <dt>{$i18n.t("profilesAbsLiveAids")}</dt>
        <dd class={[!status.enabled && "muted"]}>
          {status.enabled
            ? $i18n.t("profilesAbsLiveAidsOn")
            : $i18n.t("profilesAbsLiveAidsOff")}
        </dd>
        <dt>{$i18n.t("profilesAbsLiveAbs")}</dt>
        <dd class={[!status.abs_armed && "muted"]}>{absText}</dd>
        <dt>{$i18n.t("profilesAbsLiveIn")}</dt>
        <dd>{throttleText(status.throttle_in)}</dd>
        <dt>{$i18n.t("profilesAbsLiveOut")}</dt>
        <dd>{throttleText(status.throttle_out)}</dd>
      </dl>
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
</style>

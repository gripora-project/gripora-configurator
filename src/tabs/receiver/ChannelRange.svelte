<script>
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Tooltip from "@/components/Tooltip.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  import { THROTTLE_NEUTRAL_DEADBAND } from "./rc_command.svelte.js";

  // A car's throttle is signed around Channel Center (forward above it,
  // brake/reverse below it) with a fixed neutral deadband, so there is no
  // min/max throttle to set. rc_min_throttle/rc_max_throttle and the roll
  // and pitch deadbands are not shown but still round-trip over MSP
  // unchanged.
</script>

{#snippet throttle()}
  <SubSection label="receiverSettingsThrottleChannel">
    <Field
      id="receiver-throttle-neutral"
      label="receiverThrottleNeutral"
      unit="μs"
    >
      {#snippet tooltip()}
        <Tooltip help="receiverHelpThrottleNeutral" />
      {/snippet}
      <span id="receiver-throttle-neutral" class="readout">
        {$i18n.t("receiverThrottleNeutralValue", {
          1: FC.RC_CONFIG.rc_center,
          2: THROTTLE_NEUTRAL_DEADBAND,
        })}
      </span>
    </Field>
  </SubSection>
{/snippet}

<Section label="receiverSettings">
  <SubSection>
    <Field id="receiver-stick-center" label="receiverStickCenter" unit="μs">
      {#snippet tooltip()}
        <Tooltip
          help="receiverHelpStickCenter"
          attrs={[
            { name: "genericDefault", value: "1500μs" },
            { name: "genericRange", value: "1400μs - 1600μs" },
          ]}
        />
      {/snippet}
      <NumberInput
        id="receiver-stick-center"
        min="1400"
        max="1600"
        bind:value={FC.RC_CONFIG.rc_center}
      />
    </Field>
    <Field
      id="receiver-stick-deflection"
      label="receiverStickDeflection"
      unit="μs"
    >
      {#snippet tooltip()}
        <Tooltip
          help="receiverHelpStickDeflection"
          attrs={[
            { name: "genericDefault", value: "510μs" },
            { name: "genericRange", value: "200μs - 700μs" },
          ]}
        />
      {/snippet}
      <NumberInput
        id="receiver-stick-deflection"
        min="200"
        max="700"
        bind:value={FC.RC_CONFIG.rc_deflection}
      />
    </Field>
    <Field id="receiver-yaw-deadband" label="receiverYawDeadband" unit="μs">
      {#snippet tooltip()}
        <Tooltip
          help="receiverHelpYawDeadband"
          attrs={[
            { name: "genericDefault", value: "5μs" },
            { name: "genericRange", value: "0μs - 100μs" },
          ]}
        />
      {/snippet}
      <NumberInput
        id="receiver-yaw-deadband"
        min="0"
        max="100"
        bind:value={FC.RC_CONFIG.rc_yaw_deadband}
      />
    </Field>
  </SubSection>
  {@render throttle()}
</Section>

<style lang="scss">
  .readout {
    display: inline-block;
    padding: 0 4px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-soft);
  }
</style>

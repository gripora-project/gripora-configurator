<script>
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  // Only yaw is stabilised (yaw-rate gyro steering), so only the yaw cutoffs
  // are shown. The roll and pitch fields still round-trip unchanged.
</script>

<Section label="profilesPidBandwidth">
  <SubSection label="profilesGyroCutoffGroup">
    <Field id="gyro-cutoff-yaw" label="profilesGyroCutoffYaw" unit="Hz">
      {#snippet tooltip()}
        {$i18n.t("profilesGyroCutoffHelp")}
      {/snippet}
      <NumberInput
        id="gyro-cutoff-yaw"
        min="0"
        max="250"
        bind:value={FC.PID_PROFILE.gyroCutoffYaw}
      />
    </Field>
  </SubSection>

  <SubSection label="profilesDtermCutoffGroup">
    <Field id="dterm-cutoff-yaw" label="profilesDtermCutoffYaw" unit="Hz">
      {#snippet tooltip()}
        {$i18n.t("profilesDtermCutoffHelp")}
      {/snippet}
      <NumberInput
        id="dterm-cutoff-yaw"
        min="0"
        max="250"
        bind:value={FC.PID_PROFILE.dtermCutoffYaw}
      />
    </Field>
  </SubSection>

  <SubSection label="profilesBtermCutoffGroup">
    <Field id="bterm-cutoff-yaw" label="profilesBtermCutoffYaw" unit="Hz">
      {#snippet tooltip()}
        {$i18n.t("profilesBtermCutoffHelp")}
      {/snippet}
      <NumberInput
        id="bterm-cutoff-yaw"
        min="0"
        max="250"
        bind:value={FC.PID_PROFILE.btermCutoffYaw}
      />
    </Field>
  </SubSection>
</Section>

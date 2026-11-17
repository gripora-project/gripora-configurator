<script>
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";

  // Only yaw is stabilised (yaw-rate gyro steering). The roll/pitch fields,
  // cross-axis relax, snap relax and prop-hang relax are not shown; their
  // values still round-trip unchanged through FC.PID_PROFILE.
</script>

<Section label="profilesPidSettings">
  <SubSection label="profilesItermDecayGroup">
    <Field id="iterm-decay-limit" label="profilesItermDecayLimit">
      {#snippet tooltip()}
        {$i18n.t("profilesItermDecayLimitHelp")}
      {/snippet}
      <NumberInput
        id="iterm-decay-limit"
        min="0"
        max="250"
        bind:value={FC.PID_PROFILE.iterm_decay_limit}
      />
    </Field>
  </SubSection>

  <SubSection label="profilesItermRelaxLevelGroup">
    <Field id="iterm-relax-level-yaw" label="profilesItermRelaxLevelYaw">
      {#snippet tooltip()}
        {$i18n.t("profilesItermRelaxLevelHelp")}
      {/snippet}
      <NumberInput
        id="iterm-relax-level-yaw"
        min="10"
        max="250"
        bind:value={FC.PID_PROFILE.itermRelaxLevelYaw}
      />
    </Field>
  </SubSection>

  <SubSection label="profilesErrorLimit">
    <Field id="error-limit-yaw" label="profilesErrorLimitYaw">
      {#snippet tooltip()}
        {$i18n.t("profilesErrorLimitHelp")}
      {/snippet}
      <NumberInput
        id="error-limit-yaw"
        min="0"
        max="180"
        bind:value={FC.PID_PROFILE.errorLimitYaw}
      />
    </Field>
  </SubSection>
</Section>

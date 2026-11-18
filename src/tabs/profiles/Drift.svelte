<script>
  import {
    DRIFT_ALLOW_MAX,
    DRIFT_GAIN_MAX,
    DRIFT_LIMIT_MAX,
    DRIFT_LIMIT_MIN,
    driftLimitRate,
  } from "@/js/Drift.js";
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";

  import Field from "@/components/Field.svelte";
  import NumberInput from "@/components/NumberInput.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Tooltip from "@/components/Tooltip.svelte";

  // Drift mode (firmware flight/pid.c pidApplyDrift()), stored per PID
  // profile. Shown only on firmware that answers MSP2_GRIPORA_DRIFT_CONFIG;
  // Profiles.svelte loads (for the active profile) and saves it, and reloads
  // on a profile change.

  const config = $derived(FC.DRIFT_CONFIG);

  const FIELDS = [
    {
      key: "gain",
      unit: "%",
      min: 0,
      max: DRIFT_GAIN_MAX,
      default: "100 %",
    },
    {
      key: "allow",
      unit: "°/s",
      min: 0,
      max: DRIFT_ALLOW_MAX,
      default: "30 °/s",
    },
    {
      key: "limit",
      unit: "%",
      min: DRIFT_LIMIT_MIN,
      max: DRIFT_LIMIT_MAX,
      default: "100 %",
    },
  ];

  let limitRate = $derived(driftLimitRate(config));

  let preview = $derived.by(() => {
    if (limitRate === null) return $i18n.t("profilesDriftPreviewOff");
    return $i18n.t(
      config.limit < DRIFT_LIMIT_MAX
        ? "profilesDriftPreviewLimited"
        : "profilesDriftPreview",
      { allow: config.allow, rate: limitRate, limit: config.limit },
    );
  });
</script>

<Section label="profilesSectionLabelDrift" summary="profilesDriftSummary">
  <SubSection>
    {#each FIELDS as f (f.key)}
      <Field
        id={`drift-${f.key}`}
        label={`profilesDrift_${f.key}`}
        unit={f.unit}
      >
        {#snippet tooltip()}
          <Tooltip
            help={`profilesDrift_${f.key}_help`}
            attrs={[
              { name: "genericDefault", value: f.default },
              {
                name: "genericRange",
                value: `${f.min} - ${f.max} ${f.unit}`,
              },
            ]}
          />
        {/snippet}
        <NumberInput
          id={`drift-${f.key}`}
          min={f.min}
          max={f.max}
          bind:value={config[f.key]}
        />
      </Field>
    {/each}
    <p class="explain">{preview}</p>
  </SubSection>
</Section>

<style lang="scss">
  .explain {
    margin: 0;
    padding: 2px 8px 8px;
    font-size: 0.8rem;
    color: var(--color-text-soft);
    max-width: 70ch;
  }
</style>

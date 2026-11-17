<script>
  import { getContext } from "svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import { Mixer } from "@/js/Mixer.js";
  import { sendChangedServoNames, servoName } from "@/js/ServoNames.js";

  import CarDiagram from "@/tabs/mixer/CarDiagram.svelte";
  import ModelSetupDialog from "@/tabs/mixer/ModelSetupDialog.svelte";

  const wiz = getContext("setupWizard");

  // The setup dialog edits FC.MIXER_RULES (and, if throttle was clamped,
  // FC.MIXER_INPUTS) in place without sending them, the same as on the Mixer
  // tab. Compare against what was loaded so Save knows what to send.
  function snapshot() {
    return $state.snapshot({
      type: FC.MIXER_CONFIG.model_type,
      rules: FC.MIXER_RULES,
    });
  }
  const initial = JSON.stringify(snapshot());
  const initialInputs = JSON.stringify($state.snapshot(FC.MIXER_INPUTS));

  let changed = $derived(JSON.stringify(snapshot()) !== initial);
  let inputsChanged = $derived(
    JSON.stringify($state.snapshot(FC.MIXER_INPUTS)) !== initialInputs,
  );

  $effect(() => {
    if (changed || inputsChanged) wiz.markChanged();
  });

  // The setup dialog names the servos it assigns (assignServoNames()); they
  // are sent with the rules.
  const initialNames = Array.isArray(FC.SERVO_NAMES)
    ? [...FC.SERVO_NAMES]
    : null;

  wiz.setCommit(async () => {
    if (inputsChanged) {
      await new Promise((resolve) => mspHelper.sendMixerInputs(resolve));
    }
    if (!changed) return;
    await new Promise((resolve) => mspHelper.sendMixerConfig(resolve));
    await new Promise((resolve) => mspHelper.sendMixerRules(resolve));
    await sendChangedServoNames(initialNames);
  });

  let isCar = $derived(FC.MIXER_CONFIG.model_type === Mixer.MODEL_TYPE_CAR);
  // What the rules set up, or null when they aren't the car preset.
  let carOptions = $derived(Mixer.carOptionsFromRules(FC.MIXER_RULES));

  // The type only changes once the setup dialog is applied, so cancelling
  // leaves the mix as it was.
  let setupDialogRef;
  let pending = false;

  function chooseCar() {
    pending = true;
    setupDialogRef.open();
  }

  function onApplied() {
    if (pending) FC.MIXER_CONFIG.model_type = Mixer.MODEL_TYPE_CAR;
    pending = false;
  }

  // Custom keeps the rules as they are: they're edited on the Mixer tab.
  function chooseCustom() {
    FC.MIXER_CONFIG.model_type = Mixer.MODEL_TYPE_CUSTOM;
  }

  // ESC outputs the rules drive from throttle (M1, M2, ...).
  let escOutputs = $derived(
    [
      ...new Set(
        FC.MIXER_RULES.filter(
          (rule) =>
            rule.oper !== Mixer.OP_NUL &&
            rule.src === 4 &&
            Mixer.isMotorOutput(rule.dst),
        ).map((rule) => rule.dst - Mixer.MOTOR_OUTPUT_OFFSET + 1),
      ),
    ].sort((a, b) => a - b),
  );

  let summary = $derived.by(() => {
    if (!carOptions) return null;
    const parts = [];
    if (carOptions.rearSteering) {
      parts.push(
        $i18n.t(
          carOptions.rearMode === "same"
            ? "mixerCarSummaryRearSame"
            : "mixerCarSummaryRearOpposite",
          { 1: carOptions.rearPercent },
        ),
      );
    }
    if (carOptions.secondEsc) parts.push($i18n.t("mixerCarSummarySecondEsc"));
    return parts;
  });
</script>

<p>{$i18n.t("setupWizardAirframeIntro")}</p>

<div class="types" role="radiogroup">
  <button
    type="button"
    role="radio"
    aria-checked={isCar}
    class={["type", isCar && "selected"]}
    onclick={chooseCar}
  >
    <CarDiagram options={isCar ? carOptions : null} size={110} />
    <span class="type-name">
      {$i18n.t("mixerModelTypeCar")}
      {#if isCar}
        <i class="fas fa-check-circle" aria-hidden="true"></i>
      {/if}
    </span>
  </button>
  <button
    type="button"
    role="radio"
    aria-checked={!isCar}
    class={["type", !isCar && "selected"]}
    onclick={chooseCustom}
  >
    <span class="custom-icon" aria-hidden="true">&#9881;</span>
    <span class="type-name">
      {$i18n.t("mixerModelTypeCustom")}
      {#if !isCar}
        <i class="fas fa-check-circle" aria-hidden="true"></i>
      {/if}
    </span>
  </button>
</div>

{#if isCar}
  <div class="current">
    <span>
      {$i18n.t("setupWizardAirframeCurrent", {
        1: $i18n.t("mixerModelTypeCar"),
      })}
      {#if summary?.length}
        {summary.join(", ")}.
      {:else if !carOptions}
        {$i18n.t("mixerCarSummaryEdited")}
      {/if}
    </span>
    <button class="btn" onclick={chooseCar}>
      {$i18n.t("setupWizardAirframeOptions")}
    </button>
  </div>
{:else}
  <div class="note">
    <i class="fas fa-info-circle" aria-hidden="true"></i>
    <span>{$i18n.t("setupWizardAirframeCustomNow")}</span>
  </div>
{/if}

<section class="found">
  <strong>{$i18n.t("setupWizardAirframeSurfaces")}</strong>
  {#if wiz.surfaces.length === 0 && escOutputs.length === 0}
    <span class="muted">{$i18n.t("setupWizardAirframeNoSurfaces")}</span>
  {:else}
    <ul class="outputs">
      {#each wiz.surfaces as surface (surface.servo)}
        <li class="output">
          <span class="tag">S{surface.servo + 1}</span>
          <span class="output-text">
            <span class="kind"
              >{$i18n.t(`setupWizardSurface_${surface.kind}`)}</span
            >
            {#if servoName(surface.servo)}
              <span class="muted">{servoName(surface.servo)}</span>
            {/if}
          </span>
        </li>
      {/each}
      {#each escOutputs as motor (motor)}
        <li class="output">
          <span class="tag">M{motor}</span>
          <span class="output-text">
            <span class="kind">{$i18n.t("mixerCarEsc")}</span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  <span class="muted">{$i18n.t("setupWizardAirframeCustomNote")}</span>
</section>

<ModelSetupDialog
  bind:this={setupDialogRef}
  onApply={onApplied}
  onCancel={() => (pending = false)}
/>

<style lang="scss">
  .btn {
    @extend %button;
  }

  p {
    margin: 0;
    max-width: 70ch;
  }

  //// Model type tiles.

  .types {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
    max-width: 420px;
  }

  .type {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 12px 12px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
    color: var(--color-text);
    font: inherit;
    cursor: pointer;
    transition:
      border-color var(--animation-speed),
      background-color var(--animation-speed),
      box-shadow var(--animation-speed);

    &:hover {
      border-color: var(--color-border);
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    &.selected {
      border-color: var(--color-accent-500);
      background-color: var(--color-accent-soft);
      box-shadow: inset 0 0 0 1px var(--color-accent-500);
    }
  }

  .custom-icon {
    display: grid;
    place-items: center;
    height: 110px;
    font-size: 3rem;
    color: var(--color-text-soft);
  }

  .type-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    text-align: center;

    i {
      color: var(--color-accent-500);
    }
  }

  .current {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }

  .note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);

    i {
      margin-top: 3px;
      color: var(--color-accent-500);
    }
  }

  //// Outputs the mix drives, one chip each.

  .found {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .outputs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .output {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface);
  }

  .tag {
    display: grid;
    place-items: center;
    flex: none;
    min-width: 34px;
    height: 30px;
    padding: 0 4px;
    border-radius: var(--radius-sm);
    background-color: var(--color-accent-500);
    color: var(--color-accent-fg);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .output-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .kind {
    font-weight: 600;
  }

  .muted {
    color: var(--color-text-soft);
    font-size: 0.9em;
  }
</style>

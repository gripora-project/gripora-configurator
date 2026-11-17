<script>
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import { Mixer } from "@/js/Mixer.js";
  import { assignServoNames } from "@/js/ServoNames.js";
  import WarningNote from "@/components/notes/WarningNote.svelte";
  import CarOptionsForm from "./CarOptionsForm.svelte";
  import ServoOutputMeter from "./ServoOutputMeter.svelte";

  // The car setup: steering and ESC, with optional rear steering and a
  // second ESC. Applying rewrites the rules from these choices (staged in
  // FC, sent on Save like any other edit).
  let { onApply, onCancel } = $props();

  let dialogEl;
  let applied = false;

  let options = $state({ ...Mixer.CAR_DEFAULT_OPTIONS });

  // modelType is passed for the callers' sake (ModelTypePicker opens this
  // for the type being switched to); CAR is the only type with options.
  export function open() {
    applied = false;
    // Start from what the loaded rules already are, when they're a car
    // preset; otherwise the defaults.
    options = Mixer.carOptionsFromRules(FC.MIXER_RULES) ?? {
      ...Mixer.CAR_DEFAULT_OPTIONS,
    };
    dialogEl.showModal();
  }

  // Servo outputs these choices need that the board doesn't have, warned
  // about here while they can still be changed.
  let servoShortfall = $derived(Mixer.missingServoOutputs(options));

  function apply() {
    FC.MIXER_RULES = Mixer.buildRuleTableFromOptions(options, FC.MIXER_RULES);
    // Brake and reverse live below neutral: never leave throttle clamped.
    Mixer.ensureSignedThrottle(FC.MIXER_INPUTS);
    assignServoNames(FC.MIXER_RULES);

    applied = true;
    dialogEl.close();
  }

  // Fires on every close path (Apply, Cancel button, Escape, backdrop) so
  // callers get exactly one notification regardless of how the dialog shut.
  function handleClose() {
    if (applied) {
      onApply?.();
    } else {
      onCancel?.();
    }
  }
</script>

<dialog bind:this={dialogEl} onclose={handleClose}>
  <h3>{$i18n.t("mixerEditConfigurationTitle")}</h3>
  {#if servoShortfall}
    <ServoOutputMeter shortfall={servoShortfall} />
  {/if}
  {#if servoShortfall?.missing.length}
    <WarningNote>
      {$i18n.t("mixerWizardNotEnoughServos", {
        1: servoShortfall.needed,
        2: servoShortfall.available,
        3: servoShortfall.missing.join(", "),
      })}
    </WarningNote>
  {/if}

  <CarOptionsForm bind:options />

  <div class="note">
    <p>{$i18n.t("mixerWizardOverwriteWarning")}</p>
  </div>

  <div class="buttons">
    <button class="btn" onclick={() => dialogEl.close()}>
      {$i18n.t("mixerWizardCancel")}
    </button>
    <button class="btn" onclick={apply}>
      {$i18n.t("mixerWizardApply")}
    </button>
  </div>
</dialog>

<style lang="scss">
  dialog {
    width: 44em;
    max-width: calc(100vw - 2em);
    border-radius: var(--radius-lg);
  }

  h3 {
    margin-bottom: 0.5em;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 1.5em;
  }

  .btn {
    @extend %button;
  }

  @media only screen and (max-width: 575px) {
    dialog {
      width: calc(100% - 2em);
    }
  }
</style>

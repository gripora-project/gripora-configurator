<script>
  import { i18n } from "@/js/i18n.js";
  import { Mixer } from "@/js/Mixer.js";
  import WarningNote from "@/components/notes/WarningNote.svelte";
  import CarOptionsForm from "./CarOptionsForm.svelte";
  import ServoOutputMeter from "./ServoOutputMeter.svelte";

  // Custom mode's "start from a preset": the car setup's rules, loaded into
  // the rule table to edit from there.
  let { onApply } = $props();

  let dialogEl;

  let options = $state({ ...Mixer.CAR_DEFAULT_OPTIONS });

  export function open() {
    options = { ...Mixer.CAR_DEFAULT_OPTIONS };
    dialogEl.showModal();
  }

  // Servo outputs these choices need that the board doesn't have, warned
  // about here while they can still be changed.
  let servoShortfall = $derived(Mixer.missingServoOutputs(options));

  function apply() {
    dialogEl.close();
    onApply?.(options);
  }
</script>

<dialog bind:this={dialogEl}>
  <h3>{$i18n.t("mixerWizardTitle")}</h3>
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

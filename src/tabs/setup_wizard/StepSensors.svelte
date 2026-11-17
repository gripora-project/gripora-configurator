<script>
  import { getContext, mount, unmount, onDestroy } from "svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import { MSPCodes } from "@/js/msp/MSPCodes.js";
  import { have_sensor } from "@/js/serial_backend.js";

  import AutoAlignWizard from "@/tabs/configuration/AutoAlignWizard.svelte";
  import MountTrimAutoWizard from "@/tabs/configuration/MountTrimAutoWizard.svelte";

  import CarSide from "./CarSide.svelte";

  const wiz = getContext("setupWizard");

  let calibrating = $state(false);
  let calibrated = $state(false);
  let alignmentDirty = $state(false);
  let dialogBusy = $state(false);
  let dialog = null;
  let calibrationTimer;

  let hasAcc = $derived(have_sensor(FC.CONFIG.activeSensors, "acc"));

  function calibrateAccel() {
    if (calibrating) return;
    calibrating = true;
    MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, () => {
      GUI.log($i18n.t("initialSetupAccelCalibStarted"));
    });
    calibrationTimer = setTimeout(() => {
      GUI.log($i18n.t("initialSetupAccelCalibEnded"));
      calibrating = false;
      calibrated = true;
    }, 2000);
  }

  function closeDialog() {
    if (!dialog) return;
    const instance = dialog;
    dialog = null;
    unmount(instance);
  }

  // Same mounting as the Configuration tab's BoardAlignment: on <body>, so
  // the native <dialog> centres on the viewport.
  function openDialog(component) {
    closeDialog();
    dialog = mount(component, {
      target: document.body,
      props: {
        onButtonDisabled: (v) => (dialogBusy = v),
        onDirty: () => {
          alignmentDirty = true;
          wiz.markChanged();
        },
        onClose: closeDialog,
      },
    });
  }

  wiz.setCommit(async () => {
    if (!alignmentDirty) return;
    await MSP.promise(
      MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG,
      mspHelper.crunch(MSPCodes.MSP_SET_BOARD_ALIGNMENT_CONFIG),
    );
    await MSP.promise(
      MSPCodes.MSP2_WING_SET_BOARD_MOUNT_TRIM,
      mspHelper.crunch(MSPCodes.MSP2_WING_SET_BOARD_MOUNT_TRIM),
    );
  });

  onDestroy(() => {
    clearTimeout(calibrationTimer);
    dialog?.stop?.();
    closeDialog();
  });
</script>

<p>{$i18n.t("setupWizardSensorsIntro")}</p>

{#if !hasAcc}
  <div class="note">{$i18n.t("setupWizardSensorsNoAcc")}</div>
{/if}

<ol class="tasks">
  <li class={["task", calibrated && "complete"]}>
    <div class="art"><CarSide scene="level" /></div>
    <div class="task-text">
      <span class="task-title">
        {$i18n.t("setupWizardSensorsAccTitle")}
        {#if calibrated}
          <span class="done">
            <i class="fas fa-check" aria-hidden="true"></i>
            {$i18n.t("setupWizardDone")}
          </span>
        {/if}
      </span>
      <span>{$i18n.t("setupWizardSensorsAccText")}</span>
    </div>
    <button
      class="btn"
      disabled={!hasAcc || calibrating}
      onclick={calibrateAccel}
    >
      {calibrating
        ? $i18n.t("initialSetupButtonCalibratingText")
        : $i18n.t("initialSetupButtonCalibrateAccel")}
    </button>
  </li>
  <li class="task">
    <div class="art"><CarSide scene="tailLift" /></div>
    <div class="task-text">
      <span class="task-title">{$i18n.t("setupWizardSensorsAlignTitle")}</span>
      <span>{$i18n.t("setupWizardSensorsAlignText")}</span>
      <span class="values">
        {$i18n.t("setupWizardSensorsAlignValues", {
          1: FC.BOARD_ALIGNMENT_CONFIG.roll,
          2: FC.BOARD_ALIGNMENT_CONFIG.pitch,
          3: FC.BOARD_ALIGNMENT_CONFIG.yaw,
        })}
      </span>
    </div>
    <button
      class="btn"
      disabled={!hasAcc || dialogBusy}
      onclick={() => openDialog(AutoAlignWizard)}
    >
      {$i18n.t("configurationBoardAutoAlignStart")}
    </button>
  </li>
  <li class="task">
    <div class="art"><CarSide scene="driving" /></div>
    <div class="task-text">
      <span class="task-title">{$i18n.t("setupWizardSensorsLevelTitle")}</span>
      <span>{$i18n.t("setupWizardSensorsLevelText")}</span>
      <span class="values">
        {$i18n.t("setupWizardSensorsLevelValues", {
          1: (FC.BOARD_MOUNT_TRIM.roll / 10).toFixed(1),
          2: (FC.BOARD_MOUNT_TRIM.pitch / 10).toFixed(1),
        })}
      </span>
    </div>
    <button
      class="btn"
      disabled={!hasAcc || dialogBusy}
      onclick={() => openDialog(MountTrimAutoWizard)}
    >
      {$i18n.t("configurationBoardMountTrimAutoStart")}
    </button>
  </li>
</ol>

{#if alignmentDirty}
  <div class="actions">
    <i class="fas fa-sync-alt" aria-hidden="true"></i>
    <span class="grow">{$i18n.t("setupWizardRebootNeeded")}</span>
    <button class="btn primary" onclick={wiz.saveAndReboot}>
      {$i18n.t("buttonSaveReboot")}
    </button>
  </div>
{/if}

<style lang="scss">
  .btn {
    @extend %button;
    height: 2rem;
    padding: 0 16px;
  }

  .btn.primary {
    @extend %button-primary;
  }

  .grow {
    flex: 1;
  }

  p {
    margin: 0;
    max-width: 70ch;
  }

  .note {
    padding: 10px 14px;
    border-left: 4px solid var(--color-yellow-500);
    background-color: var(--color-surface-sunken);
    border-radius: var(--radius-xs);
    max-width: 70ch;
  }

  //// Tasks: one card each, picture / text / button.

  .tasks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .task {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px 20px;
    padding: 12px 16px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
    transition: border-color var(--animation-speed);

    &.complete {
      border-color: var(--color-status-good);
    }
  }

  .art {
    padding: 4px 0;
  }

  .task-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .task-title {
      display: flex;
      font-weight: 600;
      align-items: center;
      gap: 10px;
    }
  }

  .values {
    align-self: flex-start;
    margin-top: 4px;
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    background-color: var(--color-hover);
    color: var(--color-text-soft);
    font-size: 0.85em;
    font-variant-numeric: tabular-nums;
  }

  .done {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-status-good);
    font-size: 0.85em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--color-accent-500);
    border-radius: var(--radius-md);
    background-color: var(--color-accent-soft);

    i {
      color: var(--color-accent-500);
    }
  }

  @media only screen and (max-width: 600px) {
    .task {
      grid-template-columns: 88px minmax(0, 1fr);

      .btn {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }

    .choice {
      flex: 1 1 140px;
      width: auto;
    }
  }
</style>

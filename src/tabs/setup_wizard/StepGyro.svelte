<script>
  import { getContext, onMount } from "svelte";

  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import { Mixer } from "@/js/Mixer.js";

  import LivePulse from "./LivePulse.svelte";
  import GyroCheckArt from "./GyroCheckArt.svelte";

  const wiz = getContext("setupWizard");

  // No overrides here: the stabiliser drives the outputs (the PID runs while
  // disarmed too). Only yaw is stabilised (yaw-rate gyro steering), so yaw
  // is the only axis to check.
  const CHECKS = ["yaw"];

  let results = $state({});

  let checks = $derived(
    CHECKS.filter((axis) => wiz.surfaces.some((s) => s.axes[axis])),
  );

  //// Gyro the wrong way round. With the steering direction already right
  //// (Direction step), the gyro can only correct the wrong way if its yaw
  //// is reversed for the steering loop. yaw_gyro_reverse (firmware
  //// pidConfig_t, sent in MSP_SET_MIXER_CONFIG) negates the yaw rate the
  //// steering PID uses and nothing else: board orientation and the attitude
  //// estimate stay as they are. It works at once, so the check is simply
  //// done again; Save writes it to EEPROM. Servo reverse or the steering
  //// Invert would also reverse the stick, so neither can fix this.

  let canReverse = $derived(Mixer.hasYawGyroReverse());
  let reversed = $derived(!!FC.MIXER_CONFIG.yaw_gyro_reverse);
  // Toggled on this visit: shows the "check again" note.
  let toggled = $state(false);

  //// Drive state (next API version). Reverse needs no setup: travelling
  //// backwards the firmware negates the yaw rate for the steering loop by
  //// itself (drive_gyro_reverse). With motor RPM the correction is faded
  //// out below drive_gyro_min_speed, so at a standstill it is zero and
  //// turning the car by hand moves nothing: say so, or the check reads as
  //// "wrong".

  let driveSupported = $state(false);
  let standstillFaded = $state(false);

  onMount(async () => {
    driveSupported = await mspHelper.loadDriveConfig();
    if (driveSupported && (await mspHelper.loadDriveStatus())) {
      standstillFaded =
        FC.DRIVE_STATUS.speed_known && FC.DRIVE_STATUS.correction === 0;
    }
  });

  function toggleGyroReverse() {
    FC.MIXER_CONFIG.yaw_gyro_reverse = reversed ? 0 : 1;
    mspHelper.sendMixerConfig();
    wiz.markChanged();
    toggled = true;
    // Check again with the new direction.
    delete results.yaw;
  }
</script>

<p>{$i18n.t("setupWizardGyroIntro")}</p>
{#if driveSupported}
  <p class="muted">{$i18n.t("setupWizardGyroReverseAuto")}</p>
{/if}
{#if standstillFaded}
  <div class="passthrough-on">
    {$i18n.t("setupWizardGyroStandstill", {
      speed: (FC.DRIVE_CONFIG.gyro_min_speed / 10).toFixed(1),
    })}
  </div>
{/if}

<div class="legend">
  <span class="key">
    <span class="swatch move"></span>
    {$i18n.t("setupWizardGyroLegendMove")}
  </span>
  <span class="key">
    <span class="swatch react"></span>
    {$i18n.t("setupWizardGyroLegendReact")}
  </span>
</div>

{#if wiz.bypassMode}
  <div class="passthrough-on">
    {$i18n.t("setupWizardBypassTurnOff", { 1: wiz.bypassMode })}
  </div>
{/if}

<ol class="checks">
  {#each checks as axis, n (axis)}
    <li class={["check", results[axis]]}>
      <GyroCheckArt {axis} />
      <div class="check-text">
        <span class="check-title">
          <span class="index">{n + 1}</span>
          {$i18n.t(`setupWizardAxis_${axis}`)}
          {#if results[axis] === "ok"}
            <span class="good">
              <i class="fas fa-check" aria-hidden="true"></i>
              {$i18n.t("setupWizardDone")}
            </span>
          {/if}
        </span>
        <span>{$i18n.t(`setupWizardGyroCheck_${axis}`)}</span>
      </div>
      <span class="buttons">
        <button class="btn" onclick={() => (results[axis] = "ok")}>
          {$i18n.t("setupWizardDirectionCorrect")}
        </button>
        <button class="btn" onclick={() => (results[axis] = "wrong")}>
          {$i18n.t("setupWizardDirectionWrong")}
        </button>
      </span>
    </li>
  {/each}
</ol>

{#if Object.values(results).includes("wrong") || toggled || reversed}
  <div class="note">
    <span>
      {$i18n.t(
        canReverse ? "setupWizardGyroWrong" : "setupWizardGyroWrongOldFirmware",
      )}
    </span>
    {#if canReverse}
      <div class="flip">
        <button class="btn" onclick={toggleGyroReverse}>
          {reversed
            ? $i18n.t("setupWizardGyroReverseOff")
            : $i18n.t("setupWizardGyroReverseOn")}
        </button>
        <span class={["muted", reversed && "on"]}>
          {reversed
            ? $i18n.t("setupWizardGyroReversedNow")
            : $i18n.t("setupWizardGyroNormalNow")}
        </span>
      </div>
      {#if toggled}
        <span class="muted">{$i18n.t("setupWizardGyroCheckAgain")}</span>
      {/if}
    {/if}
  </div>
{/if}

<div class="live">
  <span class="live-title">{$i18n.t("setupWizardGyroLive")}</span>
  {#each wiz.surfaces as surface (surface.servo)}
    <div class="live-row">
      <span class="name">{wiz.surfaceLabel(surface)}</span>
      <LivePulse servo={surface.servo} />
    </div>
  {/each}
</div>

<style lang="scss">
  .passthrough-on {
    padding: 10px 14px;
    border-left: 4px solid var(--color-status-bad);
    border-radius: var(--radius-xs);
    background-color: var(--color-surface-sunken);
    max-width: 70ch;
    font-weight: 600;
  }

  .btn {
    @extend %button;
    height: 2rem;
    padding: 0 16px;
  }

  p {
    margin: 0;
    max-width: 70ch;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--color-text-soft);
    font-size: 0.9em;
  }

  .legend {
    flex-wrap: wrap;
    gap: 6px 24px;
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .swatch {
    width: 26px;

    &.move {
      border-top: 2.5px dashed var(--color-text-muted);
    }

    &.react {
      height: 4px;
      border-radius: 2px;
      background-color: var(--color-accent-500);
    }
  }

  .checks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .check {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    padding: 12px 16px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
    transition: border-color var(--animation-speed);

    &.ok {
      border-color: var(--color-status-good);
    }

    &.wrong {
      border-color: var(--color-status-bad);
    }
  }

  .check-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 280px;
    min-width: 0;
    max-width: 60ch;
  }

  .check-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }

  .index {
    flex: 0 0 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border);
    font-size: 0.8em;
  }

  .buttons {
    display: flex;
    gap: 6px;
  }

  .good {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-status-good);
    font-size: 0.85em;
  }

  .flip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 10px;
  }

  .muted {
    color: var(--color-text-soft);
    font-size: 0.9em;

    &.on {
      color: var(--color-accent-500);
      font-weight: 600;
    }
  }

  .note {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px;
    border-left: 4px solid var(--color-status-bad);
    background-color: var(--color-surface-sunken);
    border-radius: var(--radius-xs);
    max-width: 70ch;
  }

  .live {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 16px;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
  }

  .live-title {
    margin-bottom: 2px;
    color: var(--color-text-soft);
    font-size: 0.85em;
    font-weight: 600;
  }

  .live-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .name {
    min-width: 11em;
    font-weight: 600;
    white-space: nowrap;
  }
</style>

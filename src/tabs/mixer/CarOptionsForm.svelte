<script>
  // The car setup's choices, shared by the car setup dialog and the Custom
  // preset dialog. Steering (S1) and the ESC (M1) are always there; rear
  // steering (S2) and a second ESC (M2) are optional.
  import { i18n } from "@/js/i18n.js";
  import {
    REAR_STEERING_PERCENT_MAX,
    REAR_STEERING_PERCENT_MIN,
    carOptions,
  } from "@/js/carMixer.js";

  import CarDiagram from "./CarDiagram.svelte";

  let { options = $bindable() } = $props();

  // Radio group name, unique per form: several dialogs hold one at a time.
  const uid = $props.id();

  function update(patch) {
    options = carOptions({ ...options, ...patch });
  }
</script>

<div class="car-form">
  <div class="choices">
    <div class="section">
      <div class="section-title">{$i18n.t("mixerCarAlwaysTitle")}</div>
      <div class="fixed">
        <span class="tag">S1</span>
        <span>{$i18n.t("mixerCarSteering")}</span>
      </div>
      <div class="fixed">
        <span class="tag">M1</span>
        <span>{$i18n.t("mixerCarEsc")}</span>
      </div>
      <div class="hint">{$i18n.t("mixerCarDirectionHint")}</div>
    </div>

    <div class="section">
      <label class="option">
        <input
          type="checkbox"
          checked={options.rearSteering}
          onchange={(e) => update({ rearSteering: e.target.checked })}
        />
        <span class="tag">S2</span>
        <span>{$i18n.t("mixerCarRearSteering")}</span>
      </label>
      {#if options.rearSteering}
        <div class="sub">
          <label class="option">
            <input
              type="radio"
              name="rear-mode-{uid}"
              checked={options.rearMode === "opposite"}
              onchange={() => update({ rearMode: "opposite" })}
            />
            <span>{$i18n.t("mixerCarRearOpposite")}</span>
          </label>
          <label class="option">
            <input
              type="radio"
              name="rear-mode-{uid}"
              checked={options.rearMode === "same"}
              onchange={() => update({ rearMode: "same" })}
            />
            <span>{$i18n.t("mixerCarRearSame")}</span>
          </label>
          <label class="percent">
            <span>{$i18n.t("mixerCarRearAmount")}</span>
            <input
              type="range"
              min={REAR_STEERING_PERCENT_MIN}
              max={REAR_STEERING_PERCENT_MAX}
              step="5"
              value={options.rearPercent}
              oninput={(e) => update({ rearPercent: e.target.value })}
            />
            <input
              type="number"
              class="number"
              min={REAR_STEERING_PERCENT_MIN}
              max={REAR_STEERING_PERCENT_MAX}
              value={options.rearPercent}
              onchange={(e) => update({ rearPercent: e.target.value })}
            />
            <span>%</span>
          </label>
          <div class="hint">{$i18n.t("mixerCarRearHint")}</div>
        </div>
      {/if}
    </div>

    <div class="section">
      <label class="option">
        <input
          type="checkbox"
          checked={options.secondEsc}
          onchange={(e) => update({ secondEsc: e.target.checked })}
        />
        <span class="tag">M2</span>
        <span>{$i18n.t("mixerCarSecondEsc")}</span>
      </label>
      <div class="hint">{$i18n.t("mixerCarSecondEscHint")}</div>
    </div>
  </div>

  <div class="preview">
    <CarDiagram {options} size={190} />
  </div>
</div>

<style lang="scss">
  .car-form {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .choices {
    flex: 1;
    min-width: 0;
  }

  .section {
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-float, var(--color-surface));
  }

  .section-title {
    font-weight: 600;
    margin-bottom: 6px;
  }

  .fixed,
  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    font-weight: normal;

    input {
      width: auto;
      margin: 0;
    }
  }

  .sub {
    margin-left: 1.6em;
  }

  .percent {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0 2px;
    font-weight: normal;

    input[type="range"] {
      flex: 1;
      min-width: 80px;
    }

    .number {
      width: 4.5em;
    }
  }

  .tag {
    display: inline-grid;
    place-items: center;
    min-width: 26px;
    height: 18px;
    padding: 0 4px;
    border-radius: var(--radius-xs);
    background-color: var(--color-accent-500);
    color: var(--color-accent-fg, #fff);
    font-size: 0.7rem;
    font-weight: 700;
  }

  .hint {
    color: var(--color-text-soft);
    font-size: 0.75rem;
    margin-top: 4px;
  }

  .preview {
    display: flex;
    justify-content: center;
    width: 190px;
    flex-shrink: 0;
    padding: 8px 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-float, var(--color-surface));
  }

  @media only screen and (max-width: 575px) {
    .car-form {
      flex-direction: column;
    }

    .preview {
      width: 100%;
    }
  }
</style>

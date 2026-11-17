<script>
  import { onMount, onDestroy } from "svelte";
  import { Clock } from "three";

  import { i18n } from "@/js/i18n.js";
  import { degToRad } from "@/js/utils/common";

  import Model from "@/components/Model.svelte";

  import { RC_COMMAND } from "./rc_command.svelte.js";

  // A car only has steering and throttle: the preview turns the car with the
  // steering channel (a turn rate, like a car driving in a circle) and shows
  // both commands as bars. Roll and pitch are not used.
  const TURN_RATE = 180; // deg/s at full steering

  let steering = $derived(RC_COMMAND.yaw?.percent ?? 0);
  let throttle = $derived(RC_COMMAND.throttle?.percent ?? 0);

  let model;
  let clock = new Clock();

  let shouldRender = true;
  function updateModelPreview() {
    if (!shouldRender) {
      return;
    }

    const delta = clock.getDelta();
    const yaw = (RC_COMMAND.yaw?.percent ?? 0) * TURN_RATE;
    model?.rotateBy(0, -degToRad(delta * yaw), 0);

    globalThis.requestAnimationFrame(updateModelPreview);
  }

  onMount(() => {
    updateModelPreview();
  });

  onDestroy(() => {
    shouldRender = false;
  });

  function handleReset() {
    model?.reset();
  }
</script>

<div class="wrapper">
  <div class="container">
    <div class="header">{$i18n.t("receiverModelPreview")}</div>
    <div class="content">
      <Model bind:this={model} />
      <div class="commands">
        {#each [{ label: "controlAxisYaw", value: steering }, { label: "controlAxisThrottle", value: throttle }] as command (command.label)}
          <span class="command-name">{$i18n.t(command.label)}</span>
          <span class="command-track" aria-hidden="true">
            <span class="command-centre"></span>
            <span
              class="command-fill"
              style:left={command.value >= 0
                ? "50%"
                : `${50 + command.value * 50}%`}
              style:width="{Math.abs(command.value) * 50}%"
            ></span>
          </span>
          <span class="command-value">{(command.value * 100).toFixed(0)}%</span>
        {/each}
      </div>
      <button class="reset-btn" onclick={handleReset}
        >{$i18n.t("resetModelPreviewOrientation")}</button
      >
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    padding-top: var(--section-gap);
  }

  .header {
    @extend %section-header;
    padding-left: 8px;
  }

  .container {
    @extend %section-shadow;
  }

  .content {
    position: relative;
    height: 400px;
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    overflow: hidden;
  }

  .reset-btn {
    position: absolute;
    top: 0;
    right: 0;
    margin: 8px;
    font-weight: 400;
    font-size: 0.9rem;
    padding: 6px 12px;
    transition: var(--animation-speed);

    :global(html[data-theme="light"]) & {
      color: var(--color-neutral-900);
      background-color: var(--color-neutral-200);
      border: 1px solid var(--color-neutral-400);
    }

    :global(html[data-theme="dark"]) & {
      color: var(--color-neutral-100);
      background-color: var(--color-neutral-800);
      border: 1px solid var(--color-neutral-500);
    }
  }

  @media (hover: hover) {
    .reset-btn:hover {
      :global(html[data-theme="light"]) & {
        background-color: var(--color-neutral-300);
      }

      :global(html[data-theme="dark"]) & {
        background-color: var(--color-neutral-700);
      }
    }
  }

  .commands {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: grid;
    grid-template-columns: auto 1fr 3.5em;
    align-items: center;
    gap: 6px 10px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--color-text);
    background-color: color-mix(in srgb, var(--color-surface) 85%, transparent);
    border: 1px solid var(--color-border-soft);
  }

  .command-name {
    font-weight: 600;
  }

  .command-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .command-track {
    position: relative;
    height: 8px;
    border-radius: var(--radius-xs);
    background-color: var(--color-meter-bg);
    border: 1px solid var(--color-meter-border);
  }

  .command-centre {
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    width: 1px;
    background-color: var(--color-text-muted);
  }

  .command-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: var(--radius-xs);
    background-color: var(--color-border-accent);
  }

  @media only screen and (max-width: 480px) {
    .container {
      border-radius: 0;
    }
  }
</style>

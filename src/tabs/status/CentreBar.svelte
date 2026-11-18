<script>
  // A bar centred on zero: `value` -1..1 fills from the middle to the right
  // (positive) or the left (negative). `marker`, if set, is a second value
  // drawn as a tick, e.g. what the transmitter asked for next to what was
  // sent. Null `value` shows an empty track.
  let { value = null, marker = null, negativeTone = "neutral" } = $props();

  function pct(v) {
    return Math.max(-1, Math.min(1, v ?? 0)) * 50;
  }
</script>

<div class="track">
  <span class="centre"></span>
  {#if value !== null}
    <span
      class={["fill", value < 0 && `neg-${negativeTone}`]}
      style:left={value < 0 ? `${50 + pct(value)}%` : "50%"}
      style:width={`${Math.abs(pct(value))}%`}
    ></span>
  {/if}
  {#if marker !== null}
    <span class="marker" style:left={`${50 + pct(marker)}%`}></span>
  {/if}
</div>

<style lang="scss">
  .track {
    position: relative;
    height: 12px;
    border-radius: var(--radius-xs);
    background-color: var(--color-meter-bg);
    border: 1px solid var(--color-meter-border);
    overflow: hidden;
  }

  .centre {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    background-color: var(--color-text-muted);
    opacity: 0.6;
  }

  .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    background-color: var(--color-accent-500);
    transition:
      width 0.1s linear,
      left 0.1s linear;

    &.neg-brake {
      background-color: var(--color-status-bad);
    }
  }

  .marker {
    position: absolute;
    top: -1px;
    bottom: -1px;
    width: 3px;
    margin-left: -1.5px;
    border-radius: 1px;
    background-color: var(--color-text);
    transition: left 0.1s linear;
  }
</style>

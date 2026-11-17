<script>
  // Front axle from above, nose up, with both front wheels drawn at each end
  // of their travel and a numbered arrow each way: "check both ways".
  // Not labelled Min/Max or left/right on purpose: which way is Min depends
  // on how the servo is mounted. Decorative; the text next to it says the same.
  const AXLE_Y = 44;
  const WHEELS = [40, 120];
  const LOCK = 24;
</script>

{#snippet wheel(x, angle, cls)}
  <rect
    class={cls}
    x={x - 5}
    y={AXLE_Y - 12}
    width="10"
    height="24"
    rx="3"
    transform="rotate({angle} {x} {AXLE_Y})"
  />
{/snippet}

<svg
  viewBox="0 0 160 72"
  class="both-ways"
  aria-hidden="true"
  focusable="false"
>
  <!-- front of the car: nose, then the chassis running back off the bottom -->
  <path
    class="fixed"
    d="M54 72 L54 26 C54 14 64 8 80 8 C96 8 106 14 106 26 L106 72"
  />
  <line class="rack" x1={WHEELS[0]} y1={AXLE_Y} x2={WHEELS[1]} y2={AXLE_Y} />

  {#each WHEELS as x (x)}
    {@render wheel(x, -LOCK, "ghost")}
    {@render wheel(x, LOCK, "ghost")}
    {@render wheel(x, 0, "moving")}
    <circle class="hinge" cx={x} cy={AXLE_Y} r="1.8" />
  {/each}

  <path class="arrow" d="M138 30 A22 22 0 0 0 128 16" />
  <path class="head" d="M126.5 20 L124.5 13 L131 15.5 Z" />
  <circle class="badge" cx="150" cy="16" r="7" />
  <text class="badge-text" x="150" y="19.5">1</text>

  <path class="arrow" d="M138 58 A22 22 0 0 1 128 70" />
  <path class="head" d="M126.5 66 L124.5 73 L131 70.5 Z" />
  <circle class="badge" cx="150" cy="62" r="7" />
  <text class="badge-text" x="150" y="65.5">2</text>
</svg>

<style lang="scss">
  .both-ways {
    display: block;
    width: 150px;
    height: auto;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .fixed {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }

  .moving {
    fill: var(--color-accent-500);
  }

  .ghost {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.2;
    stroke-dasharray: 3 2;
  }

  .hinge {
    fill: currentColor;
  }

  .arrow {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .head {
    fill: var(--color-accent-500);
  }

  .badge {
    fill: var(--color-accent-500);
  }

  .badge-text {
    fill: var(--color-accent-fg);
    font-size: 9px;
    font-weight: 700;
    text-anchor: middle;
  }
</style>

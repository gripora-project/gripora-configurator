<script>
  // Body roll or pitch, drawn as the car tilted against a level line:
  // "roll" seen from behind (positive is right side down), "pitch" from the
  // side with the nose to the right (positive is nose down, the firmware's
  // attitude convention). Decorative; the angle is printed next to it.
  let { view, angle = 0 } = $props();

  // Small angles are hard to see, so the drawing is exaggerated a little,
  // and capped so a car on its roof still fits.
  let shown = $derived(Math.max(-60, Math.min(60, (angle ?? 0) * 1.5)));
</script>

<svg viewBox="0 0 80 48" class="tilt" aria-hidden="true" focusable="false">
  <line class="level" x1="4" y1="36" x2="76" y2="36" />
  <g style:transform={`rotate(${shown}deg)`} class="body">
    {#if view === "roll"}
      <!-- Rear view: body, wing, two tyres -->
      <rect class="shell" x="20" y="18" width="40" height="12" rx="4" />
      <rect class="tyre" x="14" y="24" width="9" height="12" rx="2" />
      <rect class="tyre" x="57" y="24" width="9" height="12" rx="2" />
      <line class="wing" x1="24" y1="13" x2="56" y2="13" />
    {:else}
      <!-- Side view, nose right -->
      <path
        class="shell"
        d="M10 28 L14 20 L34 18 L46 14 L60 18 L70 24 L70 29 Z"
      />
      <circle class="tyre" cx="22" cy="30" r="6" />
      <circle class="tyre" cx="58" cy="30" r="6" />
    {/if}
  </g>
</svg>

<style lang="scss">
  .tilt {
    display: block;
    width: 80px;
    height: 48px;
    flex: none;
    overflow: visible;
  }

  .level {
    stroke: var(--color-text-muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .body {
    transform-origin: 40px 30px;
    transition: transform 0.1s linear;
  }

  .shell {
    fill: var(--color-surface);
    stroke: var(--color-accent-500);
    stroke-width: 1.8;
    stroke-linejoin: round;
  }

  .tyre {
    fill: var(--color-text-soft);
  }

  .wing {
    stroke: var(--color-accent-500);
    stroke-width: 2.4;
    stroke-linecap: round;
  }
</style>

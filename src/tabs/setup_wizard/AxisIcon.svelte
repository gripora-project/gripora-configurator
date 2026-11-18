<script>
  // Steering (yaw): a car from above, nose up, turning. Decorative; the
  // axis name is next to it.
  let { size = 36 } = $props();
</script>

<svg
  viewBox="0 0 48 48"
  class="axis-icon"
  style:width="{size}px"
  style:height="{size}px"
  aria-hidden="true"
  focusable="false"
>
  <!-- Steering (yaw): a car from above, nose up, turning. -->
  <g transform="rotate(18 24 28)">
    <rect class="tyre" x="13" y="18" width="3.4" height="7" rx="1.2" />
    <rect class="tyre" x="31.6" y="18" width="3.4" height="7" rx="1.2" />
    <rect class="tyre" x="13" y="33" width="3.4" height="7" rx="1.2" />
    <rect class="tyre" x="31.6" y="33" width="3.4" height="7" rx="1.2" />
    <path
      class="body"
      d="M17 18 C17 14.5 20 13 24 13 C28 13 31 14.5 31 18 L31 40 C31 42 30 43 28 43 L20 43 C18 43 17 42 17 40 Z"
    />
    <line class="stripe" x1="24" y1="27" x2="24" y2="39" />
  </g>
  <path class="arrow" d="M12 8 A20 20 0 0 1 38 9" />
  <path class="head" d="M35 4.5 L42 10.5 L34 12.5 Z" />
</svg>

<style lang="scss">
  .axis-icon {
    display: block;
    width: 36px;
    height: 36px;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .body {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linejoin: round;
  }

  .tyre {
    fill: currentColor;
  }

  .stripe {
    stroke: var(--color-accent-500);
    stroke-width: 3.2;
    stroke-linecap: round;
  }

  .arrow {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .head {
    fill: currentColor;
  }
</style>

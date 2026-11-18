<script>
  // How to move the car for the steering gyro check (grey arrow) and how
  // the front wheels should answer (red), seen from above, nose up.
  // Decorative; the check's text says the same.
</script>

<svg viewBox="0 0 120 76" class="gyro-art" aria-hidden="true" focusable="false">
  <!-- A car from above, nose up, turned clockwise by hand: the front
         wheels (red) steer left against it. -->
  <g transform="rotate(16 60 40)">
    <rect class="body" x="47" y="8" width="26" height="64" rx="9" />
    <rect class="tyre" x="39" y="54" width="6" height="14" rx="2" />
    <rect class="tyre" x="75" y="54" width="6" height="14" rx="2" />
    <rect
      class="tyre react-fill"
      x="39"
      y="13"
      width="6"
      height="14"
      rx="2"
      transform="rotate(-22 42 20)"
    />
    <rect
      class="tyre react-fill"
      x="75"
      y="13"
      width="6"
      height="14"
      rx="2"
      transform="rotate(-22 78 20)"
    />
  </g>
  <path class="move" d="M42 6 A40 40 0 0 1 82 3" />
  <path class="move-head" d="M80 -1 L88 5 L79 8 Z" />
</svg>

<style lang="scss">
  .gyro-art {
    display: block;
    width: 132px;
    height: auto;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .body {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  .tyre {
    fill: currentColor;
  }

  .react-fill {
    fill: var(--color-accent-500);
  }

  .move {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-dasharray: 5 3;
  }

  .move-head {
    fill: currentColor;
  }
</style>

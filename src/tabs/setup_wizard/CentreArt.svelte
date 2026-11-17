<!-- The front of a car from above (nose up) with the steering servo at
     neutral: the servo horn square to the steering link (1) and both front
     wheels pointing straight ahead (2). Decorative; the tips next to it say
     the same. -->
<svg
  viewBox="0 0 200 90"
  class="centre-art"
  aria-hidden="true"
  focusable="false"
>
  <!-- Straight-ahead reference through each front wheel. -->
  <line class="guide" x1="40" y1="2" x2="40" y2="88" />
  <line class="guide" x1="160" y1="2" x2="160" y2="88" />

  <!-- Front bumper and the axle the wheels pivot on. -->
  <path class="fixed" d="M46 14 Q100 2 154 14" />
  <line class="rod" x1="48" y1="40" x2="152" y2="40" />

  <rect class="wheel" x="33" y="25" width="14" height="30" rx="4" />
  <rect class="wheel" x="153" y="25" width="14" height="30" rx="4" />
  <circle class="hinge" cx="48" cy="40" r="2" />
  <circle class="hinge" cx="152" cy="40" r="2" />

  <!-- Steering arms, the link across, servo horn and servo. -->
  <line class="rod" x1="48" y1="40" x2="56" y2="54" />
  <line class="rod" x1="152" y1="40" x2="144" y2="54" />
  <line class="rod" x1="56" y1="54" x2="144" y2="54" />
  <rect class="servo" x="80" y="62" width="40" height="20" rx="3" />
  <rect class="horn" x="97" y="52" width="6" height="14" rx="3" />
  <circle class="spline" cx="100" cy="64" r="2.6" />
  <path class="square" d="M100 59 L105 59 L105 54" />

  <circle class="badge" cx="68" cy="72" r="7" />
  <text class="badge-text" x="68" y="75.5">1</text>
  <circle class="badge" cx="176" cy="12" r="7" />
  <text class="badge-text" x="176" y="15.5">2</text>
</svg>

<style lang="scss">
  .centre-art {
    display: block;
    width: 200px;
    height: auto;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .guide {
    stroke: var(--color-status-good);
    stroke-width: 1.2;
    stroke-dasharray: 4 3;
  }

  .fixed {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  .servo {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }

  .wheel {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 2.4;
  }

  .hinge,
  .spline {
    fill: currentColor;
  }

  .horn {
    fill: var(--color-accent-soft);
    stroke: var(--color-accent-500);
    stroke-width: 1.2;
  }

  .rod {
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .square {
    fill: none;
    stroke: var(--color-status-good);
    stroke-width: 1.4;
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

<!-- A car radio with the wheel turned full left and the trigger pushed to full
     brake, so steering and throttle are both at their minimum. Decorative; the
     text next to it says the same. -->
<svg
  viewBox="0 0 160 92"
  class="sticks-art"
  aria-hidden="true"
  focusable="false"
>
  <!-- steering wheel: centre position ghosted, turned left solid -->
  <circle class="gimbal" cx="52" cy="46" r="30" />
  <g transform="rotate(-40 52 46)">
    <line class="cross" x1="52" y1="46" x2="52" y2="18" />
    <line class="cross" x1="52" y1="46" x2="26" y2="58" />
    <line class="cross" x1="52" y1="46" x2="78" y2="58" />
  </g>
  <g transform="rotate(-40 52 46)">
    <circle class="knob" cx="52" cy="19" r="5" />
  </g>
  <circle class="ghost" cx="52" cy="19" r="5" />
  <path class="stick" d="M40 8 A36 36 0 0 0 20 22" />
  <path class="knob" d="M17.5 17.5 L19 27 L25.5 21 Z" />

  <!-- pistol grip with the trigger pushed forward (brake) -->
  <rect class="radio" x="118" y="22" width="26" height="66" rx="10" />
  <path class="ghost-trigger" d="M118 44 C110 44 108 52 112 58" />
  <path class="stick" d="M118 40 C102 40 100 50 104 58" />
  <path class="stick" d="M110 76 L100 76" />
  <path class="knob" d="M99 71 L92 76 L99 81 Z" />
</svg>

<style lang="scss">
  .sticks-art {
    display: block;
    width: 170px;
    height: auto;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .antenna {
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .radio {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.6;
  }

  .gimbal {
    fill: var(--color-surface-sunken);
    stroke: currentColor;
    stroke-width: 1.2;
  }

  .cross {
    stroke: currentColor;
    stroke-width: 0.8;
    opacity: 0.4;
  }

  .ghost-trigger {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }

  .ghost {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.2;
    stroke-dasharray: 2 2;
    opacity: 0.7;
  }

  .stick {
    stroke: var(--color-text);
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .knob {
    fill: var(--color-accent-500);
  }
</style>

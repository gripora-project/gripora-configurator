<!-- A surface radio's steering wheel with its steering trim below, the trim
     moved a little off center: "the trim". Decorative; the text next to it
     explains. -->
<svg viewBox="0 0 120 86" class="trim-art" aria-hidden="true" focusable="false">
  <circle class="gimbal" cx="55" cy="35" r="29" />
  <circle class="rim" cx="55" cy="35" r="23" />
  <line class="spoke" x1="32" y1="35" x2="48" y2="35" />
  <line class="spoke" x1="62" y1="35" x2="78" y2="35" />
  <line class="spoke" x1="55" y1="42" x2="55" y2="58" />
  <circle class="knob" cx="55" cy="35" r="7" />
  <rect class="mark" x="53" y="6" width="4" height="6" rx="1.5" />

  <!-- Steering trim, below. -->
  <rect class="bar" x="24" y="74" width="62" height="6" rx="3" />
  <line class="centre" x1="55" y1="72" x2="55" y2="82" />
  <rect class="mark" x="62" y="72" width="5" height="10" rx="1.5" />
  <path class="arrow" d="M18 77 L12 77 M14 74.5 L11.5 77 L14 79.5" />
  <path class="arrow" d="M92 77 L98 77 M96 74.5 L98.5 77 L96 79.5" />
</svg>

<style lang="scss">
  .trim-art {
    display: block;
    width: 130px;
    height: auto;
    flex: none;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .gimbal {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.4;
  }

  .rim {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.4;
  }

  .spoke {
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
  }

  .knob {
    fill: var(--color-text-muted);
  }

  .bar {
    fill: var(--color-surface-sunken);
    stroke: currentColor;
    stroke-width: 1;
  }

  .centre {
    stroke: currentColor;
    stroke-width: 1;
  }

  .mark {
    fill: var(--color-accent-500);
  }

  .arrow {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

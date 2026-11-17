<script>
  // Side view of a car (nose right) for the wizard's illustrations.
  // Decorative only: every scene is also described in the step's text.
  //  - "level": on the ground, level, with a spirit level above it;
  //  - "tailLift": front wheels on the ground, rear lifted 20 degrees;
  //  - "driving": on the ground, level, with speed lines.
  let { scene = "level" } = $props();

  const GROUND = 66;
</script>

{#snippet car()}
  <path
    class="body"
    d="M28 56 L28 46 C28 44 30 43 34 43 L62 42 L76 31 L104 31 L118 42 L132 44 C135 45 136 47 136 50 L136 56 Z"
  />
  <path class="glass" d="M79 34 L102 34 L112 41 L68 41 Z" />
  <line class="stripe" x1="34" y1="50" x2="130" y2="50" />
  <circle class="wheel" cx="50" cy="58" r="8" />
  <circle class="hub" cx="50" cy="58" r="2.5" />
  <circle class="wheel" cx="114" cy="58" r="8" />
  <circle class="hub" cx="114" cy="58" r="2.5" />
{/snippet}

<svg viewBox="0 4 160 68" class="car-side" aria-hidden="true" focusable="false">
  <line class="ground" x1="6" y1={GROUND} x2="154" y2={GROUND} />

  {#if scene === "level"}
    {@render car()}
    <rect class="vial" x="58" y="8" width="44" height="12" rx="6" />
    <line class="mark" x1="74" y1="8" x2="74" y2="20" />
    <line class="mark" x1="86" y1="8" x2="86" y2="20" />
    <circle class="bubble" cx="80" cy="14" r="3.4" />
  {:else if scene === "tailLift"}
    <line class="ref" x1="20" y1={GROUND} x2="114" y2={GROUND} />
    <g transform="rotate(20 114 {GROUND})">
      {@render car()}
    </g>
    <path class="arc" d="M64 {GROUND} A50 50 0 0 1 67 48.9" />
    <text class="angle" x="44" y="62">20°</text>
  {:else if scene === "driving"}
    {@render car()}
    <line class="speed" x1="2" y1="36" x2="18" y2="36" />
    <line class="speed" x1="0" y1="46" x2="22" y2="46" />
    <line class="speed" x1="4" y1="56" x2="18" y2="56" />
  {/if}
</svg>

<style lang="scss">
  .car-side {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .body {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }

  .glass {
    fill: var(--color-border-soft);
    stroke: currentColor;
    stroke-width: 1.2;
  }

  .stripe {
    stroke: var(--color-accent-500);
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .wheel {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 2.4;
  }

  .hub {
    fill: currentColor;
  }

  .ground {
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    opacity: 0.6;
  }

  .ref {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 3 3;
    opacity: 0.6;
  }

  .arc {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.4;
  }

  .angle {
    fill: var(--color-accent-500);
    font-size: 10px;
    font-weight: 700;
  }

  .speed {
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    opacity: 0.5;
  }

  .vial {
    fill: var(--color-accent-soft);
    stroke: currentColor;
    stroke-width: 1.2;
  }

  .mark {
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.6;
  }

  .bubble {
    fill: var(--color-accent-500);
  }
</style>

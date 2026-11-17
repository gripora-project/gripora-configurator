<script>
  // A car seen from above on the kind of corner each style is for: a gentle
  // curve (beginner), a tight corner taken fast (sport), sideways in a slide
  // with counter-steer, skid marks and tyre smoke (drift). Decorative; the
  // card's text names the style.
  let { style } = $props();
</script>

<!-- Nose along +x. `steer`: front wheel angle in degrees; `speed`: lines
     behind the car. -->
{#snippet car(x, y, angle, steer = 0, speed = false)}
  <g transform="translate({x} {y}) rotate({angle})">
    {#if speed}
      <line class="speed" x1="-17" y1="-3.5" x2="-24" y2="-3.5" />
      <line class="speed" x1="-17" y1="3.5" x2="-27" y2="3.5" />
    {/if}
    <rect class="tyre" x="-11" y="-7.8" width="6" height="2.8" rx="1" />
    <rect class="tyre" x="-11" y="5" width="6" height="2.8" rx="1" />
    <rect
      class="tyre"
      x="5"
      y="-7.8"
      width="6"
      height="2.8"
      rx="1"
      transform="rotate({steer} 8 -6.4)"
    />
    <rect
      class="tyre"
      x="5"
      y="5"
      width="6"
      height="2.8"
      rx="1"
      transform="rotate({steer} 8 6.4)"
    />
    <path
      class="body"
      d="M-13 -3 C-13 -5.5 -11.5 -6 -9 -6 L9 -6 C12 -6 14 -4 14 0 C14 4 12 6 9 6 L-9 6 C-11.5 6 -13 5.5 -13 3 Z"
    />
    <path class="glass" d="M2 -4.6 L6 -3.6 L6 3.6 L2 4.6 Z" />
    <line class="stripe" x1="-10" y1="0" x2="-1" y2="0" />
  </g>
{/snippet}

<svg
  viewBox="0 0 120 64"
  class="style-art"
  aria-hidden="true"
  focusable="false"
>
  {#if style === "trainer"}
    {@const road = "M4 54 C34 54 54 46 72 38 S100 26 116 24"}
    <path class="road" d={road} />
    <path class="lane" d={road} />
    {@render car(86, 32.5, -20, -6)}
  {:else if style === "sport"}
    {@const road = "M24 62 L24 42 Q24 16 50 16 L116 16"}
    <path class="road" d={road} />
    <path class="lane" d={road} />
    {@render car(31, 23.5, -45, 14, true)}
  {:else}
    {@const road = "M4 52 C30 50 50 42 64 36 S96 16 116 10"}
    <path class="road" d={road} />
    <path class="skid" d="M16 51 Q36 45 54.3 39.4" />
    <path class="skid" d="M26 58 Q46 52 65.2 46.2" />
    <circle class="smoke" cx="49" cy="43" r="4.5" />
    <circle class="smoke" cx="42" cy="47" r="3.2" />
    <circle class="smoke" cx="60" cy="51" r="4" />
    <circle class="smoke" cx="52" cy="55" r="2.8" />
    {@render car(64, 36, -58, 26)}
    <path class="line" d="M78 40 Q92 32 100 22" />
    <path class="head" d="M97 21 L102.5 18 L101.5 24.5 Z" />
  {/if}
</svg>

<style lang="scss">
  .style-art {
    display: block;
    width: 120px;
    height: auto;
    overflow: visible;
    color: var(--color-text-muted);
  }

  .road {
    fill: none;
    stroke: var(--color-border-soft);
    stroke-width: 14;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .lane {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 4 3;
    opacity: 0.5;
  }

  .body {
    fill: var(--color-surface);
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-linejoin: round;
  }

  .glass {
    fill: var(--color-border-soft);
    stroke: currentColor;
    stroke-width: 0.8;
  }

  .stripe {
    stroke: var(--color-accent-500);
    stroke-width: 2.4;
    stroke-linecap: round;
  }

  .tyre {
    fill: currentColor;
  }

  // Where the slide carries the car.
  .line {
    fill: none;
    stroke: var(--color-accent-500);
    stroke-width: 1.4;
    stroke-dasharray: 3 2.5;
    stroke-linecap: round;
  }

  .head {
    fill: var(--color-accent-500);
  }

  .speed {
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-linecap: round;
    opacity: 0.5;
  }

  .skid {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    opacity: 0.35;
  }

  .smoke {
    fill: currentColor;
    opacity: 0.15;
  }
</style>

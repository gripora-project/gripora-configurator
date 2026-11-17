<script>
  // Top-down car showing which output drives what: S1 front steering, M1
  // ESC, and optionally S2 rear steering and M2 a second ESC. The layers in
  // src/images/car_shapes share one viewBox and are inlined (not <img>), so
  // they draw in currentColor and the theme's accent.
  import body from "@/images/car_shapes/car_body.svg?raw";
  import rearFixed from "@/images/car_shapes/car_rear_fixed.svg?raw";
  import rearOpposite from "@/images/car_shapes/car_rear_steering_opposite.svg?raw";
  import rearSame from "@/images/car_shapes/car_rear_steering_same.svg?raw";
  import secondEsc from "@/images/car_shapes/car_second_esc.svg?raw";

  // `options`: carMixer.js car options; omitted for the plain car.
  let { options = null, size = 120 } = $props();

  let layers = $derived.by(() => {
    const list = [body];
    if (options?.rearSteering) {
      list.push(options.rearMode === "same" ? rearSame : rearOpposite);
    } else {
      list.push(rearFixed);
    }
    if (options?.secondEsc) list.push(secondEsc);
    return list;
  });
</script>

<span
  class="car"
  style:width="{size * 0.8}px"
  style:height="{size}px"
  aria-hidden="true"
>
  {#each layers as layer, i (i)}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- bundled SVG -->
    <span class="layer">{@html layer}</span>
  {/each}
</span>

<style lang="scss">
  .car {
    display: inline-grid;
    flex: none;
    color: var(--color-text);
  }

  .layer {
    grid-area: 1 / 1;
    display: block;

    :global(svg) {
      display: block;
      width: 100%;
      height: 100%;
    }
  }

  .layer :global(.soft) {
    opacity: 0.45;
  }

  .layer :global(.wheel) {
    fill: var(--color-surface-sunken, transparent);
  }

  .layer :global(.tag) {
    fill: var(--color-accent-500);
  }

  .layer :global(.tag-text) {
    fill: var(--color-accent-fg, #fff);
  }
</style>

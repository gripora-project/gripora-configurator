<script>
  // Steering dial: the stick (dark tick on the rim) and the stabilized
  // steering command sent to the servo (needle), both -1 (full left) .. 1
  // (full right). Null hides that mark. The text next to it gives the
  // numbers.
  let { stick = null, output = null } = $props();

  // Full lock is drawn at +-70 degrees from straight up.
  const SWEEP = 70;
  const CX = 60;
  const CY = 62;
  const R = 50;

  function angle(v) {
    return Math.max(-1, Math.min(1, v)) * SWEEP;
  }

  function point(deg, r) {
    const rad = (deg * Math.PI) / 180;
    return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
  }

  const [ax, ay] = point(-SWEEP, R);
  const [bx, by] = point(SWEEP, R);
  const arc = `M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}`;
  const ticks = [-1, -0.5, 0, 0.5, 1].map((v) => {
    const [x1, y1] = point(angle(v), R - 6);
    const [x2, y2] = point(angle(v), R + 2);
    return { v, x1, y1, x2, y2 };
  });
</script>

<svg viewBox="0 0 120 72" class="gauge" aria-hidden="true" focusable="false">
  <path class="rim" d={arc} />
  {#each ticks as t (t.v)}
    <line class="tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
  {/each}
  {#if output !== null}
    <g class="needle" style:transform={`rotate(${angle(output)}deg)`}>
      <line x1={CX} y1={CY} x2={CX} y2={CY - R + 8} />
    </g>
  {/if}
  {#if stick !== null}
    <g class="stick" style:transform={`rotate(${angle(stick)}deg)`}>
      <path d={`M${CX} ${CY - R - 1} l-4.5 -7 h9 Z`} />
    </g>
  {/if}
  <circle class="hub" cx={CX} cy={CY} r="5" />
</svg>

<style lang="scss">
  .gauge {
    display: block;
    width: 100%;
    max-width: 180px;
    height: auto;
    overflow: visible;
  }

  .rim {
    fill: none;
    stroke: var(--color-meter-border);
    stroke-width: 6;
    stroke-linecap: round;
  }

  .tick {
    stroke: var(--color-text-muted);
    stroke-width: 1.5;
  }

  .needle,
  .stick {
    transform-origin: 60px 62px;
    transition: transform 0.1s linear;
  }

  .needle line {
    stroke: var(--color-accent-500);
    stroke-width: 4;
    stroke-linecap: round;
  }

  .stick path {
    fill: var(--color-text);
  }

  .hub {
    fill: var(--color-surface);
    stroke: var(--color-accent-500);
    stroke-width: 2.5;
  }
</style>

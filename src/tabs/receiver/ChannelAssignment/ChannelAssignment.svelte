<script>
  import { FC } from "@/js/fc.svelte.js";
  import { i18n } from "@/js/i18n.js";
  import {
    CHANNEL_ORDER_PRESETS,
    RC_FUNCTION,
    assignFunction,
    auxChannelLabel,
    carOrderLabel,
    isParkedFunction,
    matchPreset,
    parseCarOrder,
  } from "@/js/rcChannels.js";

  import ChannelBar from "./ChannelBar.svelte";
  import Field from "@/components/Field.svelte";
  import Meter from "@/components/Meter.svelte";
  import Section from "@/components/Section.svelte";
  import SubSection from "@/components/SubSection.svelte";
  import Tooltip from "@/components/Tooltip.svelte";

  // A car only drives steering (yaw) and throttle; roll and pitch are parked
  // on channels nothing else uses (see rcChannels.js) and never shown.
  const NOT_USED = -1;

  function functionLabel(fn) {
    if (fn === RC_FUNCTION.STEERING) return $i18n.t("controlAxisYaw");
    if (fn === RC_FUNCTION.THROTTLE) return $i18n.t("controlAxisThrottle");
    return $i18n.t("receiverChannelAux", { 1: fn - RC_FUNCTION.AUX1 + 1 });
  }

  let functionOptions = $derived(
    Array.from({ length: FC.RC_MAP.length }, (_, fn) => fn)
      .filter((fn) => !isParkedFunction(fn))
      .map((fn) => ({ value: fn, label: functionLabel(fn) })),
  );

  // RSSI from a channel reads rcData[rssi_channel - 1] (firmware rx.c), so
  // 5 and up are AUX 1 and up, wherever the map puts them.
  let rssiOptions = $derived([
    { value: 0, label: $i18n.t("rssiOptionAUTO") },
    { value: 1, label: $i18n.t("rssiOptionADC") },
    ...Array.from(
      { length: Math.max(0, Math.min(FC.RC.active_channels, 31) - 4) },
      (_, i) => ({ value: i + 5, label: auxChannelLabel(i, FC.RC_MAP) }),
    ),
  ]);

  const PRESET_LABELS = {
    car: "receiverChannelOrderPresetCar",
  };
  const CUSTOM = "custom";

  let customChosen = $state(false);
  let preset = $derived(matchPreset(FC.RC_MAP));
  let selectedPreset = $derived(preset && !customChosen ? preset : CUSTOM);

  function applyPreset(e) {
    const key = e.target.value;
    if (key === CUSTOM) {
      customChosen = true;
      return;
    }
    customChosen = false;
    const found = CHANNEL_ORDER_PRESETS.find((p) => p.key === key);
    if (found) {
      FC.RC_MAP = [...found.map];
    }
  }

  let orderText = $derived(carOrderLabel(FC.RC_MAP));
  let orderInvalid = $state(false);

  function applyCustomOrder(e) {
    const map = parseCarOrder(e.target.value, FC.RC_MAP.length);
    orderInvalid = !map;
    if (map) {
      FC.RC_MAP = map;
    }
    // Show the order as it now is, also after an invalid entry.
    e.target.value = carOrderLabel(FC.RC_MAP);
  }

  function channelFunction(channel) {
    const fn = FC.RC_MAP.indexOf(channel);
    return fn < 0 || isParkedFunction(fn) ? NOT_USED : fn;
  }

  function setChannelFunction(channel, fn) {
    if (fn === NOT_USED) return;
    FC.RC_MAP = assignFunction($state.snapshot(FC.RC_MAP), channel, fn);
  }

  let selectedRssiSource = $derived.by(() => {
    if (FC.FEATURE_CONFIG.features.RSSI_ADC) {
      return 1;
    }

    if (FC.RSSI_CONFIG.channel > 4) {
      return FC.RSSI_CONFIG.channel;
    }

    return 0;
  });

  let rssiPercent = $derived((FC.ANALOG.rssi / 1023) * 100);
</script>

<Section label="receiverBars">
  <SubSection>
    <Field id="receiver-channel-order-preset" label="receiverChannelOrder">
      {#snippet tooltip()}
        <Tooltip help="receiverChannelOrderHelp" />
      {/snippet}
      <select
        id="receiver-channel-order-preset"
        onchange={applyPreset}
        value={selectedPreset}
      >
        {#each CHANNEL_ORDER_PRESETS as p (p.key)}
          <option value={p.key}>{$i18n.t(PRESET_LABELS[p.key])}</option>
        {/each}
        <option value={CUSTOM}>
          {$i18n.t("receiverChannelOrderPresetCustom")}
        </option>
      </select>
    </Field>
    {#if selectedPreset === CUSTOM}
      <Field
        id="receiver-channel-order-custom"
        label="receiverChannelOrderCustom"
      >
        {#snippet tooltip()}
          <Tooltip help="receiverChannelOrderCustomHelp" />
        {/snippet}
        <input
          id="receiver-channel-order-custom"
          class="order-input"
          class:invalid={orderInvalid}
          type="text"
          spellcheck="false"
          autocomplete="off"
          maxlength={FC.RC_MAP.length}
          value={orderText}
          onchange={applyCustomOrder}
        />
      </Field>
      {#if orderInvalid}
        <p class="order-error">{$i18n.t("receiverChannelOrderInvalid")}</p>
      {/if}
    {/if}
  </SubSection>

  <div class="divider"></div>

  <SubSection>
    <div class="channel-group">
      {#each { length: FC.RC_MAP.length } as _, i (i)}
        {@const fn = channelFunction(i)}
        <span class="channel-index">{i + 1}</span>
        <select
          class:not-used={fn === NOT_USED}
          value={fn}
          onchange={(e) => setChannelFunction(i, Number(e.target.value))}
        >
          {#if fn === NOT_USED}
            <option value={NOT_USED} disabled>
              {$i18n.t("receiverChannelNotUsed")}
            </option>
          {/if}
          {#each functionOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <ChannelBar channel={i} />
      {/each}
      {#each { length: Math.min(FC.RC.active_channels, 24) - FC.RC_MAP.length } as _, i (i)}
        {@const channel = i + FC.RC_MAP.length}
        <span class="channel-index">{channel + 1}</span>
        <span class="channel-assignment">
          {$i18n.t("receiverChannelAux", { 1: channel - RC_FUNCTION.AUX1 + 1 })}
        </span>
        <ChannelBar {channel} />
      {/each}
      <div class="rssi-group">
        <span class="channel-index">RSSI</span>
        <select
          bind:value={
            () => selectedRssiSource,
            (x) => {
              FC.FEATURE_CONFIG.features.RSSI_ADC = x === 1;
              FC.RSSI_CONFIG.channel = x > 4 ? x : 0;
            }
          }
        >
          {#each rssiOptions as rssiOpt (rssiOpt.value)}
            <option value={rssiOpt.value}>{rssiOpt.label}</option>
          {/each}
        </select>
        <Meter
          leftLabel={FC.ANALOG.rssi}
          value={rssiPercent}
          rightLabel={`${rssiPercent.toFixed(0)}%`}
        />
      </div>
    </div>
  </SubSection>
</Section>

<style lang="scss">
  .channel-group {
    display: grid;
    grid-template-columns: auto auto 1fr;
    column-gap: var(--section-gap);
    row-gap: 8px;
    align-items: center;
    padding: 4px;

    // Each row's 3rd cell is now two stacked meters (ChannelBar's own
    // .channel-meters), taller than a single meter used to be - align the
    // index/dropdown to the top of that combined height rather than
    // centering them across it, so they line up with the primary (top)
    // meter specifically.
    > select,
    > .channel-index {
      align-self: start;
    }

    > select.not-used {
      color: var(--color-text-muted);
    }
  }

  .channel-index {
    text-align: right;
  }

  .channel-assignment {
    padding-left: 8px;
  }

  .order-input {
    width: 8em;
    font-family: monospace;
    letter-spacing: 0.15em;
    text-transform: uppercase;

    &.invalid {
      border-color: var(--color-status-bad);
    }
  }

  .order-error {
    margin: 0 8px 4px;
    font-size: 0.85rem;
    color: var(--color-status-bad);
  }

  .rssi-group {
    margin-top: 16px;
    display: grid;
    align-items: center;
    grid-column: 1/-1;
    grid-template-columns: subgrid;
  }

  .divider {
    margin: 0px 2px 16px 2px;

    :global(html[data-theme="light"]) & {
      border-bottom: 1px solid var(--color-neutral-400);
    }

    :global(html[data-theme="dark"]) & {
      border-bottom: 1px solid var(--color-neutral-700);
    }
  }

  @media only screen and (max-width: 480px) {
    .channel-assignment {
      height: 32px;
      line-height: 32px;
    }
  }
</style>

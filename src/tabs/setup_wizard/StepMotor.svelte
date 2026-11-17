<script>
  import { getContext, onDestroy, onMount } from "svelte";

  import { DRIVE_ESC_MODES, resolveEscMode } from "@/js/Drive.js";
  import { FC } from "@/js/fc.svelte.js";
  import { isFbusMuxSerialPort } from "@/js/FbusMux.js";
  import { i18n } from "@/js/i18n.js";
  import { MSPCodes } from "@/js/msp/MSPCodes.js";

  import {
    PORT_NAMES_RF2,
    UART_NAMES,
    VCP_PORT_IDENTIFIER,
    getPortFunc,
  } from "@/tabs/configuration/util.js";
  import motorState from "@/tabs/motors/state.svelte.js";

  import {
    clearSrxl2Port,
    needsSerialPort,
    setSrxl2Port,
    srxl2Port,
    telemetryForProtocol,
  } from "./escSerial.js";
  import MotorArt from "./MotorArt.svelte";

  const wiz = getContext("setupWizard");

  // The usual protocols as tiles; anything else (no motor, OneShot, ...) from
  // the Other list. DShot600 is in the list: it is fussy about long, noisy
  // ESC leads. Telemetry, PWM rate and throttle endpoints stay on the Motors
  // tab.
  const CHOICES = [
    { key: "pwm", protocol: "PWM" },
    { key: "dshot150", protocol: "DSHOT150" },
    { key: "dshot300", protocol: "DSHOT300" },
  ];

  // Test throttle choices (percent), all low: this is a direction and
  // response check with the car's wheels off the ground. A reversible ESC
  // runs forward above neutral and brakes/reverses below it.
  const TEST_THROTTLES = [5, 10, 20];
  const KEEPALIVE_MS = 250;

  function indexOf(protocol) {
    return motorState.throttleProtocols.indexOf(protocol);
  }

  // The protocol saved or being set up on the FC.
  let fcProtocol = $derived(
    motorState.throttleProtocols[FC.MOTOR_CONFIG.motor_pwm_protocol],
  );

  //// A protocol on a serial port (SRXL2). The ESC's one signal wire goes to
  //// a serial port, and the port's SRXL2 ESC function is what turns the
  //// protocol on in the firmware: see escSerial.js. So choosing it only
  //// asks for the port, and nothing is changed until a port is picked.

  let ports = $derived(
    (FC.SERIAL_CONFIG.ports ?? []).filter(
      (p) => p && p.identifier !== VCP_PORT_IDENTIFIER,
    ),
  );
  let serialPort = $derived(srxl2Port(ports));
  // Chosen from the list, no port picked yet.
  let serialWanted = $state(false);
  let portsChanged = $state(false);
  let telemetryChanged = $state(false);

  // The protocol the page shows as chosen.
  let current = $derived(serialWanted || serialPort ? "SRXL2" : fcProtocol);
  let onSerial = $derived(needsSerialPort(current));
  let currentChoice = $derived(
    CHOICES.find((c) => c.protocol === current)?.key ?? null,
  );
  let protocols = $derived(
    motorState.throttleProtocols
      .map((name, index) => ({ name, index }))
      .filter((p) => p.name),
  );
  let changed = $state(false);

  let wheelsOff = $state(false);
  let testThrottle = $state(10);
  let keepalive;

  let motorCount = $derived(FC.CONFIG.motorCount ?? 0);

  function choose(choice) {
    setProtocol(indexOf(choice.protocol));
  }

  onMount(async () => {
    // Read at connect, but another tab may have edited them since.
    await MSP.promise(MSPCodes.MSP_SERIAL_CONFIG);
  });

  //// ESC behaviour (drive_esc_mode, next API version): what the ESC does
  //// below neutral, so the controller knows when the car is reversing.
  //// Hidden on firmware that doesn't answer MSP2_GRIPORA_DRIVE_CONFIG.
  //// Sent with the rest of the step on Save; no restart needed.

  let driveSupported = $state(false);
  let driveChanged = $state(false);
  // From the running firmware: whether motor 1 has an RPM source.
  let speedKnown = $state(true);

  onMount(async () => {
    driveSupported = await mspHelper.loadDriveConfig();
    if (driveSupported && (await mspHelper.loadDriveStatus())) {
      speedKnown = FC.DRIVE_STATUS.speed_known;
    }
  });

  // What AUTO picks with the protocol shown on this page.
  let autoMode = $derived(
    DRIVE_ESC_MODES[resolveEscMode(0, motorState.isDshot)],
  );

  function chooseEscMode(index) {
    if (FC.DRIVE_CONFIG.esc_mode === index) return;
    FC.DRIVE_CONFIG.esc_mode = index;
    driveChanged = true;
    wiz.markChanged();
  }

  function stopEverything() {
    // A protocol change hides the test controls, so nothing may be left
    // running behind them.
    stopOutput();
  }

  // ESC telemetry follows a change to or from SRXL2 or Castle Link, as on
  // the Motors tab: SRXL2 carries its own, Castle Link is read on the
  // throttle wire with the ESC sensor on and no serial protocol.
  function followTelemetry(from, to) {
    const telemetry = telemetryForProtocol(
      from,
      to,
      FC.ESC_SENSOR_CONFIG.protocol,
      motorState.telemetryProtocols.indexOf("SRXL2"),
    );
    if (!telemetry) return;
    FC.ESC_SENSOR_CONFIG.protocol = telemetry.protocol;
    FC.FEATURE_CONFIG.features.ESC_SENSOR = telemetry.feature;
    if (telemetry.halfDuplex !== undefined) {
      FC.ESC_SENSOR_CONFIG.half_duplex = telemetry.halfDuplex;
    }
    telemetryChanged = true;
  }

  function setProtocol(index) {
    const name = motorState.throttleProtocols[index];
    if (!name) return;
    if (needsSerialPort(name)) {
      // Nothing changes until the port is chosen.
      if (!onSerial) {
        stopEverything();
        serialWanted = true;
      }
      return;
    }
    if (serialWanted && !serialPort && name === fcProtocol) {
      // Back to the saved protocol before a port was picked.
      serialWanted = false;
      return;
    }
    if (!onSerial && index === FC.MOTOR_CONFIG.motor_pwm_protocol) return;
    stopEverything();
    const from = serialPort ? "SRXL2" : fcProtocol;
    serialWanted = false;
    // The ESC is no longer on a serial port, so the port is freed.
    if (clearSrxl2Port(ports)) portsChanged = true;
    FC.MOTOR_CONFIG.motor_pwm_protocol = index;
    followTelemetry(from, name);
    // DShot150 has no bidirectional RPM telemetry, and an ESC that doesn't
    // answer bidirectional requests may not arm, so turn it off. It goes out
    // with MSP_SET_MOTOR_CONFIG on commit.
    if (motorState.isDshot && !motorState.bidirCapable) {
      FC.MOTOR_CONFIG.use_dshot_telemetry = false;
    }
    changed = true;
    wiz.markChanged();
  }

  function maskOf(port) {
    return port.functionMask ?? 0;
  }

  function portName(port) {
    const names = PORT_NAMES_RF2[FC.CONFIG.boardDesign];
    return (
      names?.[port.identifier] ?? UART_NAMES[port.identifier] ?? port.identifier
    );
  }

  function usedFor(port) {
    const func = getPortFunc(maskOf(port));
    return $i18n.t(`portsFunction_${func ? func.name : "CUSTOM"}`);
  }

  function isFree(port) {
    return maskOf(port) === 0 && !isFbusMuxSerialPort(FC.FBUS_MUX, port);
  }

  function chooseSerialPort(port) {
    if (port === serialPort || !isFree(port)) return;
    const index = indexOf("SRXL2");
    if (index < 0) return;
    if (!setSrxl2Port(ports, port)) return;
    stopEverything();
    serialWanted = false;
    portsChanged = true;
    // The firmware sets these from the port on save. Set here too, so the
    // rest of the wizard sees SRXL2 before the restart.
    FC.MOTOR_CONFIG.motor_pwm_protocol = index;
    followTelemetry(undefined, "SRXL2");
    changed = true;
    wiz.markChanged();
  }

  wiz.setCommit(async () => {
    if (driveChanged) {
      if (!(await mspHelper.sendDriveConfig())) {
        GUI.log($i18n.t("motorsDriveSaveRejected"));
      }
      driveChanged = false;
    }
    if (!changed) return;
    function send(code) {
      return MSP.promise(code, mspHelper.crunch(code));
    }
    if (portsChanged) await send(MSPCodes.MSP_SET_SERIAL_CONFIG);
    if (telemetryChanged) {
      await send(MSPCodes.MSP_SET_FEATURE_CONFIG);
      await send(MSPCodes.MSP_SET_ESC_SENSOR_CONFIG);
    }
    await send(MSPCodes.MSP_SET_MOTOR_CONFIG);
  });

  // The FC drops a motor override 1 s after the last one it received
  // (MOTOR_OVERRIDE_TIMEOUT in flight/motors.h) and ignores it while armed,
  // so a motor runs only while this page keeps sending and the link is up.
  // It also ramps an override at a quarter of the range per second
  // (MOTOR_OVERRIDE_RATE). Overrides are signed (MOTOR_OVERRIDE_MIN -1000):
  // the car's ESC is reversible, so 0 is neutral and below it is reverse.

  // What is driving the motors now: null or "<motor>:<direction>". One
  // holder at a time.
  let output = $state(null);

  function send(motors, value) {
    for (const i of motors) {
      FC.MOTOR_OVERRIDE[i] = value;
      mspHelper.sendMotorOverride(i);
    }
  }

  function allMotors() {
    return Array.from({ length: motorCount }, (_, i) => i);
  }

  function hold(holder, motors, value) {
    clearInterval(keepalive);
    output = holder;
    send(motors, value);
    keepalive = setInterval(() => send(motors, value), KEEPALIVE_MS);
  }

  function stopOutput() {
    if (output === null) return;
    output = null;
    clearInterval(keepalive);
    send(allMotors(), 0);
  }

  let canRun = $derived(wheelsOff && !wiz.armed);

  //// Run one motor at a time, forward or reverse, so two ESCs show which
  //// is which and each one's direction can be checked.

  function holderOf(motor, direction) {
    return `${motor}:${direction}`;
  }

  function startSpin(motor, direction) {
    if (!canRun || output !== null) return;
    hold(holderOf(motor, direction), [motor], direction * testThrottle * 10);
  }

  function stopSpin(motor, direction) {
    if (output === holderOf(motor, direction)) stopOutput();
  }

  // Ticking the box off again stops anything running.
  $effect(() => {
    if (!canRun) stopOutput();
  });

  //// Neutral: the throttle stick at centre must be neutral at the ESC. The
  //// FC sends neutral as the middle of the throttle range (1500 µs with
  //// the default 1000-2000 µs), so the ESC has to be calibrated to that.

  let rxPoll;
  let destroyed = false;

  onMount(async () => {
    // The stick centre (rc_center) the throttle is compared with.
    await MSP.promise(MSPCodes.MSP_RC_CONFIG);
    if (destroyed) return;
    rxPoll = setInterval(() => MSP.promise(MSPCodes.MSP_RX_CHANNELS), 200);
  });

  // MSP_RX_MAP order is roll, pitch, yaw, throttle.
  let throttleUs = $derived(FC.RX_CHANNELS?.[FC.RC_MAP?.[3] ?? 3] ?? 0);
  let rcCenter = $derived(FC.RC_CONFIG?.rc_center || 1500);
  let neutralUs = $derived(
    Math.round(
      ((FC.MOTOR_CONFIG.minthrottle ?? 1000) +
        (FC.MOTOR_CONFIG.maxthrottle ?? 2000)) /
        2,
    ),
  );
  // Within the usual stick deadband of centre.
  const CENTRE_TOLERANCE_US = 25;
  let throttleCentred = $derived(
    throttleUs > 0 && Math.abs(throttleUs - rcCenter) <= CENTRE_TOLERANCE_US,
  );

  onDestroy(() => {
    destroyed = true;
    clearInterval(rxPoll);
    stopOutput();
  });
</script>

<div class="intro">
  <MotorArt />
  <p>{$i18n.t("setupWizardMotorIntro")}</p>
</div>

<fieldset class="choices">
  <legend>{$i18n.t("setupWizardMotorProtocolTitle")}</legend>
  {#each CHOICES as choice (choice.key)}
    <label class={["choice", currentChoice === choice.key && "selected"]}>
      <input
        type="radio"
        name="motor-protocol"
        value={choice.key}
        checked={currentChoice === choice.key}
        onchange={() => choose(choice)}
      />
      <span class="choice-name">
        {$i18n.t(`setupWizardMotor_${choice.key}`)}
        {#if currentChoice === choice.key}
          <i class="fas fa-check-circle" aria-hidden="true"></i>
        {/if}
      </span>
      <span class="muted">{$i18n.t(`setupWizardMotorHelp_${choice.key}`)}</span>
    </label>
  {/each}
</fieldset>
<div class="actions">
  <span class="muted">{$i18n.t("setupWizardMotorOther")}</span>
  <select
    value={onSerial ? indexOf(current) : FC.MOTOR_CONFIG.motor_pwm_protocol}
    onchange={(e) => setProtocol(Number(e.target.value))}
  >
    {#each protocols as p (p.index)}
      <option value={p.index}>{p.name}</option>
    {/each}
  </select>
</div>
{#if current === "DISABLED"}
  <p class="muted">{$i18n.t("setupWizardMotorHelp_none")}</p>
{:else if onSerial}
  <!-- The ESC is wired to a serial port, not to the motor output. -->
  <section class="card">
    <h3>{$i18n.t("setupWizardMotorSerialPortTitle", { 1: current })}</h3>
    <p>{$i18n.t("setupWizardMotorSerialPortText", { 1: current })}</p>
    <div class="ports" role="radiogroup">
      {#each ports as port (port.identifier)}
        {@const isEsc = port === serialPort}
        {@const free = isFree(port)}
        <button
          type="button"
          role="radio"
          aria-checked={isEsc}
          class={["port", isEsc && "selected"]}
          disabled={!isEsc && !free}
          onclick={() => chooseSerialPort(port)}
        >
          <span class="port-name">
            {portName(port)}
            {#if isEsc}
              <i class="fas fa-check-circle" aria-hidden="true"></i>
            {/if}
          </span>
          <span class="port-use">
            {#if isEsc}
              {$i18n.t("portsFunction_SRXL2_ESC")}
            {:else if free}
              {$i18n.t("setupWizardReceiverPortFree")}
            {:else}
              {$i18n.t("setupWizardReceiverPortInUse", { 1: usedFor(port) })}
            {/if}
          </span>
        </button>
      {/each}
    </div>
    {#if !serialPort}
      <p class="muted">
        {$i18n.t("setupWizardMotorSerialPortNone", { 1: current })}
      </p>
    {/if}
    <p class="muted">{$i18n.t("setupWizardMotorSerialPortPins")}</p>
  </section>
{:else if current === "CASTLE"}
  <p class="muted">{$i18n.t("setupWizardMotorCastle")}</p>
{:else if motorState.isDshot && !motorState.bidirCapable}
  <p class="muted">{$i18n.t("setupWizardMotorDshot150NoRpm")}</p>
{/if}

{#if driveSupported && current !== "DISABLED"}
  <!-- How the ESC brakes and reverses: no wheels off needed to choose. -->
  <fieldset class="choices esc-modes">
    <legend>{$i18n.t("setupWizardMotorEscModeTitle")}</legend>
    {#each DRIVE_ESC_MODES as mode, index (mode)}
      {@const selected = FC.DRIVE_CONFIG.esc_mode === index}
      <label class={["choice", selected && "selected"]}>
        <input
          type="radio"
          name="esc-mode"
          value={index}
          checked={selected}
          onchange={() => chooseEscMode(index)}
        />
        <span class="choice-name">
          {$i18n.t(`motorsDriveEscMode_${mode}`)}
          {#if selected}
            <i class="fas fa-check-circle" aria-hidden="true"></i>
          {/if}
        </span>
        <span class="muted">
          {$i18n.t(`setupWizardMotorEscModeHelp_${mode}`)}
          {#if mode === "AUTO"}
            {$i18n.t("setupWizardMotorEscModeAutoNow", {
              mode: $i18n.t(`motorsDriveEscModeShort_${autoMode}`),
            })}
          {/if}
        </span>
      </label>
    {/each}
  </fieldset>
  <p class="muted">{$i18n.t("setupWizardMotorEscModeTell")}</p>
  {#if !speedKnown}
    <div class="no-rpm">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <span>{$i18n.t("motorsDriveNoRpmNote")}</span>
    </div>
  {/if}
{/if}

{#if changed}
  <div class="actions">
    <span>{$i18n.t("setupWizardRebootNeeded")}</span>
    <button class="btn primary" onclick={wiz.saveAndReboot}>
      {$i18n.t("buttonSaveReboot")}
    </button>
  </div>
{:else if current !== "DISABLED" && motorCount > 0 && (!onSerial || serialPort)}
  <!-- Everything below runs the motor, so the wheels come off the ground
       first. Not offered while a serial protocol has no port: the ESC
       would get no signal. -->
  <section class={["test", wheelsOff && "confirmed"]}>
    <div class="art">
      <MotorArt spinning={output !== null} />
    </div>
    <div class="safety-text">
      <label class="prop">
        <input
          type="checkbox"
          bind:checked={wheelsOff}
          disabled={output !== null}
        />
        {$i18n.t("setupWizardMotorPropOff")}
      </label>
      <span class="muted">{$i18n.t("setupWizardMotorPropHelp")}</span>
    </div>
  </section>

  <!-- 1: neutral. The throttle stick at centre must stop the car. -->
  <section class="card">
    <h3>
      <span class="num">1</span>{$i18n.t("setupWizardMotorNeutralTitle")}
      {#if throttleCentred}
        <span class="badge good">
          <i class="fas fa-check" aria-hidden="true"></i>
          {$i18n.t("setupWizardMotorNeutralCentred")}
        </span>
      {/if}
    </h3>
    <p class="muted">
      {$i18n.t("setupWizardMotorNeutralIntro", { 1: neutralUs })}
    </p>
    <div class="actions">
      <span class="step-label">{$i18n.t("setupWizardMotorNeutralStick")}</span>
      <span class={["reading", throttleCentred ? "good" : "warn"]}>
        {throttleUs > 0
          ? $i18n.t("setupWizardMotorNeutralReading", {
              1: throttleUs,
              2: rcCenter,
            })
          : $i18n.t("setupWizardMotorNeutralNoSignal")}
      </span>
    </div>
    <p class="muted">{$i18n.t("setupWizardMotorNeutralCheck")}</p>
  </section>

  <!-- 2: direction. Pick a throttle, hold forward or reverse. -->
  <section class="card">
    <h3>
      <span class="num">2</span>{$i18n.t("setupWizardMotorTestTitle")}
    </h3>
    <p class="muted">
      {motorCount > 1
        ? $i18n.t("setupWizardMotorTestCheckTwin")
        : $i18n.t("setupWizardMotorTestCheck")}
    </p>
    <div class="actions">
      <span class="step-label">{$i18n.t("setupWizardMotorTestThrottle")}</span>
      <span class="segments">
        {#each TEST_THROTTLES as t (t)}
          <label class={["segment", testThrottle === t && "selected"]}>
            <input
              type="radio"
              name="test-throttle"
              value={t}
              bind:group={testThrottle}
              disabled={!canRun || output !== null}
            />
            {t}%
          </label>
        {/each}
      </span>
    </div>
    {#each allMotors() as motor (motor)}
      <div class="actions">
        {#if motorCount > 1}
          <span class="step-label">
            {$i18n.t("setupWizardEscMotor", { 1: motor + 1 })}
          </span>
        {/if}
        {#each [1, -1] as direction (direction)}
          {@const holder = holderOf(motor, direction)}
          <button
            class={["btn", "spin", output === holder && "primary"]}
            disabled={!canRun || (output !== null && output !== holder)}
            onpointerdown={() => startSpin(motor, direction)}
            onpointerup={() => stopSpin(motor, direction)}
            onpointerleave={() => stopSpin(motor, direction)}
            onpointercancel={() => stopSpin(motor, direction)}
            onkeydown={(e) =>
              (e.key === " " || e.key === "Enter") &&
              startSpin(motor, direction)}
            onkeyup={() => stopSpin(motor, direction)}
            onblur={() => stopSpin(motor, direction)}
          >
            {output === holder
              ? $i18n.t("setupWizardMotorSpinning")
              : direction > 0
                ? $i18n.t("setupWizardMotorHoldForward")
                : $i18n.t("setupWizardMotorHoldReverse")}
          </button>
        {/each}
      </div>
    {/each}
  </section>
{/if}

<div>
  <button class="btn" onclick={() => wiz.openTab("motors")}>
    {$i18n.t("setupWizardOpenMotors")}
  </button>
</div>

<style lang="scss">
  .reading {
    font-weight: 600;
    font-variant-numeric: tabular-nums;

    &.good {
      color: var(--color-status-good);
    }

    &.warn {
      color: var(--color-status-bad);
    }
  }

  .btn {
    @extend %button;
  }

  .btn.primary {
    @extend %button-primary;
  }

  p {
    margin: 0;
    max-width: 70ch;
  }

  .intro {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 28px;
  }

  //// Protocol tiles: the radio stays for keyboard and screen readers.

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    border: none;
    margin: 0;
    padding: 0;
    min-width: 0;

    legend {
      font-weight: 600;
      margin-bottom: 8px;
      padding: 0;
    }
  }

  .choice {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
    cursor: pointer;
    transition:
      border-color var(--animation-speed),
      background-color var(--animation-speed),
      box-shadow var(--animation-speed);

    &:hover {
      border-color: var(--color-border);
    }

    &:has(input:focus-visible) {
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    &.selected {
      border-color: var(--color-accent-500);
      background-color: var(--color-accent-soft);
      box-shadow: inset 0 0 0 1px var(--color-accent-500);
    }

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
  }

  .choice-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;

    i {
      color: var(--color-accent-500);
    }
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  //// Port cards, as on the ESC telemetry step.

  .ports {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
  }

  .port {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--animation-speed),
      background-color var(--animation-speed),
      box-shadow var(--animation-speed);

    &:hover:not(:disabled) {
      border-color: var(--color-border);
    }

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-focus-ring);
    }

    &.selected {
      border-color: var(--color-accent-500);
      background-color: var(--color-accent-soft);
      box-shadow: inset 0 0 0 1px var(--color-accent-500);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.55;
      background-color: transparent;
    }

    i {
      color: var(--color-accent-500);
    }
  }

  .port-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }

  .port-use {
    color: var(--color-text-soft);
    font-size: 0.85em;
  }

  //// The safety card: a warning until the prop-off box is ticked.

  .test {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 24px;
    padding: 14px 18px;
    border: 1px solid var(--color-status-bad);
    border-radius: var(--radius-md);
    background-color: color-mix(
      in srgb,
      var(--color-status-bad) 6%,
      var(--color-surface-sunken)
    );
    transition:
      border-color var(--animation-speed),
      background-color var(--animation-speed);

    &.confirmed {
      border-color: var(--color-border-soft);
      background-color: var(--color-surface-sunken);
    }
  }

  .art {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
  }

  .safety-text {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  //// Numbered cards, as on the Receiver step.

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--color-border-soft);
    border-radius: var(--radius-md);
    background-color: var(--color-surface-sunken);
  }

  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    margin: 0;
    font-size: 1em;
    font-weight: 700;
  }

  .num {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background-color: var(--color-accent-500);
    color: var(--color-accent-fg);
    font-size: 0.8em;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border: 1px solid currentColor;
    border-radius: var(--radius-pill);
    font-size: 0.8em;
    font-weight: 600;

    &.good {
      color: var(--color-status-good);
    }
  }

  .prop {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .step-label {
    font-weight: 600;
  }

  // Throttle as a segmented control; the radios stay for the keyboard.
  .segments {
    display: inline-flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .segment {
    position: relative;
    padding: 4px 14px;
    cursor: pointer;
    font-variant-numeric: tabular-nums;

    & + & {
      border-left: 1px solid var(--color-border);
    }

    &.selected {
      background-color: var(--color-accent-500);
      color: #fff;
    }

    &:has(input:disabled) {
      cursor: default;
      opacity: 0.6;
    }

    &:has(input:focus-visible) {
      box-shadow: inset 0 0 0 2px var(--color-focus-ring);
    }

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
  }

  .spin {
    min-width: 180px;
    touch-action: none;
    user-select: none;
  }

  .muted {
    color: var(--color-text-soft);
    font-size: 0.9em;
  }

  // Four tiles: two by two on most widths.
  .esc-modes {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .no-rpm {
    display: flex;
    gap: 10px;
    align-items: baseline;
    max-width: 80ch;
    padding: 10px 14px;
    border-left: 4px solid var(--color-accent-500);
    border-radius: var(--radius-xs);
    background-color: var(--color-surface-sunken);

    i {
      color: var(--color-accent-500);
    }
  }
</style>

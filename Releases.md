# 0.0.5

First Gripora release of the Configurator, for RC cars, at cfg.gripora.org. Require MSP API 33.0 (the 0.0.2 firmware and later; the 0.0.4 firmware for the drive telemetry, the 0.0.5 firmware for a Setup Wizard gyro check that is easy to see); WingFlight firmware is refused.
Add a car mixer preset: model types Car and Custom, steering on S1 and a reversible ESC on M1, with optional rear steering on S2 and a second ESC on M2.
Add a Drive section to the Motors tab: how the ESC reverses, tyre diameter and gear ratio for the speed, the gyro fade-in speeds, the gyro in reverse and its gain, and a live readout.
Add a Drive aids panel to the Profiles tab, per PID profile: ABS, Traction control and Launch control, with previews and a live status.
Add a Drift panel to the Profiles tab for DRIFT mode: counter-steer gain, allowed turn rate and counter-steer limit.
Add the GYRO OFF, DRIVE AIDS OFF, LAUNCH and DRIFT modes to the Modes tab, and as optional switches in the Setup Wizard.
Add the Drive Status and Wheel Speed telemetry sensors to the Receiver tab.
Change the Setup Wizard for a car: the car or custom model step, an ESC neutral check with the wheels off the ground and how the ESC reverses, steering servos only, a steering direction check, and a gyro direction check with a Reverse gyro switch. Car pictures and radio guides from a surface radio replace the aircraft ones.
Change the Receiver tab to the car channel order (CH1 steering, CH2 throttle, CH3-CH6 AUX), with a Car or Custom order, a steering deadband and a signed throttle. The other tabs name channels the same way.
Change the Status tab to car readouts: a steering dial, throttle and brake bars with ABS, traction and launch badges, speed, direction, turn rate and body tilt.
Change the 3D preview to a car.
Change the PID, gain, rate and curve pages to steering only, and the wording throughout to a car: Steering for yaw, turn rate, car, controller, drive mode, wheel and trigger.
Set the speed attenuation top speed to 10..300 km/h (default 60), from wheel speed.
Set the motor test slider to -100..+100 for reversible ESCs.
Remove the Thrust Vector and GPS Navigation tabs, the governor, leveling, trainer and Tune Advisor settings, the aircraft mixer rule roles, remote support and the Discord links.

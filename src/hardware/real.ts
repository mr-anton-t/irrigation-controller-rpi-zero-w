import type { Hardware, SensorSample } from "./types.js";
import { getSettings } from "../db.js";

/**
 * Real drivers are optional so Docker/dev installs stay light.
 * On the Pi: npm i onoff bme280
 */
export async function createRealHardware(): Promise<Hardware> {
  const pins = getSettings();
  let Gpio: any;
  let bme280mod: any;
  try {
    Gpio = (await import("onoff" as string)).Gpio;
    bme280mod = await import("bme280" as string);
  } catch {
    throw new Error(
      "Реальные драйверы не установлены. На Pi: npm i onoff bme280. Или USE_MOCK=true."
    );
  }

  const pin = new Gpio(pins.relay_gpio, "out");
  const sensor = await bme280mod.open({
    i2cBusNumber: pins.i2c_bus,
    i2cAddress: pins.bme280_address,
  });

  let relayOn = false;

  const writePin = async (on: boolean) => {
    const activeLow = getSettings().relay_active_low;
    const level = activeLow ? (on ? 0 : 1) : on ? 1 : 0;
    await pin.write(level);
    relayOn = on;
  };

  await writePin(false);

  return {
    async readSensor(): Promise<SensorSample> {
      const r = await sensor.read();
      return {
        tempC: r.temperature,
        humidity: r.humidity,
        pressureHpa: r.pressure ?? null,
      };
    },
    async setRelay(on: boolean) {
      await writePin(on);
    },
    getRelay() {
      return relayOn;
    },
    async close() {
      await writePin(false);
      pin.unexport();
      await sensor.close();
    },
  };
}

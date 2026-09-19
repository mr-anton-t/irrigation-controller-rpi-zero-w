import type { Hardware, SensorSample } from "./types.js";

export class MockHardware implements Hardware {
  private relayOn = false;
  private t = 21;
  private h = 48;

  async readSensor(): Promise<SensorSample> {
    this.t += (Math.random() - 0.48) * 0.4;
    this.h += (Math.random() - 0.5) * 0.8;
    this.t = Math.min(34, Math.max(14, this.t));
    this.h = Math.min(90, Math.max(25, this.h));
    return {
      tempC: Number(this.t.toFixed(2)),
      humidity: Number(this.h.toFixed(2)),
      pressureHpa: Number((1010 + (Math.random() - 0.5) * 8).toFixed(2)),
    };
  }

  async setRelay(on: boolean): Promise<void> {
    this.relayOn = on;
    console.log(`[mock relay] ${on ? "ON" : "OFF"}`);
  }

  getRelay(): boolean {
    return this.relayOn;
  }

  async close(): Promise<void> {}
}

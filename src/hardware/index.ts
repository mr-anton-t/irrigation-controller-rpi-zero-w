import { config } from "../config.js";
import { MockHardware } from "./mock.js";
import type { Hardware } from "./types.js";

export async function createHardware(): Promise<Hardware> {
  if (config.useMock) {
    console.log("Hardware: MOCK");
    return new MockHardware();
  }
  const { createRealHardware } = await import("./real.js");
  console.log("Hardware: REAL GPIO + BME280");
  return createRealHardware();
}

export type { Hardware } from "./types.js";

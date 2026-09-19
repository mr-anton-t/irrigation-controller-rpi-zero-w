export const config = {
  port: Number(process.env.PORT ?? 3000),
  useMock: process.env.USE_MOCK !== "false",
  dbPath: process.env.DB_PATH ?? "./data/irrigation.db",
  sampleIntervalMs: Number(process.env.SAMPLE_INTERVAL_MS ?? 60_000),
  relayGpio: Number(process.env.RELAY_GPIO ?? 17),
  relayActiveLow: process.env.RELAY_ACTIVE_LOW !== "false",
  i2cBus: Number(process.env.I2C_BUS ?? 1),
  bme280Address: Number(process.env.BME280_ADDRESS ?? 0x76),
};

export type SensorSample = {
  tempC: number;
  humidity: number;
  pressureHpa: number | null;
};

export interface Hardware {
  readSensor(): Promise<SensorSample>;
  setRelay(on: boolean): Promise<void>;
  getRelay(): boolean;
  close(): Promise<void>;
}

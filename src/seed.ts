import { dewPointC } from "./dewpoint.js";
import { countReadings, insertReading } from "./db.js";

if (countReadings() > 0) {
  console.log("seed: already has data");
  process.exit(0);
}

const now = Date.now();
const step = 5 * 60 * 1000;
for (let i = 288; i >= 0; i--) {
  const ts = now - i * step;
  const hour = new Date(ts).getHours() + new Date(ts).getMinutes() / 60;
  const temp = 18 + 6 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
  const humidity = 55 - 8 * Math.sin(((hour - 8) / 24) * Math.PI * 2) + (Math.random() - 0.5);
  insertReading({
    ts,
    temp_c: Number(temp.toFixed(2)),
    humidity: Number(humidity.toFixed(2)),
    pressure_hpa: Number((1012 + Math.sin(i / 20)).toFixed(2)),
    dew_point_c: dewPointC(temp, humidity),
  });
}
console.log("seed: 289 points");

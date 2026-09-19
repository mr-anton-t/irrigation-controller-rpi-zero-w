# Irrigation controller (Pi Zero W)

Node + TypeScript. Locally and in Docker hardware is mocked (`USE_MOCK=true`).

## Docker

```bash
docker compose up --build
```

http://localhost:3000

- `/` water button
- `/chart.html` climate chart
- `/settings.html` units, theme, Wi-Fi, IP, GPIO pins

## Raspberry Pi Zero W

```bash
sudo raspi-config   # enable I2C
npm install
npm i onoff bme280
npx tsc
USE_MOCK=false node dist/index.js
```

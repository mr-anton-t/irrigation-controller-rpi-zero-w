# Irrigation controller (Pi Zero W)

Node + TypeScript. Локально и в Docker железо мокается (`USE_MOCK=true`).

## Список деталей

См. предыдущий README на main для полного списка деталей и схемы питания.

## Подключение

![Схема подключения Pi Zero W, питания, BME280 и реле](docs/wiring.png)

Исходник: [docs/wiring.svg](docs/wiring.svg).

## Интерфейс

- `/` — кнопка «Полить», длительность вручную, несколько расписаний
- `/chart.html` — температура, влажность, точка росы
- `/settings.html` — единицы, тема, Wi‑Fi, IP, NTP, пины GPIO / I2C

Расписание без cron: дни недели (или «все»), время и длительность. Можно добавить несколько строк (например будни 07:00 и выходные 09:00). Старое поле cron при первом запуске превращается в одно расписание.

![Главный экран](docs/ui-home.png)

![Настройки](docs/ui-settings.png)

![График](docs/ui-chart.png)

## Docker (тест / отладка)

```bash
docker compose up --build
```

http://localhost:3000

## На самой Pi

```bash
sudo raspi-config   # I2C
npm install
npm i onoff bme280
npx tsc
USE_MOCK=false node dist/index.js
```

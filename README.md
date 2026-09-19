# Irrigation controller (Pi Zero W)

Node + TypeScript. Локально и в Docker железо мокается (`USE_MOCK=true`).

## Список деталей

| # | Деталь | Кол-во | Зачем |
|---|---|---|---|
| 1 | Raspberry Pi Zero W | 1 | контроллер, Wi‑Fi |
| 2 | microSD 16 ГБ+ (Raspberry Pi OS Lite) | 1 | система |
| 3 | BME280, плата 3.3V I2C | 1 | температура, влажность, давление |
| 4 | Реле 5V, 1 канал (лучше с опторазвязкой) | 1 | насос / клапан |
| 5 | Li-ion 18650 или LiPo **1S 3.7V** с защитой | 1 | автономное питание |
| 6 | Держатель 18650 или разъём JST | 1 | посадка банки |
| 7 | TP4056 **с защитой** (DW01 + FS8205) | 1 | зарядка 1S до 4.2V |
| 8 | USB-кабель к TP4056 + блок 5V 1A | 1 | зарядка |
| 9 | Boost 3.7→5V (MT3608 / PowerBoost), ≥2A | 1 | питание Pi и реле |
| 10 | Провода Dupont | набор | логика |
| 11 | Макетная плата | 1 | по желанию |
| 12 | Насос / клапан 220V или 12V | 1 | полив через COM/NO |
| 13 | Корпус, стойки, стяжки | по месту | сборка |

Не брать: 2S 7.4V на Pi, TP4056 без защиты, boost 0.5A.

## Подключение

![Схема подключения](docs/wiring.svg)

Цепочка питания: USB 5V → TP4056 → банка 3.7V 1S → boost 5V → Pi pin 2 / GND.

BME280: 3V3, GND, SDA=GPIO2, SCL=GPIO3. Реле: 5V, GND, IN=GPIO17.

## Сборка

1. microSD с Raspberry Pi OS Lite.
2. Boost выставить 5.0–5.2V до подключения Pi.
3. 1S → TP4056 B+/B− → OUT → boost VIN → 5V на pin 2 и GND.
4. BME280 только на 3.3V.
5. Реле логика, потом проверка i2cdetect и кнопки Полить.
6. 220V в последнюю очередь, вилка вынута, фаза через COM/NO.

## Docker

```bash
docker compose up --build
```

http://localhost:3000

## На Pi

```bash
sudo raspi-config
npm install && npm i onoff bme280 && npx tsc
USE_MOCK=false node dist/index.js
```

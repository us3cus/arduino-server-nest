/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          ok: true,
          message: 'Growbox backend is running',
          mode: 'manual',
          relayState: 0,
          relays: {
            light: 0,
            fan: 0,
            humidifier: 0,
            pump: 0,
          },
          lastSeen: null,
          lastTelemetry: null,
        });
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
        expect(typeof body.uptime).toBe('number');
      });
  });

  it('/api/device/command (GET) returns 4-channel command', () => {
    return request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.mode).toBe('manual');
        expect(body.relay).toBe(0);
        expect(body.relay_light).toBe(0);
        expect(body.relay_fan).toBe(0);
        expect(body.relay_humidifier).toBe(0);
        expect(body.relay_pump).toBe(0);
        expect(body.relays).toEqual({
          light: 0,
          fan: 0,
          humidifier: 0,
          pump: 0,
        });
        expect(body.lcd_line1).toBe('');
        expect(body.lcd_line2).toBe('');
        expect(typeof body.timestamp).toBe('string');
      });
  });

  it('/api/mode (GET) returns default manual mode', () => {
    return request(app.getHttpServer())
      .get('/api/mode')
      .expect(200)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.mode).toBe('manual');
      });
  });

  it('/api/mode (POST) switches to auto mode', async () => {
    await request(app.getHttpServer())
      .post('/api/mode')
      .send({ mode: 'auto' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.mode).toBe('auto');
      });

    await request(app.getHttpServer())
      .get('/api/mode')
      .expect(200)
      .expect(({ body }) => {
        expect(body.mode).toBe('auto');
      });
  });

  it('/api/mode (POST) validates mode value', () => {
    return request(app.getHttpServer())
      .post('/api/mode')
      .send({ mode: 'invalid-mode' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.ok).toBe(false);
        expect(body.error).toBe("mode must be 'manual' or 'auto'");
      });
  });

  it('/api/lcd (POST) updates lcd command text', async () => {
    await request(app.getHttpServer())
      .post('/api/lcd')
      .send({ line1: 'Hello ESP32', line2: 'Postman says hi' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.lcd_line1).toBe('Hello ESP32');
        expect(body.lcd_line2).toBe('Postman says hi');
      });

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.lcd_line1).toBe('Hello ESP32');
        expect(body.lcd_line2).toBe('Postman says hi');
      });
  });

  it('/api/lcd (POST) validates payload', () => {
    return request(app.getHttpServer())
      .post('/api/lcd')
      .send({ line1: 123 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.ok).toBe(false);
        expect(body.error).toBe('line1 and line2 must be strings');
      });
  });

  it('/api/lcd (POST) accepts lcd_line1/lcd_line2 aliases', async () => {
    await request(app.getHttpServer())
      .post('/api/lcd')
      .send({ lcd_line1: 'Alias line 1', lcd_line2: 'Alias line 2' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.lcd_line1).toBe('Alias line 1');
        expect(body.lcd_line2).toBe('Alias line 2');
      });
  });

  it('/api/lcd (POST) rejects empty body', () => {
    return request(app.getHttpServer())
      .post('/api/lcd')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.ok).toBe(false);
        expect(body.error).toBe(
          'Request body is empty. Send JSON with line1/line2 and Content-Type: application/json',
        );
      });
  });

  it('/api/relay (POST) supports legacy light relay payload', async () => {
    await request(app.getHttpServer())
      .post('/api/relay')
      .send({ relay: 1 })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.relay).toBe(1);
        expect(body.relays.light).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.relay).toBe(1);
        expect(body.relay_light).toBe(1);
      });
  });

  it('/api/relay (POST) supports channel + state payload', async () => {
    await request(app.getHttpServer())
      .post('/api/relay')
      .send({ channel: 'fan', state: 1 })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.updatedChannel).toBe('fan');
        expect(body.relays.fan).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.relay_fan).toBe(1);
      });
  });

  it('/api/relay (POST) supports multi-channel relays payload', async () => {
    await request(app.getHttpServer())
      .post('/api/relay')
      .send({
        relays: {
          light: 1,
          humidifier: 1,
        },
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.relays.light).toBe(1);
        expect(body.relays.humidifier).toBe(1);
      });
  });

  it('/api/relay (POST) validates relay value', () => {
    return request(app.getHttpServer())
      .post('/api/relay')
      .send({ relay: 2 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.ok).toBe(false);
        expect(body.error).toBe('relay must be 0 or 1');
      });
  });

  it('/api/relay (POST) blocks manual updates in auto mode', async () => {
    await request(app.getHttpServer())
      .post('/api/mode')
      .send({ mode: 'auto' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/relay')
      .send({ channel: 'light', state: 1 })
      .expect(409)
      .expect(({ body }) => {
        expect(body.ok).toBe(false);
        expect(body.error).toBe(
          'Manual relay control is disabled while mode is auto',
        );
      });
  });

  it('/api/device/telemetry (POST) saves telemetry and updates root state', async () => {
    const telemetryPayload = {
      device_id: 'esp32-test-01',
      relay_light: 0,
      relay_fan: 0,
      relay_humidifier: 0,
      relay_pump: 0,
      temperature_c: 24.5,
      humidity: 51,
    };

    await request(app.getHttpServer())
      .post('/api/device/telemetry')
      .send(telemetryPayload)
      .expect(201)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.received).toBe(true);
        expect(body.mode).toBe('manual');
        expect(body.relay).toBe(0);
        expect(typeof body.timestamp).toBe('string');
      });

    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.lastTelemetry).toEqual(telemetryPayload);
        expect(typeof body.lastSeen).toBe('string');
      });

    await request(app.getHttpServer())
      .get('/api/device/dht')
      .expect(200)
      .expect(({ body }) => {
        expect(body.ok).toBe(true);
        expect(body.temperature_c).toBe(24.5);
        expect(body.humidity).toBe(51);
        expect(typeof body.timestamp).toBe('string');
      });
  });

  it('/api/device/telemetry + auto mode applies fan/humidifier thresholds', async () => {
    await request(app.getHttpServer())
      .post('/api/mode')
      .send({ mode: 'auto' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/device/telemetry')
      .send({
        device_id: 'esp32-growbox',
        temperature_c: 29,
        humidity: 50,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.mode).toBe('auto');
        expect(body.relay_fan).toBe(1);
        expect(body.relay_humidifier).toBe(1);
      });

    await request(app.getHttpServer())
      .post('/api/device/telemetry')
      .send({
        device_id: 'esp32-growbox',
        temperature_c: 24,
        humidity: 70,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.relay_fan).toBe(0);
        expect(body.relay_humidifier).toBe(0);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

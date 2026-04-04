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
        expect(body).toEqual({
          ok: true,
          message: 'ESP32 test backend is running',
          relayState: 0,
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

  it('/api/device/command (GET) returns relay state', () => {
    return request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.relay).toBe(0);
        expect(body.lcd_line1).toBe('');
        expect(body.lcd_line2).toBe('');
        expect(typeof body.timestamp).toBe('string');
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

  it('/api/relay (POST) updates relay to 1', async () => {
    await request(app.getHttpServer())
      .post('/api/relay')
      .send({ relay: 1 })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true, relay: 1 });
      });

    await request(app.getHttpServer())
      .get('/api/device/command')
      .expect(200)
      .expect(({ body }) => {
        expect(body.relay).toBe(1);
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

  it('/api/device/telemetry (POST) saves telemetry and updates root state', async () => {
    const telemetryPayload = {
      device_id: 'esp32-test-01',
      relay: 0,
      sensor_mock: 123,
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

  afterEach(async () => {
    await app.close();
  });
});

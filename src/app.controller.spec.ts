import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return backend status payload', () => {
      expect(appController.getRootStatus()).toMatchObject({
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
});

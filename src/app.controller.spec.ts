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
      expect(appController.getRootStatus()).toEqual({
        ok: true,
        message: 'ESP32 test backend is running',
        relayState: 0,
        lastSeen: null,
        lastTelemetry: null,
      });
    });
  });
});

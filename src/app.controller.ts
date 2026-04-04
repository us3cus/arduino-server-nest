import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRootStatus() {
    return this.appService.getRootStatus();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('api/device/command')
  getDeviceCommand() {
    return this.appService.getDeviceCommand();
  }

  @Post('api/device/telemetry')
  postDeviceTelemetry(@Body() body: Record<string, unknown>) {
    return this.appService.saveTelemetry(body);
  }

  @Post('api/relay')
  postRelay(@Body() body: { relay?: unknown }) {
    const relay = body?.relay;

    if (relay !== 0 && relay !== 1) {
      throw new BadRequestException({
        ok: false,
        error: 'relay must be 0 or 1',
      });
    }

    return this.appService.setRelay(relay);
  }
}

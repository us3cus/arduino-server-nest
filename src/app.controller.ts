import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
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

  @Get('api/device/dht')
  getDeviceDht() {
    return this.appService.getLatestDht();
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

  @Post('api/lcd')
  postLcd(
    @Body()
    body: {
      line1?: unknown;
      line2?: unknown;
      lcd_line1?: unknown;
      lcd_line2?: unknown;
    },
  ) {
    const line1 = body?.line1 ?? body?.lcd_line1;
    const line2 = body?.line2 ?? body?.lcd_line2;

    if (line1 === undefined && line2 === undefined) {
      throw new BadRequestException({
        ok: false,
        error:
          'Request body is empty. Send JSON with line1/line2 and Content-Type: application/json',
      });
    }

    if (
      (line1 !== undefined && typeof line1 !== 'string') ||
      (line2 !== undefined && typeof line2 !== 'string')
    ) {
      throw new BadRequestException({
        ok: false,
        error: 'line1 and line2 must be strings',
      });
    }

    return this.appService.setLcdText(line1 ?? '', line2 ?? '');
  }
}

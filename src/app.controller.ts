import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';

type RelayChannel = 'light' | 'fan' | 'humidifier' | 'pump';
type RelayPatch = Partial<Record<RelayChannel, 0 | 1>>;

type ModeServiceApi = {
  getModeStatus: () => Record<string, unknown>;
  setMode: (mode: 'manual' | 'auto') => Record<string, unknown>;
};

type RelayServiceApi = {
  setLegacyRelay: (relay: 0 | 1) => Record<string, unknown>;
  setRelayChannel: (
    channel: RelayChannel,
    state: 0 | 1,
  ) => Record<string, unknown>;
  setRelayStates: (patch: RelayPatch) => Record<string, unknown>;
};

type RelayBody = {
  relay?: unknown;
  channel?: unknown;
  state?: unknown;
  relays?: unknown;
};

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

  @Get('api/mode')
  getMode() {
    return (this.appService as unknown as ModeServiceApi).getModeStatus();
  }

  @Post('api/mode')
  postMode(@Body() body: { mode?: unknown }) {
    const mode = body?.mode;

    if (mode !== 'manual' && mode !== 'auto') {
      throw new BadRequestException({
        ok: false,
        error: "mode must be 'manual' or 'auto'",
      });
    }

    return (this.appService as unknown as ModeServiceApi).setMode(mode);
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
  postRelay(@Body() body: RelayBody) {
    if (body?.relay !== undefined) {
      return (this.appService as unknown as RelayServiceApi).setLegacyRelay(
        this.parseRelayState(body.relay, 'relay'),
      );
    }

    if (body?.channel !== undefined || body?.state !== undefined) {
      if (!this.isRelayChannel(body?.channel)) {
        throw new BadRequestException({
          ok: false,
          error: 'channel must be one of: light, fan, humidifier, pump',
        });
      }

      return (this.appService as unknown as RelayServiceApi).setRelayChannel(
        body.channel,
        this.parseRelayState(body?.state, 'state'),
      );
    }

    if (body?.relays !== undefined) {
      return (this.appService as unknown as RelayServiceApi).setRelayStates(
        this.parseRelayPatch(body.relays),
      );
    }

    throw new BadRequestException({
      ok: false,
      error: 'Send relay (0/1), channel+state, or relays object',
    });
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

  private parseRelayState(value: unknown, fieldName: string): 0 | 1 {
    if (value === 0 || value === 1) {
      return value;
    }

    throw new BadRequestException({
      ok: false,
      error: `${fieldName} must be 0 or 1`,
    });
  }

  private parseRelayPatch(value: unknown): RelayPatch {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException({
        ok: false,
        error: 'relays must be an object like { light: 1, fan: 0 }',
      });
    }

    const patch: RelayPatch = {};
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      throw new BadRequestException({
        ok: false,
        error: 'relays object must contain at least one channel',
      });
    }

    for (const [rawChannel, rawState] of entries) {
      if (!this.isRelayChannel(rawChannel)) {
        throw new BadRequestException({
          ok: false,
          error: `Unknown relay channel: ${rawChannel}`,
        });
      }

      patch[rawChannel] = this.parseRelayState(
        rawState,
        `relays.${rawChannel}`,
      );
    }

    return patch;
  }

  private isRelayChannel(value: unknown): value is RelayChannel {
    return (
      value === 'light' ||
      value === 'fan' ||
      value === 'humidifier' ||
      value === 'pump'
    );
  }
}

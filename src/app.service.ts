import { Injectable } from '@nestjs/common';

type TelemetryPayload = Record<string, unknown>;

@Injectable()
export class AppService {
  private relayState = 0;
  private lastTelemetry: TelemetryPayload | null = null;
  private lastSeen: string | null = null;
  private lcdLine1 = '';
  private lcdLine2 = '';

  getRootStatus() {
    return {
      ok: true,
      message: 'ESP32 test backend is running',
      relayState: this.relayState,
      lastSeen: this.lastSeen,
      lastTelemetry: this.lastTelemetry,
    };
  }

  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  getDeviceCommand() {
    return {
      relay: this.relayState,
      lcd_line1: this.lcdLine1,
      lcd_line2: this.lcdLine2,
      timestamp: new Date().toISOString(),
    };
  }

  setLcdText(line1: string, line2: string) {
    this.lcdLine1 = line1.slice(0, 16);
    this.lcdLine2 = line2.slice(0, 16);

    console.log('[LCD]', new Date().toISOString(), {
      line1: this.lcdLine1,
      line2: this.lcdLine2,
    });

    return {
      ok: true,
      lcd_line1: this.lcdLine1,
      lcd_line2: this.lcdLine2,
    };
  }

  getLatestDht() {
    const temperatureC = this.toNumberOrNull(this.lastTelemetry?.temperature_c);
    const humidity = this.toNumberOrNull(this.lastTelemetry?.humidity);

    return {
      ok: true,
      temperature_c: temperatureC,
      humidity,
      timestamp: this.lastSeen,
    };
  }

  saveTelemetry(payload: TelemetryPayload) {
    this.lastTelemetry = payload;
    this.lastSeen = new Date().toISOString();

    console.log('[TELEMETRY]', this.lastSeen, payload);

    return {
      ok: true,
      received: true,
      relay: this.relayState,
      timestamp: this.lastSeen,
    };
  }

  setRelay(relay: 0 | 1) {
    this.relayState = relay;

    console.log('[RELAY]', new Date().toISOString(), 'relay =', this.relayState);

    return {
      ok: true,
      relay: this.relayState,
    };
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return null;
  }
}

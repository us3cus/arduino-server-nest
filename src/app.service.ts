import { Injectable } from '@nestjs/common';

type TelemetryPayload = Record<string, unknown>;

@Injectable()
export class AppService {
  private relayState = 0;
  private lastTelemetry: TelemetryPayload | null = null;
  private lastSeen: string | null = null;

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
      timestamp: new Date().toISOString(),
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
}

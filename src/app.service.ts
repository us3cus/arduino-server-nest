import { ConflictException, Injectable } from '@nestjs/common';

type TelemetryPayload = Record<string, unknown>;

export type RelayChannel = 'light' | 'fan' | 'humidifier' | 'pump';
export type RelayState = 0 | 1;
export type ControlMode = 'manual' | 'auto';
export type RelayStates = Record<RelayChannel, RelayState>;

const RELAY_CHANNELS: RelayChannel[] = ['light', 'fan', 'humidifier', 'pump'];

const RELAY_PINS: Record<RelayChannel, number> = {
  light: 16,
  fan: 17,
  humidifier: 18,
  pump: 19,
};

const AUTO_RULES = {
  lightOnHour: 8,
  lightOffHour: 22,
  fanOnAtC: 28,
  fanOffAtC: 25,
  humidifierOnAtPercent: 65,
  humidifierOffAtPercent: 55,
  pumpMorningSecondOfDay: 9 * 60 * 60,
  pumpEveningSecondOfDay: 21 * 60 * 60,
  pumpDurationMs: 10_000,
  pumpTriggerWindowSec: 60,
} as const;

@Injectable()
export class AppService {
  private controlMode: ControlMode = 'manual';
  private relayStates: RelayStates = {
    light: 0,
    fan: 0,
    humidifier: 0,
    pump: 0,
  };
  private lastTelemetry: TelemetryPayload | null = null;
  private lastSeen: string | null = null;
  private lcdLine1 = '';
  private lcdLine2 = '';

  private autoDayKey = '';
  private autoMorningPumpRan = false;
  private autoEveningPumpRan = false;
  private pumpPulseUntil = 0;
  private lastPumpTriggeredAt: string | null = null;
  private lastAutoEvaluationAt: string | null = null;

  getRootStatus() {
    if (this.controlMode === 'auto') {
      this.refreshAutomaticRelayState();
    }

    return {
      ok: true,
      message: 'Growbox backend is running',
      mode: this.controlMode,
      relayState: this.relayStates.light,
      relays: this.getRelaySnapshot(),
      relayPins: RELAY_PINS,
      lastSeen: this.lastSeen,
      lastTelemetry: this.lastTelemetry,
      automation: this.getAutomationSummary(),
    };
  }

  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  getModeStatus() {
    if (this.controlMode === 'auto') {
      this.refreshAutomaticRelayState();
    }

    return {
      ok: true,
      mode: this.controlMode,
      relayState: this.relayStates.light,
      relays: this.getRelaySnapshot(),
      automation: this.getAutomationSummary(),
    };
  }

  setMode(mode: ControlMode) {
    this.controlMode = mode;

    if (mode === 'auto') {
      this.refreshAutomaticRelayState();
    } else {
      this.pumpPulseUntil = 0;
      this.relayStates.pump = 0;
    }

    console.log('[MODE]', new Date().toISOString(), 'mode =', this.controlMode);

    return this.getModeStatus();
  }

  getDeviceCommand() {
    if (this.controlMode === 'auto') {
      this.refreshAutomaticRelayState();
    }

    const relays = this.getRelaySnapshot();

    return {
      mode: this.controlMode,
      relay: relays.light,
      relay_light: relays.light,
      relay_fan: relays.fan,
      relay_humidifier: relays.humidifier,
      relay_pump: relays.pump,
      relays,
      relayPins: RELAY_PINS,
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

    if (this.controlMode === 'auto') {
      this.refreshAutomaticRelayState();
    }

    console.log('[TELEMETRY]', this.lastSeen, payload);

    return {
      ok: true,
      received: true,
      mode: this.controlMode,
      relay: this.relayStates.light,
      relays: this.getRelaySnapshot(),
      timestamp: this.lastSeen,
    };
  }

  setLegacyRelay(relay: RelayState) {
    this.ensureManualMode();

    this.relayStates.light = relay;

    console.log('[RELAY]', new Date().toISOString(), {
      channel: 'light',
      state: relay,
    });

    return this.buildRelayResponse('light');
  }

  setRelayChannel(channel: RelayChannel, state: RelayState) {
    this.ensureManualMode();

    this.relayStates[channel] = state;

    console.log('[RELAY]', new Date().toISOString(), {
      channel,
      state,
    });

    return this.buildRelayResponse(channel);
  }

  setRelayStates(patch: Partial<RelayStates>) {
    this.ensureManualMode();

    for (const channel of RELAY_CHANNELS) {
      const value = patch[channel];
      if (value === 0 || value === 1) {
        this.relayStates[channel] = value;
      }
    }

    console.log('[RELAY]', new Date().toISOString(), {
      relays: this.relayStates,
    });

    return this.buildRelayResponse();
  }

  private buildRelayResponse(updatedChannel?: RelayChannel) {
    return {
      ok: true,
      mode: this.controlMode,
      relay: this.relayStates.light,
      relayState: this.relayStates.light,
      relays: this.getRelaySnapshot(),
      updatedChannel: updatedChannel ?? null,
    };
  }

  private ensureManualMode() {
    if (this.controlMode !== 'manual') {
      throw new ConflictException({
        ok: false,
        error: 'Manual relay control is disabled while mode is auto',
      });
    }
  }

  private getRelaySnapshot(): RelayStates {
    return {
      light: this.relayStates.light,
      fan: this.relayStates.fan,
      humidifier: this.relayStates.humidifier,
      pump: this.relayStates.pump,
    };
  }

  private getAutomationSummary() {
    const nowMs = Date.now();
    const pumpActive = nowMs < this.pumpPulseUntil;

    return {
      light: {
        onFrom: '08:00',
        offAt: '22:00',
      },
      fan: {
        onAtOrAboveC: AUTO_RULES.fanOnAtC,
        offAtOrBelowC: AUTO_RULES.fanOffAtC,
      },
      humidifier: {
        onAtOrBelowPercent: AUTO_RULES.humidifierOnAtPercent,
        offAtOrAbovePercent: AUTO_RULES.humidifierOffAtPercent,
      },
      pump: {
        times: ['09:00', '21:00'],
        durationSec: AUTO_RULES.pumpDurationMs / 1000,
        active: pumpActive,
        activeUntil: pumpActive
          ? new Date(this.pumpPulseUntil).toISOString()
          : null,
        lastTriggeredAt: this.lastPumpTriggeredAt,
      },
      telemetry: {
        temperature_c: this.toNumberOrNull(this.lastTelemetry?.temperature_c),
        humidity: this.toNumberOrNull(this.lastTelemetry?.humidity),
      },
      lastEvaluatedAt: this.lastAutoEvaluationAt,
    };
  }

  private refreshAutomaticRelayState(now: Date = new Date()) {
    const nowMs = now.getTime();
    const secondsOfDay =
      now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds();

    this.relayStates.light =
      now.getHours() >= AUTO_RULES.lightOnHour &&
      now.getHours() < AUTO_RULES.lightOffHour
        ? 1
        : 0;

    const temperatureC = this.toNumberOrNull(this.lastTelemetry?.temperature_c);
    if (temperatureC !== null) {
      if (temperatureC >= AUTO_RULES.fanOnAtC) {
        this.relayStates.fan = 1;
      } else if (temperatureC <= AUTO_RULES.fanOffAtC) {
        this.relayStates.fan = 0;
      }
    }

    const humidity = this.toNumberOrNull(this.lastTelemetry?.humidity);
    if (humidity !== null) {
      if (humidity <= AUTO_RULES.humidifierOnAtPercent) {
        this.relayStates.humidifier = 1;
      } else if (humidity >= AUTO_RULES.humidifierOffAtPercent) {
        this.relayStates.humidifier = 0;
      }
    }

    this.updatePumpPulse(now, nowMs, secondsOfDay);

    this.relayStates.pump = nowMs < this.pumpPulseUntil ? 1 : 0;
    this.lastAutoEvaluationAt = now.toISOString();
  }

  private updatePumpPulse(now: Date, nowMs: number, secondsOfDay: number) {
    const currentDayKey = this.toLocalDayKey(now);

    if (currentDayKey !== this.autoDayKey) {
      this.autoDayKey = currentDayKey;
      this.autoMorningPumpRan = false;
      this.autoEveningPumpRan = false;
    }

    const morningWindowStart = AUTO_RULES.pumpMorningSecondOfDay;
    const eveningWindowStart = AUTO_RULES.pumpEveningSecondOfDay;
    const windowEndDelta = AUTO_RULES.pumpTriggerWindowSec;

    const inMorningWindow =
      secondsOfDay >= morningWindowStart &&
      secondsOfDay < morningWindowStart + windowEndDelta;
    const inEveningWindow =
      secondsOfDay >= eveningWindowStart &&
      secondsOfDay < eveningWindowStart + windowEndDelta;

    if (inMorningWindow && !this.autoMorningPumpRan) {
      this.autoMorningPumpRan = true;
      this.startPumpPulse(nowMs, '09:00');
    }

    if (inEveningWindow && !this.autoEveningPumpRan) {
      this.autoEveningPumpRan = true;
      this.startPumpPulse(nowMs, '21:00');
    }
  }

  private startPumpPulse(nowMs: number, slotLabel: '09:00' | '21:00') {
    this.pumpPulseUntil = Math.max(
      this.pumpPulseUntil,
      nowMs + AUTO_RULES.pumpDurationMs,
    );
    this.lastPumpTriggeredAt = new Date(nowMs).toISOString();

    console.log('[AUTO][PUMP]', this.lastPumpTriggeredAt, {
      slot: slotLabel,
      durationMs: AUTO_RULES.pumpDurationMs,
    });
  }

  private toLocalDayKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return null;
  }
}

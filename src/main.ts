import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

// Загрузка .env и принудительная установка таймзоны
try {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  }
} catch (e) {
  // ignore
}

// Применяем таймзону (если не была передана снаружи, берется из .env, либо Алматы по умолчанию)
process.env.TZ = process.env.TZ || 'Asia/Almaty';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const requiredOrigin = 'https://mobile.temten.me';
  const corsOrigin = process.env.CORS_ORIGIN;
  const parsedOrigins =
    corsOrigin && corsOrigin.trim() !== '*'
      ? Array.from(
          new Set(
            corsOrigin
              .split(',')
              .map((origin) => origin.trim())
              .filter((origin) => origin.length > 0)
              .concat(requiredOrigin),
          ),
        )
      : true;

  app.enableCors({
    origin: parsedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);
  console.log(`Server started on http://${host}:${port}`);
}
void bootstrap();

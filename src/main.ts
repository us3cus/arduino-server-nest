import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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

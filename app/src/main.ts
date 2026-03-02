import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);

  // CORS is disabled by default for security; enable explicitly via CORS_ORIGIN env var
  const corsOrigin = configService.get('CORS_ORIGIN');
  if (corsOrigin && corsOrigin !== 'false') {
    app.enableCors({
      origin: corsOrigin,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  Logger.log(`Application running on port ${port}`, 'Bootstrap');
}
bootstrap();

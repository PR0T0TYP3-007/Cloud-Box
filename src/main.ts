import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // Allow cross-origin requests in development so the Next frontend (running on a different port)
  // can call the API. For production, configure CORS more restrictively.
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

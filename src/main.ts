import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  
  // CORS configuration for production
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4000'];
  
  app.enableCors({ 
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Check exact match
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check if it's a Vercel preview deployment
      if (origin.includes('.vercel.app')) {
        console.log('Allowing Vercel origin:', origin);
        return callback(null, true);
      }
      
      console.error('CORS blocked origin:', origin, 'Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true 
  });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

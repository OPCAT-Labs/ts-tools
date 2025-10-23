import { NestFactory } from '@nestjs/core';
import { AppWorkerModule } from './app-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(AppWorkerModule);
  await app.listen(process.env.WORKER_PORT || 3001);
  console.log(`tracker worker is running on: ${await app.getUrl()}`);
}

bootstrap();

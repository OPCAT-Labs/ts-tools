import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

export async function bootstrap() {
  try {
    await CommandFactory.run(AppModule);
  } catch (error) {
    console.error('bootstrap failed!', error);
  }
}

if (require.main === module) {
  bootstrap();
}

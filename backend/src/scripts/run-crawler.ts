import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CrawlerService } from '../crawler.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const crawler = app.get(CrawlerService);
  await crawler.runCrawlee();
  await app.close();
}
bootstrap();

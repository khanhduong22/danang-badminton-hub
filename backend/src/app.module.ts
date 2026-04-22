import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { CrawlerService } from './crawler.service';
import { AiClassifierService } from './ai-classifier.service';
import { FbSessionService } from './fb-session.service';
import { FbScraperCoreService } from './fb-scraper-core.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [
    PrismaService,
    FbSessionService,
    FbScraperCoreService,
    CrawlerService,
    AiClassifierService,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { CrawlerService } from './crawler.service';
import { AiClassifierService } from './ai-classifier.service';
import { FbSessionService } from './fb-session.service';
import { FbScraperCoreService } from './fb-scraper-core.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
                ignore: 'pid,hostname',
              },
            }
          : undefined,
      },
    }),
  ],
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

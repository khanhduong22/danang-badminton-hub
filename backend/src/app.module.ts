import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { CrawlerService } from './crawler.service';
import { AiClassifierService } from './ai-classifier.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AppController],
  providers: [PrismaService, CrawlerService, AiClassifierService],
})
export class AppModule {}

import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('api')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('wandering-posts')
  async getWanderingPosts() {
    return this.prisma.wanderingPost.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        court: true
      }
    });
  }

  @Get('courts')
  async getCourts() {
    return this.prisma.court.findMany();
  }

  @Get('search')
  async searchPosts(@Query('q') q: string) {
    if (!q) return [];
    
    try {
      const { MeiliSearch } = require('meilisearch');
      const ms = new MeiliSearch({
        host: process.env.MEILI_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey'
      });

      const response = await ms.index('posts').search(q, {
        limit: 20
      });

      return response.hits;
    } catch (error) {
      return [];
    }
  }
}


import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Meilisearch } from 'meilisearch';

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
      const ms = new Meilisearch({
        host: process.env.MEILI_HOST || 'http://localhost:7700',
        apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey'
      });

      const response = await ms.index('posts').search(q, {
        limit: 20
      });

      if (response.hits.length === 0) return [];

      const ids = response.hits.map((hit: any) => hit.id);
      
      const posts = await this.prisma.wanderingPost.findMany({
        where: { id: { in: ids } },
        include: { court: true }
      });

      // Sắp xếp lại theo thứ tự điểm Meilisearch trả về
      return posts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } catch (error) {
      return [];
    }
  }
}


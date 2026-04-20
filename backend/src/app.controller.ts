import { Controller, Get } from '@nestjs/common';
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
}


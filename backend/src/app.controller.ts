import { Controller, Get, Post, Query, HttpCode } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CrawlerService } from './crawler.service';
import { AiClassifierService } from './ai-classifier.service';
import { Meilisearch } from 'meilisearch';

@Controller('api')
export class AppController {
  private readonly meili: Meilisearch;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
    private readonly classifier: AiClassifierService,
  ) {
    this.meili = new Meilisearch({
      host: process.env.MEILI_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey',
    });
  }

  /** Full-text + faceted search via Meilisearch */
  @Get('search')
  async searchPosts(
    @Query('q') q: string = '',
    @Query('level') level?: string,
    @Query('type') type?: string,
    @Query('active') active?: string,
  ) {
    const filter: string[] = [];
    if (level) filter.push(`level_required = "${level}"`);
    if (type) filter.push(`post_type = "${type}"`);
    if (active !== 'false') filter.push('is_active = true');

    // Filter out posts older than 3 hours ago (to hide yesterday's posts)
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    filter.push(`(start_time >= ${threeHoursAgo} OR start_time IS EMPTY)`);

    try {
      const response = await this.meili.index('posts').search(q, {
        limit: 30,
        filter: filter.length ? filter.join(' AND ') : undefined,
        sort: ['start_time:asc'],
      });

      if (response.hits.length === 0) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = response.hits.map((h: any) => h.id as number);
      const posts = await this.prisma.wanderingPost.findMany({
        where: { id: { in: ids } },
        include: { raw_content: true, court: true },
      });

      return posts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } catch {
      return [];
    }
  }

  /** List wandering posts — active only by default */
  @Get('wandering-posts')
  async getWanderingPosts(
    @Query('active') active?: string,
    @Query('type') type?: string,
    @Query('level') level?: string,
  ) {
    return this.prisma.wanderingPost.findMany({
      where: {
        is_active: active === 'false' ? undefined : true,
        ...(type ? { post_type: type } : {}),
        ...(level ? { level_required: level } : {}),
        OR: [
          { start_time: null },
          { end_time: { gte: new Date() } },
          { end_time: null, start_time: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) } },
        ],
      },
      orderBy: { start_time: 'asc' },
      include: { court: true },
    });
  }

  /** List raw scraped content from Facebook */
  @Get('raw-posts')
  async getRawPosts() {
    return this.prisma.fbRawContent.findMany({
      orderBy: { scraped_at: 'desc' },
      take: 100,
    });
  }

  /** List courts */
  @Get('courts')
  async getCourts() {
    return this.prisma.court.findMany();
  }

  /** Manual trigger: run crawler immediately (admin use) */
  @Post('crawler/trigger')
  @HttpCode(202)
  async triggerCrawler() {
    // Fire and forget
    this.crawler.runCrawlee().catch(() => undefined);
    return { message: 'Crawler triggered' };
  }

  /** Manual trigger: run AI classifier immediately (admin use) */
  @Post('classifier/trigger')
  @HttpCode(202)
  async triggerClassifier() {
    this.classifier.processUnclassified().catch(() => undefined);
    return { message: 'AI Classifier triggered' };
  }

  /** Health check */
  @Get('health')
  health() {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}

import { PrismaClient } from '@prisma/client';
import { Meilisearch } from 'meilisearch';

const prisma = new PrismaClient();
const ms = new Meilisearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey',
});

async function main() {
  // 1. Configure index settings (filterable + sortable attributes)
  console.log('Configuring Meilisearch index settings...');
  await ms.index('posts').updateSettings({
    filterableAttributes: ['level_required', 'post_type', 'is_active'],
    sortableAttributes: ['start_time', 'scraped_at'],
    searchableAttributes: ['content', 'court_name', 'address', 'author_name', 'contact_info'],
    displayedAttributes: ['*'],
  });

  // 2. Sync all WanderingPosts
  console.log('Fetching posts from Postgres...');
  const posts = await prisma.wanderingPost.findMany({
    include: { raw_content: true },
  });

  if (posts.length === 0) {
    console.log('No posts found to index.');
    return;
  }

  const documents = posts.map((post) => ({
    id: post.id,
    post_type: post.post_type,
    court_name: post.court_name || '',
    address: post.address_raw || '',
    level_required: post.level_required || '',
    price_per_slot: post.price_per_slot || '',
    contact_info: post.contact_info || '',
    content: post.content_raw || post.raw_content?.post_text || '',
    author_name: post.raw_content?.author_name || '',
    post_url: post.post_url || post.source_url || '',
    start_time: post.start_time ? new Date(post.start_time).getTime() : null,
    scraped_at: post.raw_content
      ? new Date(post.raw_content.scraped_at).getTime()
      : Date.now(),
    is_active: post.is_active,
    confidence: post.ai_confidence ?? 0,
  }));

  console.log(`Indexing ${documents.length} posts...`);
  const res = await ms.index('posts').addDocuments(documents);
  console.log(`Index task: ${res.taskUid} ✅`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

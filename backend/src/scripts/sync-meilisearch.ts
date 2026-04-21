import { PrismaClient } from '@prisma/client';
import { Meilisearch } from 'meilisearch';

const prisma = new PrismaClient();
const ms = new Meilisearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || 'supersecretmeilisearchkey'
});

async function main() {
  console.log('Fetching all posts from Postgres...');
  const posts = await prisma.wanderingPost.findMany();
  
  if (posts.length === 0) {
    console.log('No posts found to index.');
    return;
  }

  const documents = posts.map(post => ({
    id: post.id,
    court_name: post.court_name_raw,
    content: post.content_raw,
    timestamp: post.created_at ? new Date(post.created_at).getTime() : Date.now()
  }));

  console.log(`Indexing ${documents.length} posts to Meilisearch...`);
  const response = await ms.index('posts').addDocuments(documents);
  console.log('Index task created: ', response.taskUid);
  
  console.log('Index task created: ', response.taskUid);
  console.log('Done syncing DB to Meilisearch! ✅');
}

main().catch(console.error).finally(() => prisma.$disconnect());

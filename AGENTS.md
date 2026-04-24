<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Infrastructure

- **VPS**: Contabo, SSH alias `contabo` (root@144.91.88.242)
- **Project path on VPS**: `/opt/badminton-hub/`
- **Deploy flow**: push to GitHub `main` → `ssh contabo "cd /opt/badminton-hub && git pull origin main"` → rebuild if needed
- **Docker**: `docker compose -f deploy/docker-compose.yml` on VPS (DB port 5444, backend 3001, meilisearch 7700)
- **DB seed**: `cd backend && DATABASE_URL='postgresql://superadmin:supersecretpassword123@localhost:5444/badminton_hub?schema=public' npx ts-node prisma/seed.ts` — uses upsert, safe to re-run
- **Court data**: `src/data/mockCourts.json` → seed to DB. Update JSON then run seed to apply changes.

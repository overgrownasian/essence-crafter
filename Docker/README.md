# Docker

This folder contains everything needed to build and run `Essence Craft` in Docker.

## Files

- `Dockerfile`: multi-stage production image for Next.js standalone output
- `compose.yaml`: optional local container runner
- `.env.docker.example`: environment variable template

## Before you start

1. Create your app env values.
2. Make sure you have already applied [`supabase/schema.sql`](../supabase/schema.sql) to your Supabase project.
3. Decide whether you want:
   - predefined-only gameplay
   - or AI-assisted generation for new essences/classes

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Recommended runtime variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (defaults to `gpt-5-mini`)

Notes:

- Supabase public values are needed at both build time and runtime.
- `OPENAI_API_KEY` is only needed if you want AI-generated combinations/classes beyond the predefined content.

## Build the image

Run this from the project root:

```bash
docker build \
  --build-arg SUPABASE_URL=your-supabase-url \
  --build-arg SUPABASE_ANON_KEY=your-supabase-anon-key \
  --build-arg OPENAI_API_KEY=your-openai-api-key \
  --build-arg OPENAI_MODELY=defaults-to-gpt-5-mini \
  -f Docker/Dockerfile \
  -t essence-craft .
```

PowerShell version:

```powershell
docker build `
  --build-arg NEXT_PUBLIC_SUPABASE_URL=your-supabase-url `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key `
  -f Docker/Dockerfile `
  -t essence-craft .
```

## Run the container directly

```bash
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-supabase-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key \
  -e OPENAI_API_KEY=your-openai-api-key \
  -e OPENAI_MODEL=gpt-5-mini \
  essence-craft
```

PowerShell version:

```powershell
docker run --rm -p 3000:3000 `
  -e NEXT_PUBLIC_SUPABASE_URL=your-supabase-url `
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key `
  -e OPENAI_API_KEY=your-openai-api-key `
  -e OPENAI_MODEL=gpt-5-mini `
  essence-craft
```

## Run with Docker Compose

1. Copy `Docker/.env.docker.example` to `Docker/.env.docker.local`
2. Fill in your real values
3. From the project root, start it:

```bash
docker compose -f Docker/compose.yaml up --build
```

4. Open `http://localhost:3000`

## Notes

- The container serves the app on port `3000`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present at build time and runtime
- `OPENAI_API_KEY` and `OPENAI_MODEL` are runtime environment variables
- The build uses Next.js `standalone` output to keep the runtime image smaller
- If you launch from an iPhone/iPad homescreen, the app should use the standalone PWA-style shell rather than normal browser chrome

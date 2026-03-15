# Essence Craft

An infinite-craft-style progression fantasy game built with Next.js, Supabase, and OpenAI.

## What it does

- Starts every player with `Body`, `Mind`, `Spirit`, and `Mana`
- Uses a built-in essence fusion book for early and mid-game progression
- Lets players slot three discovered essences into a `Class Forge`
- Presents each forged class with an explicit `Save` or `Discard` choice
- Replaces the old achievement wall with a persistent `Class Gallery`
- Uses Supabase plus OpenAI for brand-new essence and class outcomes

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to `gpt-5-mini`)

3. In Supabase Auth, enable the `Google` provider and add your site URL plus redirect URL.

4. In Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)

5. Start the app:

```bash
npm run dev
```

## Gameplay controls

- Double-click an essence in the left panel to add it to the workbench
- Drag one workbench item on top of another to fuse essences
- Use the `Class Forge` panel to slot three essences into a class
- Save forged classes to the `Class Gallery` or discard them
- Use `Clear workbench` to remove only the current board items
- Use `Start over` to reset discoveries back to the four starter essences

## Account sync

- Guests still save progress locally on the current device
- Signing in with Google saves discovered essences, display name, theme, codex reveals, and saved classes
- Signed-in players can continue the same forge on multiple devices
- Guests are limited to the default theme and cannot create brand-new AI-generated essences or classes

## Architecture

- [app/api/combine/route.ts](app/api/combine/route.ts): cache-first essence fusion resolution
- [app/api/class/route.ts](app/api/class/route.ts): three-essence class forging
- [components/game.tsx](components/game.tsx): client gameplay loop, class forge, and gallery
- [lib/predefined-elements.ts](lib/predefined-elements.ts): starter essences and built-in fusions
- [lib/predefined-classes.ts](lib/predefined-classes.ts): curated class recipes

# Essence Craft Context

## Purpose

Essence Craft is an Infinite Craft-style combinator game re-themed around LitRPG and progression fantasy.

The project goal is not just "combine two things into a new thing." It has two connected loops:

1. Discover and combine `Essences`
2. Use three essences to forge `Classes`

The intended feel is:

- easy to experiment with
- readable on desktop and mobile
- progression-fantasy flavored rather than generic alchemy
- persistent across sessions and devices when signed in

This file is meant to give both humans and LLMs enough context to work on the codebase without having to rediscover the product intent from scratch.

## Product Goals

- Preserve the toy-like delight of Infinite Craft
- Shift the fantasy from "elements" into `Essences`, `Classes`, and progression paths
- Support both predefined/canonical progression and AI-assisted long-tail generation
- Make class creation feel like a second system, not just another two-item recipe
- Work well on desktop, iPhone, and iPad
- Allow continued iteration without hard-coding every future system into one file forever

## Current Scope

### Essence System

- Players begin with starter essences
- Players can add essences to the workbench, reposition them, duplicate them, trash them, and combine them
- Many essence outcomes are predefined
- Unknown combinations can fall back to AI generation and/or cached combinations
- The Essence Codex exposes predefined recipes and discovered content

### Class System

- Three essences are placed into a `Class Forge`
- The forge produces a class only when the player explicitly presses `Forge class`
- Many class trios are predefined to avoid hitting AI for every result
- New classes can include:
  - class name
  - title
  - flavor text
  - class mark
  - signature skills
  - character sheet data
- Players can save classes into a `Class Gallery`

### Accounts and Persistence

- Guests save locally
- Signed-in users sync to Supabase
- Player cloud state includes:
  - discovered essences
  - display name
  - role
  - theme
  - revealed codex results
  - saved classes

### Roles

- `player`
- `admin`

Admins can unlock known essences and remove non-starter essences from their own cloud account state.

## High-Level UX Model

### Desktop

Desktop is a four-column workspace:

1. Essences panel
2. Workbench
3. Class Forge
4. Class Panel

Important desktop expectations:

- drag from essences to workbench
- drag around the workbench
- drag from workbench to class forge
- class details stay visible in-panel
- desktop should avoid unnecessary modals when the content already has a panel

### Mobile / Tablet

Compact layouts are intentionally not just squashed desktop.

There are two top-level stages:

1. `Essence Crafter`
2. `Class Forger`

Important compact expectations:

- one hamburger menu at the top-left by the tabs
- the mobile class flow is its own page
- when screen space is limited, the forge is more important than auxiliary UI
- mobile uses modals more often where desktop uses side panels
- touch interactions must be explicit and forgiving

## Gameplay Nuances

### Workbench Rules

- Double-clicking / double-tapping a workbench essence duplicates it
- Processing tiles (`Crafting...`) can be moved but should not combine
- Trashing should work by drop and by direct tap patterns where appropriate
- `Start over` resets the UI state, but should not wipe the player's cloud discoveries

### Forge Rules

- Three slots only
- Filling a slot does not automatically forge a class
- `Forge class` is the explicit action
- Successful class forging clears the three forge essences
- Discarding a presented class should also reset the presented class state cleanly

### Gallery Rules

- The gallery is for saved classes, not all classes ever generated
- Gallery list items are intentionally compact
- Gallery detail modals need to scroll properly

## Architecture Overview

### Main UI

- [components/game.tsx](components/game.tsx)

This is the main gameplay client and currently contains most product logic:

- workbench behavior
- drag/drop behavior
- class forge behavior
- class gallery UI
- mobile/desktop responsive rendering
- auth/session syncing
- codex and modal flows

It is the most important file in the repo and also the highest-risk file to edit casually.

### Styling

- [app/globals.css](app/globals.css)

This contains:

- global tokens
- theme variable sets
- desktop layout
- mobile layout
- workbench and forge styling
- modal and gallery styling

A large amount of behavior is effectively encoded in CSS layout rules, especially responsive behavior.

### Server / API

- [app/api/combine/route.ts](app/api/combine/route.ts)
- [app/api/class/route.ts](app/api/class/route.ts)
- [app/api/runtime-config/route.ts](app/api/runtime-config/route.ts)
- [app/api/stats/route.ts](app/api/stats/route.ts)

These routes handle:

- essence combination
- class generation
- runtime environment config delivery
- stats

### Game Data

- [lib/predefined-elements.ts](lib/predefined-elements.ts)
- [lib/predefined-classes.ts](lib/predefined-classes.ts)
- [lib/class-presentation.ts](lib/class-presentation.ts)
- [lib/flavor-text.ts](lib/flavor-text.ts)
- [lib/types.ts](lib/types.ts)

These files define:

- the predefined essence recipe graph
- predefined class recipes
- class mark generation and presentation details
- flavor text support
- shared types

### Persistence / Cloud

- [supabase/schema.sql](supabase/schema.sql)
- [lib/browser-supabase.ts](lib/browser-supabase.ts)
- [lib/supabase.ts](lib/supabase.ts)
- [lib/supabase-database.ts](lib/supabase-database.ts)

### Theme Framework

- [lib/theme-framework.ts](lib/theme-framework.ts)
- [lib/theme-loader.ts](lib/theme-loader.ts)
- [themes/README.md](themes/README.md)
- [themes/neon-tide.json](themes/neon-tide.json)

Theme support is now modular:

- core themes still exist
- extra themes are auto-loaded from `themes/*.json`
- third parties should be able to add themes without editing base app code

## Core Technical Decisions

### Drag and Drop

- Uses `dnd-kit`
- There are custom fallbacks for some drop behaviors, especially around workbench and forge interactions
- Desktop and touch input do not always behave identically

When working on drag/drop:

- test desktop mouse
- test touch
- test workbench-to-workbench
- test workbench-to-trash
- test workbench-to-forge
- test essence-panel-to-workbench

### Responsive Design

Do not assume desktop layout rules will degrade cleanly to mobile.

The project intentionally uses separate mobile interaction patterns in some places:

- compact stage tabs
- top-level mobile menu
- mobile forge selector modal
- mobile forged-class modal

### PWA / App-Like Mobile Experience

The app has:

- manifest support
- generated icons
- standalone metadata
- iOS zoom prevention support

Relevant files:

- [app/layout.tsx](app/layout.tsx)
- [app/manifest.ts](app/manifest.ts)
- [app/icon.tsx](app/icon.tsx)
- [app/apple-icon.tsx](app/apple-icon.tsx)

## Known Fragility Areas

### 1. `components/game.tsx`

This file is the center of gravity. Small edits can have surprising effects on:

- drag/drop
- mobile-only flows
- cloud sync
- modals
- class presentation

If making changes here:

- read the nearby code first
- check desktop and mobile assumptions
- be careful with duplicated render paths

### 2. CSS Layout Interactions

The desktop and mobile forge/class layouts are sensitive to:

- `min-height: 0`
- `overflow`
- flex vs grid
- hidden desktop/mobile shells
- fixed vs in-flow buttons/modals

When something "looks like it should work" but overlaps or fails to scroll, the issue is often layout containment rather than content.

### 3. Theme Styling

There are legacy hardcoded theme blocks in [app/globals.css](app/globals.css) and a newer modular theme framework.

That means theme work currently lives in two layers:

- static built-in theme CSS in `globals.css`
- runtime-loaded theme modules

This is workable, but future cleanup may want to migrate built-in themes into the modular format too.

### 4. Cloud Merge Behavior

Cloud persistence is intentionally not a naive overwrite. There is merge logic to avoid wiping cloud progress when the local UI is reset.

Be careful with anything that changes:

- `latestPersistedStateRef`
- `preservedCloudStateRef`
- `lastCloudSnapshotRef`

## Product-Specific Content Notes

### He Who Fights With Monsters Influence

The project includes inspiration from *He Who Fights With Monsters*, especially:

- essence ideas
- class references
- the `Affliction Specialist` easter egg path

Important nuance:

- some content is intentionally inspired by source material
- some content is intentionally original or adapted
- avoid accidental over-copying of copyrighted text

### Affliction Specialist

This is a special-case class with Jason-inspired details while avoiding direct in-game naming.

If editing this class, preserve the intent:

- it is an easter egg
- it is supposed to feel specific, not generic

## How To Add or Change Things Safely

### Adding a New Predefined Essence

1. Update [lib/predefined-elements.ts](lib/predefined-elements.ts)
2. Make sure the new essence is reachable from the starter graph
3. Check for recipe collisions
4. Confirm the codex can display it

### Adding a New Predefined Class

1. Update [lib/predefined-classes.ts](lib/predefined-classes.ts)
2. Make sure all required essences are craftable
3. Confirm presentation data looks good in:
   - class panel
   - gallery
   - mobile modal

### Adding a New Theme

1. Add a `.json` file to [themes](themes)
2. Follow [themes/README.md](themes/README.md)
3. Reload the app
4. Confirm the theme appears in theme pickers

No base app code changes should be required for a normal theme module.

### Changing Mobile UX

Always test:

- top tabs
- hamburger menu
- workbench interactions
- forge selector
- forged class modal
- class gallery access

### Changing Desktop UX

Always test:

- four-column balance
- class forge height behavior
- class panel scrolling
- drag/drop across columns
- desktop-only buttons and overlays

## Recommended Verification After Changes

Minimum:

```bash
npm run typecheck
npm run lint
```

For interaction-heavy work, also manually test:

- desktop mouse drag/drop
- mobile/touch interaction
- workbench duplication
- trash behavior
- class forging
- class gallery modal scrolling
- sign-in / sign-out behavior

## Suggested Future Improvements

- Split `components/game.tsx` into feature modules:
  - workbench
  - forge
  - gallery
  - auth/cloud
  - mobile nav
- Move built-in themes into modular theme files
- Add automated graph validation for predefined essences and classes
- Add more explicit integration tests for drag/drop and mobile flows
- Add a developer-facing diagnostics mode for:
  - current drag source
  - current drop target
  - current mobile stage
  - current role/theme/session state

## Bottom Line

If you are changing this project, the most important thing to understand is:

- this is a two-loop progression game, not just a recipe generator
- desktop and mobile intentionally behave differently in some places
- layout and interaction changes are tightly coupled
- cloud sync is merge-sensitive
- themes are now becoming modular and should keep moving in that direction

When in doubt, preserve:

- discoverability
- explicit forging actions
- mobile usability
- desktop readability
- progression-fantasy flavor

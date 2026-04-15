# Honor of Kings Skin Trivia

Trivia web app prototype for guessing heroes and skins from splash art.

## Implemented in this first pass

- Question target modes:
  - Guess Hero Name
  - Guess Skin Name
- Answer input modes:
  - Typed entry (case-insensitive)
  - 4-option multiple choice
- Scoring styles:
  - 5 Minute Easy (+1 correct, no penalty)
  - 5 Minute Hard (+1 correct, -1 wrong)
  - Sudden Death (first wrong ends the run)
- Responsive UI for desktop and mobile.

## Stack

- React 19 + TypeScript
- Vite
- CSS custom theme (no UI framework dependency)

## Run locally

1. Install dependencies.
2. Start dev server.

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Data model

Current seed dataset is in src/data/skins.ts with this shape:

- id
- heroId
- heroName
- heroAliases[]
- skinName
- skinAliases[]
- imageUrl
- source

This initial dataset uses placeholder images and a starter fan-curated sample.

## Next implementation steps

1. Replace placeholder dataset with full official mapping (300+ skins).
2. Add ingestion script from approved source (manual import flow first).
3. Add unit tests for scoring and answer normalization.
4. Configure Netlify deploy pipeline.

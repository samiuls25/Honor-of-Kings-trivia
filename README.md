# Honor of Kings Skin Trivia

Trivia web app for guessing heroes and skins from splash art.

## Project status

This repository is the technical starting point for the app and has not been deployed yet.

## Current capabilities

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

## Real data ingestion workflow

This project includes a real-data pipeline from exported network capture to app-ready TypeScript data.

1. Export a capture file from browser devtools on the official skin page.
2. Save as either:
  - data/raw/hok-skins-capture.har
  - data/raw/hok-skins-capture.json
3. Run full pipeline:

```bash
npm run ingest:all
```

You can also run steps individually:

```bash
npm run ingest:extract
npm run ingest:validate
npm run ingest:generate
```

Output files:

- data/processed/skins.normalized.json
- data/processed/meta.json
- src/data/skins.generated.ts

At runtime, src/data/skins.ts automatically uses generated data when available and falls back to the starter seed dataset otherwise.

## Data model

The dataset shape used by the app is:

- id
- heroId
- heroName
- heroAliases[]
- skinName
- skinAliases[]
- imageUrl
- source

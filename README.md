# Honor of Kings Skin Trivia

A fun little trivia web app for guessing heroes and skins from splash art, or guessing OST track titles from audio! Test your knowledge or just enjoy the artwork. Share your score with friends or share specific gallery artwork you like. Play the game here: https://hoktrivia.netlify.app/

## Visuals: Game/Gallery Mode
### Trivia Mode Home Page
<img width="1903" height="943" alt="image" src="https://github.com/user-attachments/assets/fb5e50ad-450b-47dc-ba69-2a0cf3f4f59a" />

### Trivia Mode Game Page
<img width="1900" height="936" alt="image" src="https://github.com/user-attachments/assets/d112cb2a-6d27-4f64-be04-2f82f954db93" />

### Gallery Mode
<img width="1901" height="938" alt="image" src="https://github.com/user-attachments/assets/cd785275-c8da-4d48-bc29-6364a8f8946f" />

### Audio Trivia Mode
#### Sound Waves
<img width="1900" height="936" alt="image" src="https://github.com/user-attachments/assets/e0d29341-c3a6-4b06-b149-236df7446223" />

#### Track Artwork
<img width="1901" height="938" alt="image" src="https://github.com/user-attachments/assets/b3ecdd31-5b82-40c5-bc88-03035cebadd8" />

### Share Links Example
<img width="1197" height="551" alt="image" src="https://github.com/user-attachments/assets/ae250de5-4b3a-434f-9d35-8e95de8d07ff" />


## Current Features

- Question target modes:
  - Guess Hero Name
  - Guess Skin Name
  - Guess OST Track Title
- Answer input modes:
  - Typed entry (case-insensitive)
  - 4-option multiple choice
- Scoring styles:
  - 5 Minute Easy (+1 correct, no penalty)
  - 5 Minute Hard (+1 correct, -1 wrong)
  - Sudden Death (first wrong ends the run)
- Gallery mode:
  - Separate non-game skin gallery for browsing artwork
  - Source selector (Official, qing translated, or Hybrid)
- Sharing:
  - Results page includes Share Challenge with setup + score encoded in URL
  - Gallery lightbox includes Share Card for direct deep links
  - Dynamic social preview metadata is generated at /share via Netlify Function
  - Shared challenge links preload mode settings so friends can instantly retry
- OST mode:
  - Embedded audio/video player for track-based questions
  - Optional artwork reveal toggle while answering
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

To test the Netlify share metadata endpoint locally (optional):

1. Install Netlify CLI.
2. Run local Netlify dev server.

```bash
npx netlify dev
```

Build production bundle:

```bash
npm run build
```

## Deploy notes (important)

If you deploy only the `dist` folder manually, `/share` metadata links will not work because the Netlify function is outside `dist`.

Use one of these deployment methods so the function is included:

1. Git-connected Netlify site (recommended): Netlify builds and deploys from source.
2. Netlify CLI deploy with functions:

```bash
npx netlify deploy --prod --dir=dist --functions=netlify/functions
```

Function and routing files:

- `netlify/functions/share.js`
- `netlify.toml`

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

Additional source-isolated pipelines:

```bash
# Secondary skins source (qing API) -> src/data/skins.qing.generated.ts
npm run ingest:qing:all

# OST playlist fetch + normalization -> src/data/ost.generated.ts
npm run ingest:ost:all
```

`ingest:qing:all` now includes an automatic Chinese -> English translation step before validation and generation.

`ingest:ost:all` now auto-fetches playlist metadata from the Honor of Kings Audio Team channel (free, no API key), then normalizes and generates runtime OST data.

Output files:

- data/processed/skins.normalized.json
- data/processed/meta.json
- src/data/skins.generated.ts
- data/processed/skins.qing.normalized.json
- data/processed/meta.qing.json
- src/data/skins.qing.generated.ts
- data/processed/ost.normalized.json
- data/processed/ost-meta.json
- src/data/ost.generated.ts

At runtime, the app now keeps skin sources separated and lets you choose the active source in setup/gallery:
- Official Capture (recommended quality)
- qing API (translated to English)
- Hybrid backfill

The app keeps source separation intact:
- Existing website capture extractor remains primary and highest quality.
- qing API is translated and can be selected independently (or in hybrid mode).
- qing thumbnail crop parameters are stripped during ingest to improve image quality.
- OST dataset is independent and never overwrites skin capture files.

## OST source file format

Auto-fetch command:

```bash
npm run ingest:ost:fetch
```

This writes playlist-derived metadata into `data/raw/hok-ost-source.json`, then `npm run ingest:ost:all` makes OST mode playable.

You can still provide your own manual OST source file at `data/raw/hok-ost-source.json` if you prefer.

Example custom shape:

```json
[
  {
    "trackTitle": "Track Name",
    "artistName": "Honor of Kings Audio Team",
    "videoId": "YOUTUBE_VIDEO_ID",
    "imageUrl": "https://img.youtube.com/vi/YOUTUBE_VIDEO_ID/maxresdefault.jpg"
  }
]
```

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

Special thanks to qing762 for his api that provided a fuller dataset than what I originally had. API Source: https://github.com/qing762/honor-of-kings-api

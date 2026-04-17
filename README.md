# Honor of Kings Skin Trivia

A fun little trivia web app for guessing heroes and skins from splash art. Test your knowledge or just enjoy the artwork. Play the game here: https://hoktrivia.netlify.app/

## Visuals: Game/Gallery Mode
### Trivia Mode Home Page
<img width="1919" height="945" alt="image" src="https://github.com/user-attachments/assets/3487045f-3262-4fee-952b-46c3264a19ec" />

### Trivia Mode Game Page
<img width="1903" height="935" alt="image" src="https://github.com/user-attachments/assets/8a973b17-1804-4044-80a5-d55b0b05a06e" />

### Gallery Mode
<img width="1903" height="937" alt="image" src="https://github.com/user-attachments/assets/2dfa3db3-1fed-4472-be70-0d57afcffe86" />


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

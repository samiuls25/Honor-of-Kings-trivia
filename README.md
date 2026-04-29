# Honor of Kings Skin Trivia

A fun little trivia web app for guessing heroes and skins from splash art, or guessing OST track titles from audio! Test your knowledge or just enjoy the artwork and OSTs. Share your score with friends or share specific gallery artwork and OSTs you like. Play the game here: https://hoktrivia.netlify.app/


## Release Highlights

- **V1.5.X**: Added Hero Gallery. Added Hero Relationship mode. Players get directional relationship clues with hero portrait + name context, then guess the related hero (typed or portrait-enabled multiple choice). Added dedicated relationship ingestion pipeline sourced from the official relationship data feed.
- **V1.4.X**: Added Hero Identity mode. Players see identity profile clues and guess the hero (typed or multiple choice with portrait options). Added dedicated hero identity ingestion pipeline from official hero detail API.
- **V1.3.X**: Introduced the all-new OST Hall with soundtrack browsing, scrubber seeking, and shareable track links. Optimized qing api data loading performance. OST Hall UX polish (scroll-to-player/selection clarity).
- **V1.2.X**: Introduced OST Trivia Mode (waveform and track card display options) and OST ingestion pipeline. Added source-isolated/selectable data pipelines (newly integrated and polished data from qing api, official capture, hybrid). Expanded Gallery Mode with clickable cards for full high definition picture view. Selectable skin sources/hybrid mode and OST visualizer polish. Expanded sharing with challenge and gallery deep links plus social-preview metadata support.
- **V1.1.X**: Added Skin Gallery mode for standalone artwork browsing outside active trivia rounds.
- **V1.0.X**: Initial launch with hero/skin trivia core loop, timer-based runs, official capture ingestion pipeline, and score tracking.

## Live Community Stats

| Category | Live Counters |
| --- | --- |
| Traffic | [![Site Views](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dsite_views)](https://hoktrivia.netlify.app/metrics/summary) [![Unique Visitors](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dunique_site_visitors)](https://hoktrivia.netlify.app/metrics/summary) |
| Sharing | [![Share Links Generated](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dshare_links_generated)](https://hoktrivia.netlify.app/metrics/summary) [![Share Links Visited](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dshare_links_visited)](https://hoktrivia.netlify.app/metrics/summary) |
| Gameplay | [![Normal Games Played](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dgames_played_standard)](https://hoktrivia.netlify.app/metrics/summary) [![OST Games Played](https://img.shields.io/endpoint?url=https%3A%2F%2Fhoktrivia.netlify.app%2Fmetrics%2Fbadge%3Fmetric%3Dgames_played_ost)](https://hoktrivia.netlify.app/metrics/summary) |

These counters update from live app events.
README badge refresh can lag for several minutes because of GitHub image proxy and badge caching, even when the site has already updated.
For immediate values, open: https://hoktrivia.netlify.app/metrics/summary


## Visuals: Game/Gallery/OST Hall

### Trivia Mode Home Page
<!-- <img width="1902" height="941" alt="image" src="https://github.com/user-attachments/assets/dfd52c9f-8bca-4d23-9bc4-21039b64bf74" /> -->
<img width="1899" height="939" alt="image" src="https://github.com/user-attachments/assets/58942ef3-1d57-4b53-a6d6-724f935937ae" />


### Trivia Mode Game Page
<img width="1900" height="936" alt="image" src="https://github.com/user-attachments/assets/d112cb2a-6d27-4f64-be04-2f82f954db93" />


### Audio Trivia Mode Game Page
#### Sound Waves
<img width="1901" height="940" alt="image" src="https://github.com/user-attachments/assets/8dd191e4-f0d5-4d65-8282-e34215b3b799" />

#### Track Artwork
<img width="1902" height="940" alt="image" src="https://github.com/user-attachments/assets/c17ca858-d347-4a8e-98d9-e7d9e3797b41" />

### Lore Challenge Trivia Mode Game Page
<img width="1914" height="933" alt="image" src="https://github.com/user-attachments/assets/3ceed0f8-e1da-4ded-a18a-d6c5abf8739d" />

### Relationship Challenge Trivia Mode Game Page
<img width="1899" height="936" alt="image" src="https://github.com/user-attachments/assets/87a325c9-4edc-4af4-b0e3-401fd1ccd0c5" />


### Gallery Mode
#### Skin Gallery
<img width="1900" height="936" alt="image" src="https://github.com/user-attachments/assets/9da04828-66d3-4d58-bbf4-a8374f555e35" />

#### Gallery Card
<img width="1902" height="938" alt="image" src="https://github.com/user-attachments/assets/d30f81c0-a18b-493a-bc5c-33aeec9f8a52" />

#### Hero Gallery
<img width="1894" height="933" alt="image" src="https://github.com/user-attachments/assets/6cbd25d5-ba31-4fdb-9ee4-02ded6712f98" />


### OST Hall
#### Main Audio Player
<img width="1901" height="940" alt="image" src="https://github.com/user-attachments/assets/56cb8e8b-2f80-468f-9825-47085e178920" />

#### OST Card Hall
<img width="1898" height="937" alt="image" src="https://github.com/user-attachments/assets/0ba21a6b-010c-4293-bce0-984b45fb4a4c" />


### Share Link Examples
#### Challenge Score 
<img width="622" height="199" alt="image" src="https://github.com/user-attachments/assets/5edbc49e-ccd9-4f01-96f4-cf1805cc0994" />

#### Gallery Card
<img width="646" height="415" alt="image" src="https://github.com/user-attachments/assets/f154f939-0aa2-41f9-98f8-be08a74b7575" />

#### OST Card
<img width="646" height="469" alt="image" src="https://github.com/user-attachments/assets/3e05a3a2-694e-441b-bee1-6068639d759f" />



## Current Features

- Question target modes:
  - Guess Hero Name
  - Guess Skin Name
  - Guess OST Track Title
  - Guess Hero by Identity
  - Guess Hero by Relationship
- Answer input modes:
  - Typed entry (case-insensitive, spacing-tolerant, and lightly typo-tolerant)
  - 4-option multiple choice
- Scoring styles:
  - 5 Minute Easy (+1 correct, no penalty)
  - 5 Minute Hard (+1 correct, -1 wrong)
  - Sudden Death (first wrong ends the run)
- Gallery mode:
  - Separate non-game hero gallery for browsing artwork
  - Separate non-game skin gallery for browsing artwork and sharing
  - Source selector (Official, qing translated, or Hybrid)
- OST Hall:
  - Dedicated soundtrack browsing view with artwork cards
  - Single lightweight player with Play/Pause and +/-5s controls
  - Audio scrubber for direct seek
  - Track share links with social preview support
- Sharing:
  - Results page includes Share Challenge with setup + score encoded in URL
  - Gallery lightbox includes Share Card for direct deep links
  - OST Hall includes Share Track for direct OST deep links
  - Dynamic social preview metadata is generated at /share via Netlify Function
  - Shared challenge links preload mode settings so friends can instantly retry
- OST mode:
  - Embedded audio/video player for track-based questions
  - Optional artwork reveal toggle while answering
- Progression:
  - Questions avoid repeats until the active dataset pool is fully completed
  - Completing the full pool ends the run with a special completion result that can be shared
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
- `netlify/functions/metrics-event.js`
- `netlify/functions/metrics-summary.js`
- `netlify/functions/metrics-badge.js`
- `netlify.toml`

Metrics persistence notes:

- Live counters are stored in Netlify Blobs via serverless functions.
- Counters begin at the time this tracking feature is deployed.
- `share_redirect_hits` includes share endpoint hits (often social crawlers), while `share_links_visited` tracks app-side shared-link landings.

## Data ingestion workflows

This project uses multiple source-isolated real-data ingestion pipelines.  
Use the `:all` commands for the normal end-to-end flow:

```bash
# Official skins capture -> src/data/skins.generated.ts
npm run ingest:all

# Secondary skins source (qing API, translated) -> src/data/skins.qing.generated.ts
npm run ingest:qing:all

# OST playlist fetch + normalization -> src/data/ost.generated.ts
npm run ingest:ost:all

# Hero identity profiles -> src/data/heroIdentity.generated.ts
npm run ingest:hero-identity:all

# Hero relationships -> src/data/heroRelationships.generated.ts
npm run ingest:hero-relationships:all
```

### Official skins capture workflow

For the official skins dataset (`ingest:all`), export a capture file from browser devtools on the official skin page:

1. Save as either:
  - data/raw/hok-skins-capture.har
  - data/raw/hok-skins-capture.json
2. Run full pipeline:

```bash
npm run ingest:all
```

You can also run steps individually:

```bash
npm run ingest:extract
npm run ingest:validate
npm run ingest:generate
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
- data/processed/hero-identity.normalized.json
- data/processed/hero-identity-meta.json
- src/data/heroIdentity.generated.ts
- data/processed/hero-relationships.normalized.json
- src/data/heroRelationships.generated.ts

At runtime, the app now keeps skin sources separated and lets you choose the active source in setup/gallery:
- Official Capture (recommended quality)
- qing API (translated to English)
- Hybrid backfill

The app keeps source separation intact:
- Existing website capture extractor remains primary and highest quality.
- qing API is translated and can be selected independently (or in hybrid mode).
- qing thumbnail crop parameters are stripped during ingest to improve image quality.
- OST, Hero Identity, and Hero Relationship datasets are independent and never overwrite skin capture files.

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

Skin dataset shape:

- id
- heroId
- heroName
- heroAliases[]
- skinName
- skinAliases[]
- imageUrl
- source

Hero identity dataset shape:

- id
- heroId
- heroName
- heroAliases[]
- identity
- energy
- height
- region
- imageUrl
- source

Hero relationship dataset shape:

- id
- heroId
- heroName
- heroImageUrl
- relatedHeroId
- relatedHeroName
- relatedHeroImageUrl
- relation
- relationDescription
- source

Special thanks to qing762 for his api that provided a fuller dataset than what I originally had. API Source: https://github.com/qing762/honor-of-kings-api

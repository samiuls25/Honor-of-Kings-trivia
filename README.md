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
- Answer input modes:
  - Typed entry (case-insensitive)
  - 4-option multiple choice
- Scoring styles:
  - 5 Minute Easy (+1 correct, no penalty)
  - 5 Minute Hard (+1 correct, -1 wrong)
  - Sudden Death (first wrong ends the run)
- Gallery mode:
  - Separate non-game skin gallery for browsing artwork
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

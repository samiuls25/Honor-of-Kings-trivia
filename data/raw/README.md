# Raw Capture Input

Place your exported Honor of Kings skin capture file here.

Supported input formats:
- `hok-skins-capture.har` (recommended)
- `hok-skins-capture.json`

Suggested flow:
1. Open the official skin page in browser.
2. Open DevTools Network tab and filter by `fetch`/`xhr`.
3. Reload page and scroll so hero/skin data loads.
4. Export network as HAR.
5. Save as `data/raw/hok-skins-capture.har`.

Notes:
- Large HAR files are expected. A file with tens of thousands of lines is normal.
- Keep previous captures if you want to compare extraction outputs over time.

## OST Source Input

To enable OST trivia mode, add a source JSON file:
- `data/raw/hok-ost-source.json`

Accepted shapes:
- Array of tracks (custom format)
- YouTube API style object with `items[]`
- Object with `tracks[]`

Minimum per track fields (directly or via YouTube fields):
- title or trackTitle
- imageUrl or thumbnail
- videoId or watch URL (used to build embed audio player URL)

# NC119 Dashboard

Static, React + TypeScript + Vite dashboard for North Carolina primary turnout and NC House District 119 (Jackson, Swain, Transylvania) metrics.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Recharts
- Local JSON source file used on first load: `src/data/nc_primary_2026_absentee_early_reference_20260303.json`

## Quick start

```bash
npm create vite@latest nc119-dashboard -- --template react-ts
cd nc119-dashboard
npm i
npm i -D tailwindcss postcss autoprefixer
npm i recharts
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## How to update data tonight

Use either workflow:

1. Edit the file directly: `src/data/nc_primary_2026_absentee_early_reference_20260303.json`
2. Save and reload dev server (`npm run dev`) or redeploy static build

Or runtime workflow (no redeploy required):

1. Open the dashboard and switch to the **Admin** tab
2. Use **Upload JSON** in `Election Night Update Mode`
3. Select a new JSON file matching either the advanced reference schema or normalized dashboard schema
4. Charts and tables update immediately

## What to update when polls close

Checklist for `nc_primary_2026_absentee_early_reference_20260303.json`:

1. `meta.publishedDate`
2. `meta.dataThroughDate`
3. `statewide.ballotsCastTotal` and `statewide.turnoutPctTotal`
4. `statewide.ballotsByMethod` counts
5. `party.ballotsCast[]` (`ballots`, `turnoutPctWithinParty`, `ballotSharePct`)
6. `nc119.countyRows[]` method counts and `total`
7. `electionNightExtension.electionNight.precinctsReportingPct`
8. `electionNightExtension.electionNight.topRaces[]` (if used)

## Data provenance

This dashboard is designed for campaign and reporting workflows and references NC State Board of Elections absentee/early reporting artifacts.

- Source label is stored in `meta.source`
- Source file reference is stored in `meta.sourceFile`
- Include any assumptions in `meta.notes`

## Deployment

### Netlify

1. Run `npm run build`
2. Drag and drop the generated `dist/` folder into Netlify Deploys

### Vercel (static)

1. Import repo or upload project
2. Build command: `npm run build`
3. Output directory: `dist`

### GitHub Pages (optional)

1. Run `npm run build`
2. Publish `dist/` via `gh-pages` branch or Actions workflow
3. If hosted in a subpath, set `base` in `vite.config.ts`

## Accessibility notes

- Semantic headings and section landmarks
- Keyboard-accessible nav, controls, and sortable table
- Contrast-safe text in light/dark modes
- Charts include ARIA labeling via chart wrappers

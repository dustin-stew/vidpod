# Vidpod

Video podcast production platform with dynamic ad insertion and A/B testing.

## Core Features

### Episode Designer
- Drag-and-drop timeline editor for assembling video/audio clips
- Waveform visualization with automatic quiet-spot detection for optimal ad placement
- Multi-clip playback with seamless clip boundary transitions
- Split content clips at any point to insert ads mid-stream
- Undo/redo support and keyboard shortcuts (spacebar play/pause, cmd+z)

### Asset Management
- Upload and manage content and ad assets (video/audio)
- Automatic MOV-to-MP4 transcoding for browser compatibility
- Organize ads into reusable **Ad Sets**
- Combine ad sets into **AB Test Groups** for variant testing

### AB Testing
- Insert AB test groups as stacked variant clips in the timeline
- Click variants to preview different ad creatives in the video flow
- Publish episodes to register AB test pairings for analytics
- Per-clip timestamp tracking for multiple test insertions per episode

### Analytics Dashboard
- View performance metrics for published AB test/episode combinations
- Variant comparison table: impressions, clicks, CTR, conversions, revenue
- Daily impressions sparkline charts
- Statistical significance indicators
- Automatic winner detection by CTR

### Multi-format Support
- Toggle between 16:9 and 9:16 aspect ratios
- Video and audio asset types
- Content and ad asset classifications

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite via Node.js built-in `node:sqlite`
- **State**: Zustand for player and marker stores
- **Waveform**: WaveSurfer.js v7
- **Styling**: Tailwind CSS
- **Media**: FFmpeg for transcoding

## Getting Started

Requires **Node.js 22+** (uses the built-in `node:sqlite` module).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

On first run, the database is automatically created and seeded with a demo episode, assets, and analytics data. To re-seed at any time: `npm run seed`.

> **npm 11 + Node 25**: if `npm install` fails with a lockfile error, use `npm install --no-package-lock` as a workaround.

## Project Structure

```
src/
  app/          pages and api routes
  components/   react components (episode, assets, analytics, timeline)
  lib/          database client, repositories, utilities
  store/        zustand state stores
  types/        shared typescript interfaces
```

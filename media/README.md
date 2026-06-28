# Arcadia Pitch And Demo Media

This workspace generates the Colosseum-facing Arcadia pitch package:

- `arcadia-pitch/output/arcadia-colosseum-pitch.pptx`
- `arcadia-pitch/output/arcadia-colosseum-pitch.pdf`
- `arcadia-video/output/arcadia-demo-90s.mp4`
- `arcadia-video/output/arcadia-marketing-30s.mp4`
- speaker notes, storyboard, captions, and voiceover script

Run from the repo root:

```bash
pnpm media:capture
pnpm media:deck
pnpm media:render
```

`media:capture` uses the live app if it is already running at `http://127.0.0.1:8080`; otherwise it starts Vite on that port for screenshots.


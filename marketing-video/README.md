# Arcadia Marketing Video

Professional marketing videos for Arcadia built with Remotion.

## Project Structure

```
src/
  ├── Root.tsx                 # Composition registry
  ├── constants.ts             # Brand colors, fonts, timings
  ├── compositions/
  │   ├── TwitterClip.tsx      # 30-second Twitter/X video
  │   └── HackathonClip.tsx    # 90-second hackathon submission
  └── scenes/
      ├── HookScene.tsx        # Opening: "Who earns the right..."
      ├── MechanicScene.tsx    # Core mechanic visualization
      ├── ProductScene.tsx     # Product showcase
      ├── CloseScene.tsx       # Tagline: "Performance earns capital"
      └── CTAScene.tsx         # Call-to-action
```

## Setup

### Install Dependencies

```bash
npm install
```

### Development Server

Preview and edit videos in real-time:

```bash
npm run dev
```

Visit http://localhost:3000 to access the Remotion Studio.

## Rendering

### Twitter Clip (30 seconds)

```bash
npm run render:twitter
```

Output: `out/arcadia-twitter.mp4`

### Hackathon Clip (90 seconds)

```bash
npm run render:hackathon
```

Output: `out/arcadia-hackathon.mp4`

### Render Both

```bash
npm run build
```

## Brand Colors

All colors sourced from `brand.md`:

- **Primary Dark:** `#050816`
- **Secondary Dark:** `#0B1120`
- **Signal Green:** `#00FFB2`
- **Text Primary:** `#F5F7FA`
- **Text Secondary:** `#B0B0B0`

## Fonts

- **Display/Headlines:** Outfit
- **UI/Body:** Poppins
- **Numbers/Code:** IBM Plex Mono

## Customization

### Update Brand Colors

Edit `src/constants.ts`:

```typescript
export const BRAND = {
  bgPrimary: "#050816",
  signalPrimary: "#00FFB2",
  // ... etc
};
```

### Adjust Timing

Each scene's duration is controlled in the composition:

```typescript
<Sequence from={0} durationInFrames={secondsToFrames(3)}>
  <HookScene />
</Sequence>
```

Convert seconds: `secondsToFrames(seconds)` → frames at 30fps

### Add Product Screenshots

Replace the placeholder in `ProductScene.tsx` with actual screenshots:

```tsx
<img
  src="path/to/screenshot.png"
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }}
/>
```

## System Requirements

- Node.js 18+
- 8GB RAM recommended
- Linux/macOS/Windows with browser support

## Resources

- [Remotion Docs](https://remotion.dev)
- [Remotion Skills](https://github.com/remotion-dev/skills)
- Brand guidelines: `brand.md`

## Video Specifications

### Twitter/X
- **Format:** 16:9 (1920x1080)
- **Duration:** 30 seconds
- **Codec:** H.264
- **Note:** Must work muted — all information conveyed through text overlays

### Hackathon
- **Format:** 16:9 (1920x1080)
- **Duration:** 90 seconds
- **Codec:** H.264
- **Note:** Supports audio narration if needed

## Next Steps

1. **Test locally:** `npm run dev`
2. **Refine messaging:** Edit scene components as needed
3. **Add screenshots:** Integrate actual product UI
4. **Render:** `npm run build` to export final MP4s
5. **Deploy:** Share MP4 links or upload to social platforms

---

Made with Remotion for Arcadia Protocol

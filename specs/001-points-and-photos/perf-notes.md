# Perf verification (T105)

**Date**: 2026-09-16

## Methodology

Measured with a scripted Playwright run (`chromium`, `Pixel 5` device
descriptor) against a **production build** (`pnpm build` +
`node .output/server/index.mjs`), with network conditions throttled via
CDP `Network.emulateNetworkConditions` to a "regular 4G" profile:

- Download: 4 Mbps
- Upload: 3 Mbps
- Latency (RTT): 170 ms

Backend was local Supabase (Docker, same machine) — this does not model
the network hop between the app server and Supabase Cloud in the real
deployment (self-hosted netcup VPS + Supabase Cloud, see
[research.md R14](./research.md)); only the client-side 4G leg is
simulated.

**Important caveat on SC-001**: the "15 players × 2 categories" input
was filled by the script (`fill()` + `blur()` per field), not typed by a
human. The measured time reflects network/render overhead only, **not**
realistic human data-entry time. The 2-minute budget is clearly meant to
include a real trainer's tapping/typing time, which this measurement
cannot verify — treat the number below as "system overhead floor", not
as proof the 2-minute target is met with real users.

**Dev vs. prod build matters a lot**: an initial pass against the Nuxt
**dev server** (`pnpm dev`, unminified/unbundled) measured SC-002 at
~6.7–6.8s — over its 5s budget — consistently across 3 runs. Rebuilding
and measuring against the production build resolved this (see below).
Always verify perf against a production build, not `pnpm dev`.

## Results (production build, 3 runs each, consistent within ~1.5s)

| Criterion | Flow | Budget | Measured | Verdict |
|---|---|---|---|---|
| SC-010 | "E-Mail eingeben" → team founded, trainer UI visible (incl. magic-link receipt) | ≤180s | ~5–7s | ✅ large margin |
| SC-001 | 15 players × 2 categories + 1 photo, saved | ≤120s | ~5.3s (system overhead only, see caveat above) | ⚠️ verified for system overhead only — real human entry time not measured |
| SC-002 | Returning player: login → rank position visible on dashboard | ≤5s | ~3.0s | ✅ margin ~2s |

Dev-server (`pnpm dev`) measurement, for reference/contrast:

| Criterion | Measured (dev) |
|---|---|
| SC-010 | ~30s |
| SC-001 | ~9.2s |
| SC-002 | ~6.7–6.8s (**over budget**) |

## Conclusion

SC-010 and SC-002 meet budget when served from a production build. SC-001's
measured system overhead is below budget, but the full success criterion is
unverified because realistic human data-entry time was excluded. No code
changes made as part of this verification. Two follow-ups worth tracking
separately (not part of this Polish pass):

1. SC-001 has not been verified with a real human's data-entry speed —
   only automation/network overhead is measured here.
2. Perf was measured against local Supabase, not Supabase Cloud — actual
   production latency (netcup VPS ↔ Supabase Cloud) is unverified.

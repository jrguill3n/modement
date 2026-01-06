# Time Based Mix – A Context-Aware Music Recommendation POC

This project explores a simple idea:

> Music taste changes by time of day. Recommendation engines should too.

## What this is
A proof of concept recommendation engine that:
- Adapts recommendations based on time of day
- Groups music into intent-based blocks (not one endless feed)
- Explains *why* each song was chosen
- Lets users bias toward new music, familiarity, or zero repeats

## Why this exists
Most music recommendation systems (including Spotify AI):
- Optimize for engagement, not context
- Are opaque ("because you listened to…")
- Don't let users steer the experience

This project experiments with a different approach:
**context + explainability + control.**

## How it works
- The day is split into time buckets (morning, midday, evening, late night)
- Each bucket has different listening intents
- Tracks are ranked based on:
  - Time-of-day fit
  - Familiarity vs novelty
  - Repeat avoidance
- Every recommendation includes a human-readable explanation

## Comparison mode
The app includes a toggle:
- **My Engine:** time-aware, explainable recommendations
- **Spotify AI (simulated):** generic, vibe-based picks without explanations

Same tracks. Different logic.

## Tech stack
- Next.js (App Router)
- Serverless API routes
- Vercel deployment
- Spotify deep links (OAuth integration pending)

## Status
- Live demo uses simulated listening history
- Spotify OAuth integration planned once new apps are available again

## Demo
👉 https://v0-time-based-mix.vercel.app/

---

This is a product thinking and recommendation design exercise,
not an attempt to replace Spotify.

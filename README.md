# MODEMENT

**MODE**MENT — music that adapts to your current mode and moment.

👉 Live demo:  
https://v0-modement.vercel.app/

---

## What is MODEMENT?

MODEMENT is a small experiment around a simple idea:

> Music taste isn't static. It changes with your state of mind and the moment you're in.

Instead of one endless recommendation feed, MODEMENT adapts music based on:
- your current listening mode (focus, reset, energy, discovery)
- time of day as context
- familiarity vs novelty
- repeat avoidance

Every song comes with a short explanation so the logic is visible, not hidden.

---

## Why build this?

Most music recommendation systems are great at finding "more of the same," but they tend to:
- ignore context (morning vs late night feels very different)
- hide their reasoning
- give users very little control

MODEMENT explores what happens when you design for context, explainability, and intent first.

---

## How it works (high level)

MODEMENT keeps things intentionally simple:

1. Identify the current moment (morning, midday, evening, late night)
2. Pick intent-based blocks that fit that moment
3. Rank tracks using energy, familiarity, novelty, and repeat logic
4. Group them into clear blocks instead of an infinite list
5. Generate a short, human-readable reason for each song

No black boxes. No mystery.

---

## What makes it different

- **Mode-aware**: music adapts to how you're likely listening right now
- **Explainable**: every pick tells you why it's there
- **Controllable**: one tap to bias toward new, familiar, or no repeats
- **Comparable**: includes a toggle to contrast MODEMENT with a typical "Spotify AI" style feed

Same music. Different logic.

---

## Data and limitations

- The live demo uses simulated listening history and mock track profiles
- Spotify deep links work
- Live Spotify OAuth is not enabled yet due to current platform limitations

These constraints are intentional for the demo, not conceptual.

---

## What could be possible with deeper Spotify access

If MODEMENT had access to Spotify's public APIs — and especially some of the deeper signals that were available in the past — the possibilities are wide open:

- Real listening behavior by time of day and day of week
- True skip, replay, and session-length signals per mode
- Smarter novelty and overexposure detection
- Explanations grounded in actual behavior
- Blocks that adapt based on what actually works over time

MODEMENT is designed so these signals could be layered in without changing the core experience.

---

## Try it

👉 https://v0-modement.vercel.app/

Tip: switch between **08:30** and **23:30** — that's where it really clicks.

---

Built as an exploration of context-aware recommendations, product design, and explainable personalization.

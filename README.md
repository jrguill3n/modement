# MODEMENT

**MODE**MENT — decide what to listen to right now.

👉 Live demo:  
https://v0-modement.vercel.app/

---

## What is MODEMENT?

MODEMENT is a small product experiment built around a simple idea:

> Music taste isn't static. It changes with your state of mind and the moment you're in.

Instead of an endless recommendation feed, MODEMENT helps you **decide what fits right now** by combining:
- time of day as context
- optional situational intent (working out, studying, dinner, chill)
- clear, intent-based choices
- visible explanations for every song

---

## Why build this?

Modern music recommendation systems are very good at predicting taste.

They're much worse at helping users decide:
- what fits a workout
- what works during focus
- what feels right for a reset
- when repetition becomes stale

MODEMENT explores what happens when recommendations act as **decision support**, not a black box.

---

## How it works (high level)

MODEMENT is intentionally simple and explainable:

1. Time of day sets a reasonable default
2. Situation (optional) refines intent
3. Music is grouped into clear choices, not an infinite feed
4. Tracks are selected with:
   - energy
   - familiarity
   - novelty
   - repetition avoidance
5. Every song includes a short explanation of why it fits

No hidden magic. No mystery.

---

## What makes it different

- **Decision-first UX** instead of passive scrolling
- **Context awareness** that's visible to the user
- **Explainable picks**, not "because you listened to…"
- **Control without complexity**

Same music. Different contract with the user.

---

## About the data

MODEMENT currently uses **simulated listening history and mock signals**.

This is intentional.

Access to Spotify's public APIs — and especially deeper listening signals — is now limited for general developers. Rather than block on that, MODEMENT focuses on the product idea itself:
- how context is captured
- how intent is expressed
- how recommendations are explained
- how repetition is handled

The system is designed so real listening data could be layered in later without changing the experience.

---

## Try it

👉 https://v0-modement.vercel.app/

Tip:
- Compare morning vs late night
- Try "working out" vs "chill"

It's not about discovering more music.  
It's about finding the **right music for the moment**.

---

Built as a first iteration exploring context-aware, explainable recommendations.

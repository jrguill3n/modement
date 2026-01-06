// app/api/mix/route.ts
import { type NextRequest, NextResponse } from "next/server"

type TimeBucket = "morning" | "midday" | "evening" | "late_night"
type Tweak = "more_new" | "more_familiar" | "no_repeats" | "none"
type EngineMode = "my_engine" | "spotify_ai"

type Track = {
  id: string
  name: string
  artist: string
  reason: string
  track_url: string
}

type Block = {
  id: string
  title: string
  subtitle: string
  why_now: string
  tracks: Track[]
}

type MixResponse = {
  generated_at: string
  local_time_display: string
  time_bucket: TimeBucket
  engine: EngineMode
  tweak: Tweak
  blocks: Block[]
}

function parseTimeOverride(time?: string | null): { hours: number; minutes: number } | null {
  if (!time) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim())
  if (!m) return null
  return { hours: Number(m[1]), minutes: Number(m[2]) }
}

function getTweak(req: NextRequest): Tweak {
  const raw = (req.nextUrl.searchParams.get("tweak") || "").trim()
  if (raw === "more_new" || raw === "more_familiar" || raw === "no_repeats") return raw
  return "none"
}

function getEngine(req: NextRequest): EngineMode {
  const raw = (req.nextUrl.searchParams.get("engine") || "").trim()
  if (raw === "spotify_ai") return "spotify_ai"
  return "my_engine"
}

function formatLocalTimeChicago(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

function getChicagoMinutesNow(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  return hh * 60 + mm
}

function getTimeBucketFromMinutes(mins: number): TimeBucket {
  const MORNING = 7 * 60 // 07:00
  const MIDDAY = 12 * 60 // 12:00
  const EVENING = 17 * 60 // 17:00
  const LATE = 22 * 60 // 22:00
  const TWO_AM = 2 * 60 // 02:00

  if (mins >= MORNING && mins < MIDDAY) return "morning"
  if (mins >= MIDDAY && mins < EVENING) return "midday"
  if (mins >= EVENING && mins < LATE) return "evening"
  if (mins >= LATE || mins < TWO_AM) return "late_night"

  // 02:00-07:00, treat as late night for now
  return "late_night"
}

function makeTrackUrl(id: string) {
  return `https://open.spotify.com/track/${id}`
}

function stableHash(s: string): number {
  // Deterministic 32-bit hash for stable ordering
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice()
  let x = seed >>> 0

  function rand() {
    // xorshift32
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return (x >>> 0) / 4294967296
  }

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function blockPlan(bucket: TimeBucket): Array<{ title: string; subtitle: string; intent: string }> {
  if (bucket === "morning") {
    return [
      { title: "Morning Momentum", subtitle: "Wake up, move, win", intent: "energy" },
      { title: "Warm Up and Go", subtitle: "Upbeat without chaos", intent: "ramp" },
      { title: "Deep Focus", subtitle: "Steady tempo, low distraction", intent: "focus" },
      { title: "New to the Rotation", subtitle: "Fresh picks that still fit", intent: "discovery" },
      { title: "Flashback Fuel", subtitle: "Old favorites, new morning", intent: "throwback" },
    ]
  }

  if (bucket === "midday") {
    return [
      { title: "Deep Focus", subtitle: "Steady tempo, low distraction", intent: "focus" },
      { title: "Lunch Reset", subtitle: "Mental break, good mood", intent: "reset" },
      { title: "Afternoon Push", subtitle: "Bring the energy back", intent: "energy" },
      { title: "New to the Rotation", subtitle: "Discovery, not randomness", intent: "discovery" },
      { title: "Feel Good Throwback", subtitle: "Reliable favorites at this hour", intent: "throwback" },
    ]
  }

  if (bucket === "evening") {
    return [
      { title: "Evening Unwind", subtitle: "Lower pressure, warm vibe", intent: "reset" },
      { title: "Golden Hour Focus", subtitle: "Light energy, smooth groove", intent: "focus" },
      { title: "Kitchen Playlist", subtitle: "Cook, talk, move around", intent: "ramp" },
      { title: "New Tonight", subtitle: "Fresh picks for the evening", intent: "discovery" },
      { title: "Back Pocket Classics", subtitle: "Familiar, no surprises", intent: "throwback" },
    ]
  }

  // late night
  return [
    { title: "Late Night Energy", subtitle: "More pulse, less chatter", intent: "energy" },
    { title: "After Hours", subtitle: "Smooth and confident", intent: "focus" },
    { title: "Dance Corner", subtitle: "Housey, bright, fun", intent: "ramp" },
    { title: "New in the Dark", subtitle: "Discovery for night mode", intent: "discovery" },
    { title: "Throwback Bangers", subtitle: "Songs that never miss", intent: "throwback" },
  ]
}

function blockWhyNow(params: { bucket: TimeBucket; tweak: Tweak; localTime: string; intent: string }) {
  const { bucket, tweak, localTime, intent } = params

  const tweakLine =
    tweak === "more_new"
      ? "Leaning fresher for this session."
      : tweak === "more_familiar"
        ? "Keeping it familiar and reliable."
        : tweak === "no_repeats"
          ? "Avoiding repeats across blocks."
          : "Balanced mix."

  const bucketLine =
    bucket === "morning"
      ? `It’s ${localTime}. Morning usually calls for momentum and a clean ramp up.`
      : bucket === "midday"
        ? `It’s ${localTime}. Midday is best for steady focus and quick mood resets.`
        : bucket === "evening"
          ? `It’s ${localTime}. Evening works better with warm energy and smoother transitions.`
          : `It’s ${localTime}. Late night favors stronger vibe shifts and bolder picks.`

  const intentHint =
    intent === "focus"
      ? "Built to keep you locked in."
      : intent === "reset"
        ? "Built to reset your head."
        : intent === "energy"
          ? "Built to give you a push."
          : intent === "ramp"
            ? "Built to lift the tempo smoothly."
            : intent === "throwback"
              ? "Built around familiar wins."
              : "Built to add something new without breaking the vibe."

  return `${bucketLine} ${intentHint} ${tweakLine}`
}

type MockTrack = {
  id: string
  name: string
  artist: string
  tags: string[]
  profile: {
    genre: string
    era: string
    vibes: string[]
    hook: string
    focus_noise: "low" | "medium" | "high"
  }
}

const MOCK_TRACKS: MockTrack[] = [
  {
    id: "0q6LuUqGLUiCPP1cbdwFs3",
    name: "On Melancholy Hill",
    artist: "Gorillaz",
    tags: ["focus", "throwback"],
    profile: {
      genre: "alt pop",
      era: "late 2000s",
      vibes: ["clean", "melodic", "bright"],
      hook: "clean melodic groove",
      focus_noise: "low",
    },
  },
  {
    id: "7w9bgPAmPTtrkt2v16QbA7",
    name: "Pumped Up Kicks",
    artist: "Foster The People",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["catchy", "nostalgic", "smooth"],
      hook: "whistled melody",
      focus_noise: "low",
    },
  },
  {
    id: "5rIYxhV0t5FrNZQQ3K8rXm",
    name: "Mountain Sound",
    artist: "Of Monsters and Men",
    tags: ["reset", "focus"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["bright", "organic", "warm"],
      hook: "anthemic stomp",
      focus_noise: "medium",
    },
  },
  {
    id: "4JiEyzf0Md7KEFFGWDDdCr",
    name: "Little Talks",
    artist: "Of Monsters and Men",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["bright", "anthemic", "hopeful"],
      hook: "call-and-response vocals",
      focus_noise: "medium",
    },
  },
  {
    id: "6GyFP1nfCDB8lbD2bG0Hq9",
    name: "Midnight City",
    artist: "M83",
    tags: ["energy", "ramp"],
    profile: {
      genre: "synth pop",
      era: "early 2010s",
      vibes: ["epic", "shimmering", "driving"],
      hook: "shimmering synths",
      focus_noise: "medium",
    },
  },
  {
    id: "3FtYbEfBWJfJ9RF8PC9P7Q",
    name: "Electric Feel",
    artist: "MGMT",
    tags: ["ramp", "throwback"],
    profile: {
      genre: "psychedelic pop",
      era: "late 2000s",
      vibes: ["groovy", "colorful", "playful"],
      hook: "funky bassline",
      focus_noise: "medium",
    },
  },
  {
    id: "6TW2wZMy0QEGDq1u52Z6fU",
    name: "Kids",
    artist: "MGMT",
    tags: ["energy", "throwback"],
    profile: {
      genre: "psychedelic pop",
      era: "late 2000s",
      vibes: ["euphoric", "nostalgic", "bright"],
      hook: "big synth outro",
      focus_noise: "high",
    },
  },
  {
    id: "0EkVCyQUSFv8uP4FKk6VL8",
    name: "Tongue Tied",
    artist: "Grouplove",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie rock",
      era: "early 2010s",
      vibes: ["chaotic", "fun", "raw"],
      hook: "shout-along chorus",
      focus_noise: "high",
    },
  },
  {
    id: "5GbVzc3dAtGvvTHURQVSVr",
    name: "Float On",
    artist: "Modest Mouse",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie rock",
      era: "mid 2000s",
      vibes: ["carefree", "optimistic", "loose"],
      hook: "bouncy guitar riff",
      focus_noise: "low",
    },
  },
  {
    id: "4MFf2GJoCazQ6q8JqVh1Xd",
    name: "Take a Walk",
    artist: "Passion Pit",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["bright", "layered", "urgent"],
      hook: "cascading synths",
      focus_noise: "medium",
    },
  },
  {
    id: "5fVZC9GiM4e8vu99W0Xf6J",
    name: "Sleepyhead",
    artist: "Passion Pit",
    tags: ["energy"],
    profile: {
      genre: "indie pop",
      era: "late 2000s",
      vibes: ["glitchy", "bouncy", "frenetic"],
      hook: "chopped vocal sample",
      focus_noise: "high",
    },
  },
  {
    id: "0GO8y8jQk1PkHzS31d699N",
    name: "Ho Hey",
    artist: "The Lumineers",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["warm", "simple", "organic"],
      hook: "stomp-clap rhythm",
      focus_noise: "low",
    },
  },
  {
    id: "3BG6cJZC4XwkLFixDZvJSH",
    name: "Ophelia",
    artist: "The Lumineers",
    tags: ["reset"],
    profile: {
      genre: "indie folk",
      era: "mid 2010s",
      vibes: ["anthemic", "organic", "uplifting"],
      hook: "stomping beat",
      focus_noise: "medium",
    },
  },
  {
    id: "38tXZcL1gZRfbqfOG0VMTH",
    name: "Safe and Sound",
    artist: "Capital Cities",
    tags: ["focus", "reset"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["smooth", "groovy", "steady"],
      hook: "trumpet hook",
      focus_noise: "low",
    },
  },
  {
    id: "2QjOHCTQ1Jl3zawyYOpxh6",
    name: "Sweater Weather",
    artist: "The Neighbourhood",
    tags: ["focus", "evening"],
    profile: {
      genre: "alt rock",
      era: "early 2010s",
      vibes: ["moody", "dreamy", "smooth"],
      hook: "reverb guitar line",
      focus_noise: "low",
    },
  },
  {
    id: "1YLJVmuzeM2YSUkCCaTNUB",
    name: "Dog Days Are Over",
    artist: "Florence + The Machine",
    tags: ["energy"],
    profile: {
      genre: "indie rock",
      era: "late 2000s",
      vibes: ["powerful", "triumphant", "raw"],
      hook: "explosive harp crescendo",
      focus_noise: "high",
    },
  },
  {
    id: "2yFiUJjxkC46SH3yKzKZjG",
    name: "Bloom",
    artist: "The Paper Kites",
    tags: ["focus", "reset"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["delicate", "gentle", "warm"],
      hook: "fingerpicked guitar",
      focus_noise: "low",
    },
  },
  {
    id: "6K4t31amVTZDgR3sKmwUJJ",
    name: "Riptide",
    artist: "Vance Joy",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie folk",
      era: "mid 2010s",
      vibes: ["bright", "quirky", "simple"],
      hook: "ukulele riff",
      focus_noise: "low",
    },
  },
  {
    id: "0vfC68kTXPVqBz8eXCVAKL",
    name: "Budapest",
    artist: "George Ezra",
    tags: ["reset"],
    profile: {
      genre: "indie folk",
      era: "mid 2010s",
      vibes: ["warm", "soulful", "easygoing"],
      hook: "deep baritone vocals",
      focus_noise: "low",
    },
  },
  {
    id: "6SPfRUhsLiRwljf86eFcR8",
    name: "Best Day Of My Life",
    artist: "American Authors",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["joyful", "anthemic", "upbeat"],
      hook: "hand-clap beat",
      focus_noise: "medium",
    },
  },
  {
    id: "5rV8B4mB7VvZcM0G6kQ5wX",
    name: "Stolen Dance",
    artist: "Milky Chance",
    tags: ["reset", "evening"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["laid-back", "groovy", "smooth"],
      hook: "guitar loop",
      focus_noise: "low",
    },
  },
  {
    id: "1rfofaqEpACxVEHIZBJe6W",
    name: "1901",
    artist: "Phoenix",
    tags: ["ramp", "throwback"],
    profile: {
      genre: "indie rock",
      era: "late 2000s",
      vibes: ["tight", "bright", "punchy"],
      hook: "crisp guitar riff",
      focus_noise: "medium",
    },
  },
  {
    id: "2EqlS6tkEnglzr7tkKAAYD",
    name: "Mr. Brightside",
    artist: "The Killers",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie rock",
      era: "mid 2000s",
      vibes: ["anthemic", "driving", "classic"],
      hook: "guitar surge",
      focus_noise: "medium",
    },
  },
  {
    id: "3AJwUDP919kvQ9QcozQPxg",
    name: "Somebody Told Me",
    artist: "The Killers",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie rock",
      era: "mid 2000s",
      vibes: ["driving", "punchy", "tight"],
      hook: "synth bassline",
      focus_noise: "medium",
    },
  },
  {
    id: "5Z01UMMf7V1o0MzF86s6WJ",
    name: "Some Nights",
    artist: "fun.",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["theatrical", "anthemic", "bold"],
      hook: "big choir chorus",
      focus_noise: "high",
    },
  },
]

function personalTrackReason(params: {
  track: MockTrack
  bucket: TimeBucket
  intent: string
  tweak: Tweak
  localTime: string
  usedHooks: Set<string>
}): string {
  const { track, intent, usedHooks } = params
  const { artist, profile } = track
  const { genre, era, vibes, hook, focus_noise } = profile

  const useHook = !usedHooks.has(hook)
  if (useHook) usedHooks.add(hook)

  if (intent === "focus") {
    if (focus_noise === "low") {
      if (useHook) {
        return `${artist} with ${hook}. Easy focus music that still feels alive.`
      }
      return `${artist}, ${genre} that keeps distractions low without going ambient.`
    }
    if (focus_noise === "medium") {
      return `${artist} has steady energy. Won't derail you, but keeps the mood up.`
    }
    return `${artist}, bold but steady. Works if you need texture while you lock in.`
  }

  if (intent === "reset") {
    const vibe = vibes[0] || "smooth"
    if (useHook) {
      return `${artist} and that ${hook}. A mental reset that doesn't kill momentum.`
    }
    return `${genre} with a ${vibe} feel. Clears your head without pulling you out.`
  }

  if (intent === "energy") {
    if (useHook) {
      return `${artist}, ${hook}. Lifts the energy without chaos.`
    }
    const vibe = vibes.find((v) => v === "driving" || v === "anthemic" || v === "bold") || vibes[0]
    return `${artist} brings ${vibe} energy. Quick push when the day drags.`
  }

  if (intent === "ramp") {
    if (useHook) {
      return `${artist} with ${hook}. Upbeat without jumping straight into peak mode.`
    }
    return `${artist}, ${genre}. Raises the tempo smoothly.`
  }

  if (intent === "throwback") {
    return `${artist}, ${era}. Familiar energy that keeps the mood up.`
  }

  if (intent === "discovery") {
    const vibe = vibes[1] || vibes[0]
    return `${genre} with a ${vibe} edge. New pick, but fits what you already play.`
  }

  return `${artist}, ${genre}. Fits how you listen in this mode.`
}

function spotifyAiSubtitle(bucket: TimeBucket) {
  if (bucket === "morning") return "Upbeat mix for your day"
  if (bucket === "midday") return "A blend for your routine"
  if (bucket === "evening") return "Chill picks you might like"
  return "Late night vibes"
}

function spotifyAiWhyNow(bucket: TimeBucket) {
  if (bucket === "morning") return "Picked based on your listening habits."
  if (bucket === "midday") return "A mix based on your recent activity."
  if (bucket === "evening") return "Selected for your typical evening listening."
  return "Recommended from your taste profile."
}

function scoreTrack(t: MockTrack, intent: string, tweak: Tweak): number {
  let score = 0

  if (t.tags.includes(intent)) score += 6
  if (intent === "discovery") score += 1 // looser match

  // Tweak bias
  if (tweak === "more_new") {
    score += t.tags.includes("throwback") ? -2 : 2
  } else if (tweak === "more_familiar") {
    score += t.tags.includes("throwback") ? 3 : 0
  }

  return score
}

function pickTracksForIntent(params: {
  intent: string
  tweak: Tweak
  engine: EngineMode
  seed: number
  seen: Set<string>
}): MockTrack[] {
  const { intent, tweak, seed, seen } = params

  const ordered = seededShuffle(MOCK_TRACKS, seed)
    .map((t) => ({ t, score: scoreTrack(t, intent, tweak) }))
    .sort((a, b) => b.score - a.score)

  const picked: MockTrack[] = []

  for (const item of ordered) {
    if (picked.length >= 5) break
    if (tweak === "no_repeats" && seen.has(item.t.id)) continue
    picked.push(item.t)
    seen.add(item.t.id)
  }

  if (picked.length < 5) {
    for (const t of ordered.map((x) => x.t)) {
      if (picked.length >= 5) break
      if (picked.some((p) => p.id === t.id)) continue
      picked.push(t)
    }
  }

  return picked
}

function buildBlocks(params: {
  bucket: TimeBucket
  tweak: Tweak
  engine: EngineMode
  localTime: string
  seed: number
}): Block[] {
  const { bucket, tweak, engine, localTime, seed } = params

  const plan = blockPlan(bucket)
  const seen = new Set<string>()

  return plan.map((p, idx) => {
    const intent = p.intent
    const blockSeed = seed + idx * 101

    const picked = pickTracksForIntent({
      intent,
      tweak,
      engine,
      seed: blockSeed,
      seen,
    })

    const usedHooks = new Set<string>()

    const tracks: Track[] = picked.map((t) => {
      const reason =
        engine === "spotify_ai"
          ? ""
          : personalTrackReason({
              track: t,
              bucket,
              intent,
              tweak,
              localTime,
              usedHooks,
            })

      return {
        id: t.id,
        name: t.name,
        artist: t.artist,
        reason,
        track_url: makeTrackUrl(t.id),
      }
    })

    if (engine === "spotify_ai") {
      return {
        id: `block-${idx}`,
        title:
          idx === 0
            ? "Made for You"
            : idx === 1
              ? "Daily Mix"
              : idx === 2
                ? "Vibes"
                : idx === 3
                  ? "Recommended"
                  : "More Like This",
        subtitle: spotifyAiSubtitle(bucket),
        why_now: spotifyAiWhyNow(bucket),
        tracks,
      }
    }

    return {
      id: `block-${idx}`,
      title: p.title,
      subtitle: p.subtitle,
      why_now: blockWhyNow({ bucket, tweak, localTime, intent }),
      tracks,
    }
  })
}

export async function GET(req: NextRequest) {
  const now = new Date()

  const tweak = getTweak(req)
  const engine = getEngine(req)

  const override = parseTimeOverride(req.nextUrl.searchParams.get("time"))

  const chicagoMinutes = override ? override.hours * 60 + override.minutes : getChicagoMinutesNow(now)
  const timeBucket = getTimeBucketFromMinutes(chicagoMinutes)

  const localTimeDisplay = override
    ? new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(2000, 0, 1, override.hours, override.minutes))
    : formatLocalTimeChicago(now)

  const seedKey = `${timeBucket}|${tweak}|${engine}|${override ? `${override.hours}:${override.minutes}` : "now"}`
  const seed = stableHash(seedKey)

  const blocks = buildBlocks({
    bucket: timeBucket,
    tweak,
    engine,
    localTime: localTimeDisplay,
    seed,
  })

  const body: MixResponse = {
    generated_at: now.toISOString(),
    local_time_display: localTimeDisplay,
    time_bucket: timeBucket,
    engine,
    tweak,
    blocks,
  }

  return NextResponse.json(body)
}

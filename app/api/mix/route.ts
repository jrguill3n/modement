// app/api/mix/route.ts
import { type NextRequest, NextResponse } from "next/server"

type TimeBucket = "morning" | "midday" | "evening" | "late_night"
type Tweak = "more_new" | "more_familiar" | "no_repeats" | "none"
type EngineMode = "my_engine" | "spotify_ai"
type Situation = "working_out" | "working" | "studying" | "dinner" | "party" | "chill" | "auto"

type Track = {
  id: string
  name: string
  artist: string
  reason: string
  reason_signal?: string
  track_url: string
  artwork_url: string | null // Added artwork_url field
}

type RecommendationBlock = {
  id: string
  title: string
  subtitle: string
  why_now: string
  tracks: {
    track_name: string
    artist: string
    track_url: string
    reason: string
  }[]
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
  situation_raw: string
  situation_normalized: string
  situation_used: Situation
  blocks: Block[]
}

function parseTimeOverride(time?: string | null): { hours: number; minutes: number } | null {
  if (!time) return null
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim())
  if (!m) return null
  return { hours: Number(m[1]), minutes: Number(m[2]) }
}

function normalizeSituation(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
}

function getSituation(req: NextRequest): { situation: Situation; raw: string; normalized: string } {
  const raw = req.nextUrl.searchParams.get("situation") || ""
  const normalized = normalizeSituation(raw)

  // Alias map for common variations
  const aliasMap: Record<string, Situation> = {
    // working_out aliases
    workout: "working_out",
    workingout: "working_out",
    working_out: "working_out",
    work_out: "working_out",
    gym: "working_out",
    exercise: "working_out",

    // working aliases
    work: "working",
    working: "working",
    office: "working",

    // studying aliases
    study: "studying",
    studying: "studying",
    focus: "studying",
    homework: "studying",

    // party
    party: "party",

    // dinner aliases
    dinner: "dinner",
    hangout: "dinner",
    hanging_out: "dinner",

    // chill aliases
    chill: "chill",
    late_night: "chill",

    // auto
    auto: "auto",
    "": "auto",
  }

  const resolved = aliasMap[normalized] || "auto"

  return {
    situation: resolved,
    raw,
    normalized,
  }
}

function getEngine(req: NextRequest): EngineMode {
  const raw = (req.nextUrl.searchParams.get("engine") || "").trim()
  if (raw === "spotify_ai") return "spotify_ai"
  return "my_engine"
}

function getTweak(req: NextRequest): Tweak {
  const raw = (req.nextUrl.searchParams.get("tweak") || "").trim()
  if (raw === "more_new") return "more_new"
  if (raw === "more_familiar") return "more_familiar"
  if (raw === "no_repeats") return "no_repeats"
  return "none"
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

type BlockIntent = {
  title: string
  subtitle: string
  intent: string
}

const SITUATION_PRESETS: Record<
  Exclude<Situation, "auto">,
  Array<{ title: string; subtitle: string; intent: string }>
> = {
  working_out: [
    { title: "Warm up", subtitle: "Ease into movement without rushing", intent: "ramp" },
    { title: "PR mode", subtitle: "Peak intensity for max effort", intent: "energy" },
    { title: "Keep moving", subtitle: "Steady tempo to maintain momentum", intent: "throwback" },
    { title: "Second wind", subtitle: "Fresh energy when you start to fade", intent: "discovery" },
    { title: "Cool down", subtitle: "Bring the intensity back down gradually", intent: "reset" },
  ],
  working: [
    { title: "Deep focus", subtitle: "Low distraction for sustained concentration", intent: "focus" },
    { title: "Low distraction", subtitle: "Steady, unobtrusive background energy", intent: "focus" },
    { title: "Steady tempo", subtitle: "Consistent rhythm to keep you grounded", intent: "ramp" },
    { title: "No lyrics bias", subtitle: "Instrumental or minimal vocals", intent: "focus" },
    { title: "Short reset", subtitle: "Brief mental break without losing flow", intent: "reset" },
  ],
  studying: [
    { title: "Deep focus", subtitle: "Low distraction for sustained concentration", intent: "focus" },
    { title: "Low distraction", subtitle: "Steady, unobtrusive background energy", intent: "focus" },
    { title: "Steady tempo", subtitle: "Consistent rhythm to keep you grounded", intent: "ramp" },
    { title: "No lyrics bias", subtitle: "Instrumental or minimal vocals", intent: "focus" },
    { title: "Short reset", subtitle: "Brief mental break without losing flow", intent: "reset" },
  ],
  dinner: [
    { title: "Dinner table", subtitle: "Conversational, warm background music", intent: "reset" },
    { title: "Background glow", subtitle: "Soft energy that fills the space", intent: "throwback" },
    { title: "Conversation friendly", subtitle: "Won't compete with voices", intent: "reset" },
    { title: "Soft classics", subtitle: "Familiar, comforting picks", intent: "throwback" },
    { title: "After dinner", subtitle: "Easy transition to relaxation", intent: "discovery" },
  ],
  party: [
    { title: "Kickoff", subtitle: "Set the tone with immediate energy", intent: "energy" },
    { title: "Hands up", subtitle: "Peak moments that move the room", intent: "energy" },
    { title: "Peak hour", subtitle: "Maximum intensity for the main event", intent: "ramp" },
    { title: "Afterparty", subtitle: "Keep the vibe going without peaking again", intent: "throwback" },
    { title: "Come down", subtitle: "Ease the energy back down", intent: "reset" },
  ],
  chill: [
    { title: "Slow lane", subtitle: "Low-key energy to help you settle", intent: "reset" },
    { title: "Late afternoon haze", subtitle: "Warm, drifting sounds", intent: "throwback" },
    { title: "Soft edges", subtitle: "Gentle textures, no hard hits", intent: "focus" },
    { title: "Window seat", subtitle: "Contemplative, introspective mood", intent: "discovery" },
    { title: "Quiet win", subtitle: "Calm satisfaction, no pressure", intent: "reset" },
  ],
}

function blockPlan(
  bucket: TimeBucket,
  situation: Situation,
): Array<{ title: string; subtitle: string; intent: string }> {
  // If situation is set (not "auto"), return ONLY situation-specific blocks
  if (situation !== "auto") {
    return SITUATION_PRESETS[situation] || []
  }

  // FALLBACK: Auto mode uses time-based blocks
  if (bucket === "morning") {
    return [
      { title: "If you want momentum", subtitle: "Start your day with energy", intent: "energy" },
      { title: "If you need a smooth start", subtitle: "Ease into your morning", intent: "ramp" },
      { title: "If you want deep focus", subtitle: "Lock in early", intent: "focus" },
      { title: "If you want something different", subtitle: "Fresh angle for morning", intent: "discovery" },
    ]
  } else if (bucket === "midday") {
    return [
      { title: "If you want deep focus", subtitle: "Steady tracks for midday work", intent: "focus" },
      { title: "If you need a mental reset", subtitle: "Clear your head", intent: "reset" },
      { title: "If you need a push", subtitle: "Lift your energy", intent: "energy" },
      { title: "If you want something different", subtitle: "Fresh picks for afternoon", intent: "discovery" },
    ]
  } else if (bucket === "evening") {
    return [
      { title: "If you want to unwind", subtitle: "Shift down from your day", intent: "reset" },
      { title: "If you want light focus", subtitle: "Evening concentration", intent: "focus" },
      { title: "If you want to move", subtitle: "Gentle evening energy", intent: "ramp" },
      { title: "If you want something different", subtitle: "Fresh sounds for evening", intent: "discovery" },
    ]
  } else {
    // late night
    return [
      { title: "If you want sustained energy", subtitle: "Stay awake and alert", intent: "energy" },
      { title: "If you want to stay sharp", subtitle: "Late-night focus", intent: "focus" },
      { title: "If you want something familiar", subtitle: "Known tracks for tired moments", intent: "throwback" },
      { title: "If you want to wind down", subtitle: "Ease into calmer energy", intent: "reset" },
    ]
  }
}

const ALLOWED_INTENTS: Record<Situation, Set<string>> = {
  auto: new Set(["focus", "energy", "ramp", "reset", "throwback", "discovery"]), // All intents allowed
  working_out: new Set(["ramp", "energy", "throwback", "discovery", "reset"]), // All intents allowed for workout
  working: new Set(["focus", "ramp", "reset"]), // No high energy, no discovery
  studying: new Set(["focus", "ramp", "reset"]), // No high energy, no discovery
  dinner: new Set(["reset", "throwback", "discovery"]), // Background vibes, no focus/high energy
  party: new Set(["energy", "ramp", "throwback", "discovery", "reset"]), // All intents allowed for party
  chill: new Set(["reset", "throwback", "focus", "discovery"]), // Calm activities, no high energy
}

function blockWhyNow(params: {
  bucket: TimeBucket
  situation: Situation
}): string {
  const { bucket, situation } = params

  // If situation is selected, mention situation + time bucket
  if (situation !== "auto") {
    const bucketNames: Record<TimeBucket, string> = {
      morning: "Morning",
      midday: "Midday",
      evening: "Evening",
      late_night: "Late night",
    }
    const situationContexts: Record<Exclude<Situation, "auto">, string> = {
      working_out: `${bucketNames[bucket]} + workout: energy that scales with your effort.`,
      working: `${bucketNames[bucket]} + work: keep energy up, distraction low.`,
      studying: `${bucketNames[bucket]} + study: keep energy up, distraction low.`,
      dinner: `${bucketNames[bucket]} + dinner: background warmth without competing with conversation.`,
      party: `${bucketNames[bucket]} + party: peak energy to move the room.`,
      chill: `${bucketNames[bucket]} + chill: ease into low-key, contemplative mood.`,
    }
    return situationContexts[situation]
  }

  // Otherwise, brief time bucket-based reasoning
  const bucketDescriptions: Record<TimeBucket, string> = {
    morning: "Morning: easing into the day with controlled energy.",
    midday: "Midday: maintaining focus and momentum.",
    evening: "Evening: transitioning to lower-pressure mode.",
    late_night: "Late night: staying alert or winding down on your terms.",
  }

  return bucketDescriptions[bucket]
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
    bpm: number
    energy: number // 0-100
    valence: number // 0-100 (mood positivity)
    decadeTag: string
    sonicTag: string
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
      bpm: 118,
      energy: 55,
      valence: 60,
      decadeTag: "2000s",
      sonicTag: "bright synths",
    },
  },
  {
    id: "7w87IxuO7BDcJ3YUqCyMTT",
    name: "Pumped Up Kicks",
    artist: "Foster The People",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["catchy", "nostalgic", "smooth"],
      hook: "whistled melody",
      focus_noise: "low",
      bpm: 128,
      energy: 62,
      valence: 58,
      decadeTag: "2010s",
      sonicTag: "whistled hook",
    },
  },
  {
    id: "60ZGteAEtPCnGE6zevgUcd",
    name: "Mountain Sound",
    artist: "Of Monsters and Men",
    tags: ["reset", "focus"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["bright", "organic", "warm"],
      hook: "anthemic stomp",
      focus_noise: "medium",
      bpm: 132,
      energy: 70,
      valence: 72,
      decadeTag: "2010s",
      sonicTag: "stomping drums",
    },
  },
  {
    id: "2ihCaVdNZmnHZWt0fvAM7B",
    name: "Little Talks",
    artist: "Of Monsters and Men",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["anthemic", "sing-along", "uplifting"],
      hook: "call-and-response vocals",
      focus_noise: "high",
      bpm: 108,
      energy: 78,
      valence: 65,
      decadeTag: "2010s",
      sonicTag: "brass accents",
    },
  },
  {
    id: "6K4t31amVTZDgR3sKmwUJJ",
    name: "Bloom",
    artist: "The Paper Kites",
    tags: ["focus", "reset"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["delicate", "gentle", "warm"],
      hook: "fingerpicked guitar",
      focus_noise: "low",
      bpm: 92,
      energy: 35,
      valence: 55,
      decadeTag: "2010s",
      sonicTag: "fingerpicked guitar",
    },
  },
  {
    id: "09019ss66clxe59SgrUD7j",
    name: "Budapest",
    artist: "George Ezra",
    tags: ["reset"],
    profile: {
      genre: "indie folk",
      era: "mid 2010s",
      vibes: ["warm", "soulful", "easygoing"],
      hook: "deep baritone vocals",
      focus_noise: "low",
      bpm: 128,
      energy: 58,
      valence: 68,
      decadeTag: "2010s",
      sonicTag: "warm guitar",
    },
  },
  {
    id: "5Hroj5K7vLpIG4FNCRIjbP",
    name: "Best Day Of My Life",
    artist: "American Authors",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["joyful", "anthemic", "upbeat"],
      hook: "hand-clap beat",
      focus_noise: "medium",
      bpm: 92,
      energy: 82,
      valence: 88,
      decadeTag: "2010s",
      sonicTag: "hand claps",
    },
  },
  {
    id: "6PwjJ58I4t7Mae9xfZ9l9v",
    name: "Somebody Told Me",
    artist: "The Killers",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie rock",
      era: "mid 2000s",
      vibes: ["driving", "punchy", "tight"],
      hook: "synth bassline",
      focus_noise: "medium",
      bpm: 140,
      energy: 85,
      valence: 60,
      decadeTag: "2000s",
      sonicTag: "synth bass",
    },
  },
  {
    id: "3AJwUDP919kvQ9QcozQPxg",
    name: "Mr. Brightside",
    artist: "The Killers",
    tags: ["energy", "throwback"],
    profile: {
      genre: "indie rock",
      era: "mid 2000s",
      vibes: ["anthemic", "driving", "classic"],
      hook: "guitar surge",
      focus_noise: "medium",
      bpm: 148,
      energy: 88,
      valence: 55,
      decadeTag: "2000s",
      sonicTag: "guitar surge",
    },
  },
  {
    id: "3FtYbEfBqAlGO46NUDQSAt",
    name: "Electric Feel",
    artist: "MGMT",
    tags: ["ramp", "throwback"],
    profile: {
      genre: "psychedelic pop",
      era: "late 2000s",
      vibes: ["groovy", "colorful", "playful"],
      hook: "funky bassline",
      focus_noise: "medium",
      bpm: 108,
      energy: 72,
      valence: 75,
      decadeTag: "2000s",
      sonicTag: "funky bass",
    },
  },
  {
    id: "1jJci4qxiYcOHhQR247rEU",
    name: "Kids",
    artist: "MGMT",
    tags: ["energy", "throwback"],
    profile: {
      genre: "psychedelic pop",
      era: "late 2000s",
      vibes: ["nostalgic", "synth-heavy", "anthemic"],
      hook: "synth lead melody",
      focus_noise: "medium",
      bpm: 124,
      energy: 80,
      valence: 68,
      decadeTag: "2010s",
      sonicTag: "synth lead",
    },
  },
  {
    id: "6Z8R6UsFuGXGtiIxiD8ISb",
    name: "Safe and Sound",
    artist: "Capital Cities",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["bright", "feel-good", "catchy"],
      hook: "horn stabs",
      focus_noise: "medium",
      bpm: 108,
      energy: 76,
      valence: 82,
      decadeTag: "2010s",
      sonicTag: "brass hits",
    },
  },
  {
    id: "1eyzqe2QqGZUmfcPZtrIyt",
    name: "Midnight City",
    artist: "M83",
    tags: ["energy", "ramp"],
    profile: {
      genre: "synth pop",
      era: "early 2010s",
      vibes: ["epic", "shimmering", "driving"],
      hook: "saxophone solo",
      focus_noise: "medium",
      bpm: 105,
      energy: 82,
      valence: 68,
      decadeTag: "2010s",
      sonicTag: "synth epic",
    },
  },
  {
    id: "0GO8y8jQk1PkHzS31d699N",
    name: "Tongue Tied",
    artist: "Grouplove",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie rock",
      era: "early 2010s",
      vibes: ["chaotic", "fun", "raw"],
      hook: "shout-along chorus",
      focus_noise: "high",
      bpm: 112,
      energy: 86,
      valence: 78,
      decadeTag: "2010s",
      sonicTag: "shouted vocals",
    },
  },
  {
    id: "01iyCAUm8EvOFqVWYJ3dVX",
    name: "Take a Walk",
    artist: "Passion Pit",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["bright", "layered", "urgent"],
      hook: "cascading synths",
      focus_noise: "medium",
      bpm: 128,
      energy: 80,
      valence: 58,
      decadeTag: "2010s",
      sonicTag: "layered synths",
    },
  },
  {
    id: "4prEPl61C8qZpeo3IkYSMl",
    name: "Sleepyhead",
    artist: "Passion Pit",
    tags: ["energy"],
    profile: {
      genre: "indie pop",
      era: "late 2000s",
      vibes: ["glitchy", "bouncy", "frenetic"],
      hook: "chopped vocal sample",
      focus_noise: "high",
      bpm: 130,
      energy: 84,
      valence: 65,
      decadeTag: "2000s",
      sonicTag: "vocal chop",
    },
  },
  {
    id: "0DwClY2t9YAWHBROMIgrXb",
    name: "Ho Hey",
    artist: "The Lumineers",
    tags: ["reset", "throwback"],
    profile: {
      genre: "indie folk",
      era: "early 2010s",
      vibes: ["warm", "simple", "organic"],
      hook: "stomp-clap rhythm",
      focus_noise: "low",
      bpm: 82,
      energy: 68,
      valence: 75,
      decadeTag: "2010s",
      sonicTag: "foot stomps",
    },
  },
  {
    id: "14AyWf6y7KlWWLfAjdKMKI",
    name: "Ophelia",
    artist: "The Lumineers",
    tags: ["reset"],
    profile: {
      genre: "indie folk",
      era: "mid 2010s",
      vibes: ["anthemic", "organic", "uplifting"],
      hook: "stomping beat",
      focus_noise: "medium",
      bpm: 96,
      energy: 70,
      valence: 68,
      decadeTag: "2010s",
      sonicTag: "stomping rhythm",
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
      bpm: 90,
      energy: 48,
      valence: 52,
      decadeTag: "2010s",
      sonicTag: "reverb guitar",
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
      bpm: 146,
      energy: 92,
      valence: 62,
      decadeTag: "2000s",
      sonicTag: "harp glissando",
    },
  },
  {
    id: "4dyx5SzxPPaD8xQIid5Wjj",
    name: "Young Folks",
    artist: "Peter Bjorn and John",
    tags: ["focus", "throwback"],
    profile: {
      genre: "indie pop",
      era: "mid 2000s",
      vibes: ["playful", "bright", "whistled"],
      hook: "iconic whistle riff",
      focus_noise: "low",
      bpm: 110,
      energy: 60,
      valence: 70,
      decadeTag: "2010s",
      sonicTag: "whistle melody",
    },
  },
  {
    id: "4kbj5MwxO1bq9wjT5g9HaA",
    name: "Shut Up and Dance",
    artist: "WALK THE MOON",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie pop",
      era: "mid 2010s",
      vibes: ["upbeat", "funky", "danceable"],
      hook: "driving bass groove",
      focus_noise: "high",
      bpm: 128,
      energy: 89,
      valence: 85,
      decadeTag: "2010s",
      sonicTag: "funky bass",
    },
  },
  {
    id: "3e0yTP5trHBBVvV32jwXqF",
    name: "Anna Sun",
    artist: "WALK THE MOON",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie rock",
      era: "early 2010s",
      vibes: ["raw", "explosive", "anthemic"],
      hook: "shouted vocals",
      focus_noise: "high",
      bpm: 116,
      energy: 87,
      valence: 72,
      decadeTag: "2010s",
      sonicTag: "raw vocals",
    },
  },
  {
    id: "1UqhkbzB1kuFwt2iy4h29Q",
    name: "Cough Syrup",
    artist: "Young the Giant",
    tags: ["reset", "focus"],
    profile: {
      genre: "indie rock",
      era: "early 2010s",
      vibes: ["building", "emotional", "anthemic"],
      hook: "soaring chorus",
      focus_noise: "medium",
      bpm: 128,
      energy: 74,
      valence: 55,
      decadeTag: "2010s",
      sonicTag: "building guitar",
    },
  },
]

function generateFeatureBasedReason(track: MockTrack, blockTitle: string): string {
  const { bpm, energy, valence, sonicTag } = track.profile

  // Build reason based on block type and track features
  const energyLevel = energy > 75 ? "high-energy" : energy > 55 ? "mid-tempo" : "low-key"
  const mood = valence > 70 ? "upbeat" : valence > 50 ? "mid valence" : "mellower mood"

  // Different reason templates based on block context
  if (blockTitle.includes("PR mode") || blockTitle.includes("Hands up") || blockTitle.includes("Peak")) {
    return `${bpm} bpm with ${sonicTag}. ${energyLevel.charAt(0).toUpperCase() + energyLevel.slice(1)} without going full EDM.`
  }

  if (blockTitle.includes("focus") || blockTitle.includes("Deep focus") || blockTitle.includes("Low distraction")) {
    const lyricNote = track.profile.focus_noise === "low" ? "Low lyric density" : "Steady presence"
    return `${lyricNote}, ${bpm} bpm. Study-safe.`
  }

  if (blockTitle.includes("Dinner") || blockTitle.includes("Background") || blockTitle.includes("Conversation")) {
    return `${sonicTag.charAt(0).toUpperCase() + sonicTag.slice(1)} + ${mood}. Dinner table friendly.`
  }

  if (blockTitle.includes("Warm up") || blockTitle.includes("Cool down") || blockTitle.includes("reset")) {
    return `${bpm} bpm, ${energyLevel}. ${mood.charAt(0).toUpperCase() + mood.slice(1)} to shift gears.`
  }

  // Default reason
  return `${bpm} bpm with ${sonicTag}. ${energyLevel.charAt(0).toUpperCase() + energyLevel.slice(1)}, ${mood}.`
}

// Note: SITUATION_BLOCKS is now effectively replaced by SITUATION_PRESETS and blockPlan logic

function getReasonSignal(intent: string): string {
  const signalMap: Record<string, string> = {
    focus: "Low distraction",
    reset: "Mood reset",
    energy: "Energy fit",
    ramp: "Energy fit",
    throwback: "Familiar anchor",
    discovery: "Fresh angle",
  }
  return signalMap[intent] || "Fresh angle"
}

const SUBTITLE_VARIANTS: Record<string, string[]> = {
  focus: [
    "Steady, low-distraction tracks to help you stay locked in",
    "Predictable energy that stays out of the way",
    "Smooth groove with enough energy to stay present",
    "Steady tracks that keep you locked in without forcing it",
  ],
  reset: [
    "Light energy to clear your head without slowing down",
    "Light, familiar sounds to clear your head",
    "Lower pressure, warmer vibe to transition out of the day",
    "Shift your headspace without losing momentum",
  ],
  energy: [
    "More movement that lifts momentum without chaos",
    "Upbeat tracks to get you moving and thinking clearly",
    "Upbeat tracks that lift momentum without chaos",
    "More pulse, less chatter for late-night momentum",
  ],
  ramp: [
    "Lighter energy that builds without rushing",
    "More movement, still controlled",
    "Bright energy for dancing or staying up",
    "Building energy that doesn't rush you",
  ],
  discovery: [
    "A fresh angle that still fits your current MODEMENT",
    "Something fresh without feeling random",
    "A change in texture and mood that still fits right now",
    "Different mood, same wavelength",
  ],
  throwback: [
    "Comfort picks that feel right without thinking",
    "Reliable songs that feel right without thinking",
    "Classics you can count on, no surprises",
    "Throwback bangers that never miss",
  ],
}

const SUBTITLE_FALLBACK: Record<string, string> = {
  focus: "Steady, low-distraction tracks to help you stay locked in.",
  reset: "Light energy to clear your head without slowing down.",
  energy: "More movement that lifts momentum without chaos.",
  ramp: "Building energy that doesn't rush you.",
  discovery: "A fresh angle that still fits your current MODEMENT.",
  throwback: "Comfort picks that feel right without thinking.",
}

function pickSubtitleVariant(intent: string, usedSubtitles: Set<string>, seed: number): string {
  const variants = SUBTITLE_VARIANTS[intent] || [SUBTITLE_FALLBACK[intent] || "A MODEMENT option tuned for right now."]

  // Find unused variants
  const unused = variants.filter((v) => !usedSubtitles.has(v))

  if (unused.length > 0) {
    // Pick from unused variants using seed
    const seededRandom = (seed * 9301 + 49297) % 233280
    const idx = Math.floor((seededRandom / 233280) * unused.length)
    const chosen = unused[idx]
    usedSubtitles.add(chosen)
    return chosen
  }

  // All variants used, allow reuse as last resort
  const seededRandom = (seed * 9301 + 49297) % 233280
  const idx = Math.floor((seededRandom / 233280) * variants.length)
  return variants[idx]
}

type OEmbedCache = {
  name: string
  artist: string
  artwork_url: string | null
  embed_title: string
  cached_at: number
}

const oembedCache = new Map<string, OEmbedCache>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function canonicalizeTrack(
  trackUrl: string,
  fallbackName: string,
  fallbackArtist: string,
): Promise<{
  name: string
  artist: string
  artwork_url: string | null
  embed_title: string
}> {
  // Check cache first
  const cached = oembedCache.get(trackUrl)
  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
    return {
      name: cached.name,
      artist: cached.artist,
      artwork_url: cached.artwork_url,
      embed_title: cached.embed_title,
    }
  }

  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    })

    if (!response.ok) {
      throw new Error(`oEmbed fetch failed: ${response.status}`)
    }

    const data = await response.json()

    // Parse the title to extract artist and track name
    // Format is typically: "Artist • Track Name" or "Track Name by Artist"
    let name = fallbackName
    let artist = fallbackArtist
    const title = data.title || ""

    if (title.includes(" • ")) {
      const parts = title.split(" • ")
      artist = parts[0].trim()
      name = parts[1]?.trim() || fallbackName
    } else if (title.toLowerCase().includes(" by ")) {
      const parts = title.split(/ by /i)
      name = parts[0].trim()
      artist = parts[1]?.trim() || fallbackArtist
    }

    const result = {
      name,
      artist,
      artwork_url: data.thumbnail_url || null,
      embed_title: title,
    }

    // Cache the result
    oembedCache.set(trackUrl, {
      ...result,
      cached_at: Date.now(),
    })

    return result
  } catch (error) {
    // On failure, cache the fallback to prevent retries
    const result = {
      name: fallbackName,
      artist: fallbackArtist,
      artwork_url: null,
      embed_title: `${fallbackArtist} - ${fallbackName}`,
    }

    oembedCache.set(trackUrl, {
      ...result,
      cached_at: Date.now(),
    })

    return result
  }
}

async function buildBlocksWithArtwork(params: {
  bucket: TimeBucket
  tweak: Tweak
  engine: EngineMode
  localTime: string
  seed: number
  situation: Situation
}): Promise<Block[]> {
  const { bucket, tweak, engine, localTime, seed, situation } = params

  const plan = blockPlan(bucket, situation)

  const seen = new Set<string>()
  const globalSeen = new Set<string>()

  // Build blocks synchronously first
  const blocks = plan.map((p, idx) => {
    const intent = p.intent
    const blockSeed = seed + idx * 101

    const picked = pickTracksForIntent({
      intent,
      tweak,
      engine,
      seed: blockSeed,
      seen,
      situation,
      blockIndex: idx,
      globalSeen,
    })

    return {
      blockPlan: p,
      intent,
      picked,
      idx,
    }
  })

  const allTrackUrls = new Set<string>()
  blocks.forEach((b) => {
    b.picked.forEach((t) => {
      allTrackUrls.add(makeTrackUrl(t.id))
    })
  })

  // Fetch all unique track URLs in batches of 5 to avoid hammering oEmbed
  const trackUrlArray = Array.from(allTrackUrls)
  const batchSize = 5
  for (let i = 0; i < trackUrlArray.length; i += batchSize) {
    const batch = trackUrlArray.slice(i, i + batchSize)
    await Promise.all(
      batch.map((url) => {
        const track = MOCK_TRACKS.find((t) => makeTrackUrl(t.id) === url)
        if (track) {
          return canonicalizeTrack(url, track.name, track.artist)
        }
        return Promise.resolve()
      }),
    )
  }

  // Now build final blocks with canonicalized data
  return blocks.map((b) => {
    const tracks: Track[] = b.picked.map((t) => {
      const trackUrl = makeTrackUrl(t.id)
      const canonical = oembedCache.get(trackUrl)

      const reason = engine === "spotify_ai" ? "" : generateFeatureBasedReason(t, b.blockPlan.title)
      const reason_signal = engine === "spotify_ai" ? undefined : getReasonSignal(b.intent)

      return {
        id: t.id,
        name: canonical?.name || t.name,
        artist: canonical?.artist || t.artist,
        reason,
        reason_signal,
        track_url: trackUrl,
        artwork_url: canonical?.artwork_url || null,
      }
    })

    if (engine === "spotify_ai") {
      return {
        id: `block-${b.idx}`,
        title:
          b.idx === 0
            ? "Made for You"
            : b.idx === 1
              ? "Daily Mix"
              : b.idx === 2
                ? "Vibes"
                : b.idx === 3
                  ? "Recommended"
                  : "More Like This",
        subtitle: b.blockPlan.subtitle || spotifyAiSubtitle(bucket),
        why_now: spotifyAiWhyNow(bucket),
        tracks,
      }
    }

    return {
      id: `block-${b.idx}`,
      title: b.blockPlan.title,
      subtitle: b.blockPlan.subtitle,
      why_now: blockWhyNow({ bucket, situation }),
      tracks,
    }
  })
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

const SITUATION_BIAS: Record<Situation, Partial<Record<string, number>>> = {
  auto: {},
  working_out: { energy: 3, ramp: 2, reset: 1, throwback: 1 },
  working: { focus: 3, ramp: 1, reset: -2 },
  studying: { focus: 3, ramp: 1, reset: -2 },
  dinner: { reset: 3, throwback: 1, focus: -1 },
  party: { energy: 3, ramp: 2, throwback: 1, reset: -2 },
  chill: { reset: 3, focus: 1, throwback: 1, energy: -2 },
}

function scoreIntent(intent: string, situation: Situation): number {
  if (situation === "auto") return 0
  const bias = SITUATION_BIAS[situation]
  return bias[intent] || 0
}

function pickTracksForIntent(params: {
  intent: string
  tweak: Tweak
  engine: EngineMode
  seed: number
  seen: Set<string>
  situation: Situation
  blockIndex: number
  globalSeen: Set<string>
}): MockTrack[] {
  const { intent, tweak, seed, seen, situation, blockIndex, globalSeen } = params

  const ordered = seededShuffle(MOCK_TRACKS, seed)
    .map((t) => {
      let score = scoreTrack(t, intent, tweak)

      if (globalSeen.has(t.id)) {
        if (blockIndex < 3) {
          score -= 1000
        } else {
          score -= 5
        }
      }

      if (situation !== "auto") {
        const situationBias = SITUATION_BIAS[situation]
        for (const tag of t.tags) {
          const intentBoost = situationBias[tag] || 0
          if (intentBoost > 0) {
            score += intentBoost * 0.5
          }
        }

        // Fine-tune scores based on track features for specific situations
        if (situation === "studying") {
          if (t.profile.focus_noise === "low") score += 2
          if (t.profile.focus_noise === "high") score -= 2
          if (t.profile.valence < 40) score += 1 // Prefer less sad music for studying
          if (t.profile.bpm < 90) score += 1 // Prefer slower tempos for deep focus
        }

        if (situation === "working_out") {
          if (t.profile.energy < 70) score -= 1
          if (t.profile.bpm < 110) score -= 1
          if (t.profile.valence < 50) score -= 1
        }

        if (situation === "party") {
          if (t.profile.energy < 80) score -= 1
          if (t.profile.bpm < 120) score -= 1
          if (t.profile.valence < 60) score -= 1
        }

        if (situation === "dinner") {
          if (t.profile.energy > 60) score -= 1
          if (t.profile.bpm > 110) score -= 1
          if (t.profile.valence < 50) score -= 1
        }

        if (situation === "chill") {
          if (t.profile.energy > 60) score -= 1
          if (t.profile.bpm > 100) score -= 1
        }
      }

      return { t, score }
    })
    .sort((a, b) => b.score - a.score)

  const picked: MockTrack[] = []

  for (const item of ordered) {
    if (picked.length >= 5) break
    if (tweak === "no_repeats" && seen.has(item.t.id)) continue
    picked.push(item.t)
    seen.add(item.t.id)
    globalSeen.add(item.t.id)
  }

  // Fallback to ensure we always return 5 tracks if possible
  if (picked.length < 5) {
    for (const t of ordered.map((x) => x.t)) {
      if (picked.length >= 5) break
      if (picked.some((p) => p.id === t.id)) continue
      picked.push(t)
      globalSeen.add(t.id)
    }
  }

  return picked
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

export async function GET(req: NextRequest) {
  const now = new Date()

  const tweak = getTweak(req)
  const engine = getEngine(req)
  const situationResult = getSituation(req)
  const situation = situationResult.situation

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

  const seedKey = `${timeBucket}|${tweak}|${engine}|${situation}|${override ? `${override.hours}:${override.minutes}` : "now"}`
  const seed = stableHash(seedKey)

  const blocks = await buildBlocksWithArtwork({
    bucket: timeBucket,
    tweak,
    engine,
    localTime: localTimeDisplay,
    seed,
    situation,
  })

  const body: MixResponse = {
    generated_at: now.toISOString(),
    local_time_display: localTimeDisplay,
    time_bucket: timeBucket,
    engine,
    tweak,
    situation_raw: situationResult.raw,
    situation_normalized: situationResult.normalized,
    situation_used: situation,
    blocks,
  }

  return NextResponse.json(body)
}

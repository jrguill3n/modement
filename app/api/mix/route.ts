// app/api/mix/route.ts
import { type NextRequest, NextResponse } from "next/server"

type TimeBucket = "morning" | "midday" | "evening" | "late_night"
type Tweak = "more_new" | "more_familiar" | "no_repeats" | "none"
type EngineMode = "my_engine" | "spotify_ai"
type Situation =
  | "working"
  | "studying"
  | "working_out"
  | "walking"
  | "dinner"
  | "hanging_out"
  | "party"
  | "late_night"
  | "chill"
  | "auto"

type Track = {
  id: string
  name: string
  artist: string
  reason: string
  reason_signal?: string
  track_url: string
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

function getSituation(req: NextRequest): Situation {
  const raw = (req.nextUrl.searchParams.get("situation") || "").trim()
  const valid: Situation[] = [
    "working",
    "studying",
    "working_out",
    "walking",
    "dinner",
    "hanging_out",
    "party",
    "late_night",
    "chill",
  ]
  if (valid.includes(raw as Situation)) return raw as Situation
  return "auto"
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

type BlockIntent = {
  title: string
  subtitle: string
  intent: string
}

const SITUATION_BLOCKS: Record<Situation, BlockIntent[]> = {
  auto: [], // Will use time-based blocks
  working: [
    { title: "If you want deep focus", subtitle: "Predictable energy that stays out of the way", intent: "focus" },
    { title: "If you need a mental reset", subtitle: "Shift your state without losing momentum", intent: "reset" },
    { title: "If you want something familiar", subtitle: "Tracks you know that won't distract", intent: "throwback" },
    { title: "If you need a light push", subtitle: "Subtle lift without breaking concentration", intent: "ramp" },
  ],
  studying: [
    { title: "If you want deep focus", subtitle: "Steady tracks that keep you locked in", intent: "focus" },
    { title: "If you need a mental break", subtitle: "Clear your head without losing the groove", intent: "reset" },
    {
      title: "If you want something familiar",
      subtitle: "Known tracks that feel like background",
      intent: "throwback",
    },
    { title: "If you need gentle energy", subtitle: "Lift your attention without overloading", intent: "ramp" },
  ],
  working_out: [
    { title: "If you want high energy", subtitle: "Drive and intensity to push harder", intent: "energy" },
    { title: "If you want steady momentum", subtitle: "Consistent rhythm to keep you moving", intent: "ramp" },
    { title: "If you want familiar fuel", subtitle: "Songs you know that keep you going", intent: "throwback" },
    { title: "If you want to switch it up", subtitle: "New angles that still match your pace", intent: "discovery" },
  ],
  walking: [
    { title: "If you want easy flow", subtitle: "Relaxed pace that matches your steps", intent: "reset" },
    { title: "If you want gentle momentum", subtitle: "Light push without rushing you", intent: "ramp" },
    { title: "If you want something familiar", subtitle: "Comfort tracks for the background", intent: "throwback" },
    { title: "If you want something different", subtitle: "Fresh sounds that fit your walk", intent: "discovery" },
  ],
  dinner: [
    { title: "If you want easy vibes", subtitle: "Background energy that doesn't demand attention", intent: "reset" },
    { title: "If you want something familiar", subtitle: "Known favorites that set the mood", intent: "throwback" },
    { title: "If you want warm energy", subtitle: "Inviting sounds without being loud", intent: "ramp" },
    { title: "If you want subtle variety", subtitle: "New picks that still feel right", intent: "discovery" },
  ],
  hanging_out: [
    {
      title: "If you want relaxed energy",
      subtitle: "Loose vibes that don't compete with conversation",
      intent: "reset",
    },
    { title: "If you want something familiar", subtitle: "Shared favorites everyone knows", intent: "throwback" },
    {
      title: "If you want to lift the mood",
      subtitle: "Easy upbeat tracks without being aggressive",
      intent: "energy",
    },
    { title: "If you want something fresh", subtitle: "New sounds that fit the vibe", intent: "discovery" },
  ],
  party: [
    { title: "If you want to start strong", subtitle: "Immediate energy to set the tone", intent: "energy" },
    { title: "If you want peak moments", subtitle: "High-impact tracks that move the room", intent: "ramp" },
    { title: "If you want crowd-pleasers", subtitle: "Songs people recognize and respond to", intent: "throwback" },
    { title: "If you want to keep it going", subtitle: "Fresh energy that holds attention", intent: "discovery" },
  ],
  late_night: [
    { title: "If you want sustained energy", subtitle: "Drive without burning out", intent: "energy" },
    { title: "If you want to stay sharp", subtitle: "Focus energy for late hours", intent: "focus" },
    { title: "If you want familiar comfort", subtitle: "Known tracks for tired moments", intent: "throwback" },
    { title: "If you want to wind down", subtitle: "Ease into calmer energy", intent: "reset" },
  ],
  chill: [
    { title: "If you want to slow down", subtitle: "Low-key tracks that help you settle", intent: "reset" },
    { title: "If you want something familiar", subtitle: "Comfort picks you already love", intent: "throwback" },
    { title: "If you want gentle focus", subtitle: "Calm attention without pressure", intent: "focus" },
    { title: "If you want something different", subtitle: "New calm sounds to explore", intent: "discovery" },
  ],
}

function blockPlan(
  bucket: TimeBucket,
  situation: Situation,
): Array<{ title: string; subtitle: string; intent: string }> {
  if (situation !== "auto" && SITUATION_BLOCKS[situation]) {
    return SITUATION_BLOCKS[situation]
  }

  if (bucket === "morning") {
    return [
      {
        title: "If you want momentum",
        subtitle: "", // Will be populated dynamically
        intent: "energy",
      },
      {
        title: "If you need a smooth start",
        subtitle: "",
        intent: "ramp",
      },
      {
        title: "If you want deep focus",
        subtitle: "",
        intent: "focus",
      },
      {
        title: "If you want something different",
        subtitle: "",
        intent: "discovery",
      },
      {
        title: "If you want something familiar",
        subtitle: "",
        intent: "throwback",
      },
    ]
  }

  if (bucket === "midday") {
    return [
      {
        title: "If you want deep focus",
        subtitle: "",
        intent: "focus",
      },
      {
        title: "If you need a mental reset",
        subtitle: "",
        intent: "reset",
      },
      {
        title: "If you need a push",
        subtitle: "",
        intent: "energy",
      },
      {
        title: "If you want something different",
        subtitle: "",
        intent: "discovery",
      },
      {
        title: "If you want something familiar",
        subtitle: "",
        intent: "throwback",
      },
    ]
  }

  if (bucket === "evening") {
    return [
      {
        title: "If you want to unwind",
        subtitle: "",
        intent: "reset",
      },
      {
        title: "If you want light focus",
        subtitle: "",
        intent: "focus",
      },
      {
        title: "If you want to move",
        subtitle: "",
        intent: "ramp",
      },
      {
        title: "If you want something different",
        subtitle: "",
        intent: "discovery",
      },
      {
        title: "If you want something familiar",
        subtitle: "",
        intent: "throwback",
      },
    ]
  }

  // late night
  return [
    {
      title: "If you want energy",
      subtitle: "",
      intent: "energy",
    },
    {
      title: "If you want to stay sharp",
      subtitle: "",
      intent: "focus",
    },
    {
      title: "If you want to move",
      subtitle: "",
      intent: "ramp",
    },
    {
      title: "If you want something different",
      subtitle: "",
      intent: "discovery",
    },
    {
      title: "If you want something familiar",
      subtitle: "",
      intent: "throwback",
    },
  ]
}

function blockWhyNow(params: {
  bucket: TimeBucket
  tweak: Tweak
  localTime: string
  intent: string
  situation: Situation
}) {
  const { tweak, intent, situation } = params

  // If situation is selected, mention it once
  if (situation !== "auto") {
    const situationContexts: Record<Situation, string> = {
      auto: "",
      working: "Since you're working, this MODEMENT favors focus and familiarity.",
      commuting: "Since you're commuting, this MODEMENT balances energy and familiar hooks.",
      exercising: "Since you're exercising, this MODEMENT prioritizes high energy and momentum.",
      relaxing: "Since you're relaxing, this MODEMENT leans toward lighter, easier listening.",
      socializing: "Since you're socializing, this MODEMENT favors upbeat, crowd-friendly picks.",
      cooking: "Since you're cooking, this MODEMENT keeps energy steady without demanding attention.",
      studying: "Since you're studying, this MODEMENT prioritizes low distraction and consistent tempo.",
      cleaning: "Since you're cleaning, this MODEMENT keeps momentum going with familiar beats.",
      party: "Since it's party time, this MODEMENT pushes energy and bold choices.",
    }
    return situationContexts[situation]
  }

  // Otherwise, brief intent-based reasoning
  const intentDescriptions: Record<string, string> = {
    focus: "Built to keep you locked in without distraction.",
    reset: "Built to reset your head without slowing you down.",
    energy: "Built to give you a push when you need it.",
    ramp: "Built to lift the tempo smoothly.",
    throwback: "Built around reliable favorites.",
    discovery: "Built to shift texture while staying grounded.",
  }

  return intentDescriptions[intent] || "Built for your current MODEMENT."
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
    },
  },
  {
    id: "2EqlS6tkEnglzr7tkKAAYD",
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
    },
  },
  {
    id: "2Kerz9H9IejzeIpjhDJoYG",
    name: "Kids",
    artist: "MGMT",
    tags: ["energy", "throwback"],
    profile: {
      genre: "psychedelic pop",
      era: "late 2000s",
      vibes: ["nostalgic", "synth-heavy", "anthemic"],
      hook: "synth lead melody",
      focus_noise: "medium",
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
    },
  },
  {
    id: "2lwwrWVKdf3LR9lbbhnr6R",
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
    id: "6xyWmzLDVSJcYBWidQ38Fi",
    name: "Pumped Up Kicks",
    artist: "Foster The People",
    tags: ["focus", "throwback"],
    profile: {
      genre: "indie pop",
      era: "early 2010s",
      vibes: ["chill", "catchy", "smooth"],
      hook: "whistled melody",
      focus_noise: "low",
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
    },
  },
  {
    id: "1301WleyT98MSxVHPZCA6M",
    name: "Shut Up and Dance",
    artist: "WALK THE MOON",
    tags: ["energy", "ramp"],
    profile: {
      genre: "indie pop",
      era: "mid 2010s",
      vibes: ["upbeat", "funky", "danceable"],
      hook: "driving bass groove",
      focus_noise: "high",
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
    },
  },
]

type ReasonTemplate = (track: MockTrack, useHook: boolean) => string

const REASON_TEMPLATES: Record<string, ReasonTemplate[]> = {
  focus: [
    (t, useHook) =>
      useHook
        ? `${t.artist} with ${t.profile.hook}. Easy focus music that still feels alive.`
        : `${t.artist}, ${t.profile.genre} that keeps distractions low without going ambient.`,
    (t, useHook) =>
      useHook
        ? `${t.artist}'s ${t.profile.hook} keeps you anchored. Good for deep work.`
        : `${t.artist} stays out of the way but keeps the room from feeling empty.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} from ${t.artist}. Texture without distraction.`
        : `${t.artist}, clean ${t.profile.genre}. Sits in the background without pulling focus.`,
    (t, useHook) =>
      useHook
        ? `${t.artist} leans on ${t.profile.hook}. Familiar structure, low noise.`
        : `${t.artist} holds steady energy without demanding attention.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} keeps ${t.artist} grounded. Works when you need flow state.`
        : `${t.artist}, subtle ${t.profile.genre}. Present but never intrusive.`,
  ],
  reset: [
    (t, useHook) =>
      useHook
        ? `${t.artist} and that ${t.profile.hook}. A mental reset that doesn't kill momentum.`
        : `${t.profile.genre} with a ${t.profile.vibes[0] || "smooth"} feel. Clears your head without pulling you out.`,
    (t, useHook) =>
      useHook
        ? `${t.artist}'s ${t.profile.hook} gives you breathing room. Quick mental refresh.`
        : `${t.artist}, ${t.profile.vibes[0] || "mellow"} ${t.profile.genre}. Lets your mind wander briefly.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} from ${t.artist}. Shifts the mood without losing pace.`
        : `${t.artist} creates space to reset. You can step back without fully disengaging.`,
    (t, useHook) =>
      useHook
        ? `${t.artist} uses ${t.profile.hook} to ease tension. Small break, big impact.`
        : `${t.artist}, gentle ${t.profile.genre}. A moment to recalibrate.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} anchors ${t.artist}'s reset energy. Calms without slowing down.`
        : `${t.artist} offers a ${t.profile.vibes[0] || "smooth"} pause. Clears the mental queue.`,
  ],
  energy: [
    (t, useHook) =>
      useHook
        ? `${t.artist}, ${t.profile.hook}. Lifts the energy without chaos.`
        : `${t.artist} brings ${t.profile.vibes.find((v) => v === "driving" || v === "anthemic" || v === "bold") || t.profile.vibes[0]} energy. Quick push when the day drags.`,
    (t, useHook) =>
      useHook
        ? `${t.artist} leans into ${t.profile.hook}. Momentum boost, no overload.`
        : `${t.artist}, high-energy ${t.profile.genre}. Gets you moving without overwhelming.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} drives ${t.artist}'s power. Forward motion when you need it.`
        : `${t.artist} delivers ${t.profile.vibes[0]} force. Shakes off the midday slump.`,
    (t, useHook) =>
      useHook
        ? `${t.artist}'s ${t.profile.hook} injects urgency. Raises tempo, keeps control.`
        : `${t.artist}, punchy ${t.profile.genre}. Pulls you up without feeling forced.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} gives ${t.artist} its edge. Sharp energy, no strain.`
        : `${t.artist} amplifies the room. Bold but focused.`,
  ],
  ramp: [
    (t, useHook) =>
      useHook
        ? `${t.artist} with ${t.profile.hook}. Upbeat without jumping straight into peak mode.`
        : `${t.artist}, ${t.profile.genre}. Raises the tempo smoothly.`,
    (t, useHook) =>
      useHook
        ? `${t.artist} uses ${t.profile.hook} to build momentum. Gradual lift.`
        : `${t.artist}, steady climb. Gets you there without rushing.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} from ${t.artist}. Warm-up energy that scales naturally.`
        : `${t.artist}, rising ${t.profile.genre}. Sets the pace without forcing it.`,
    (t, useHook) =>
      useHook
        ? `${t.artist}'s ${t.profile.hook} eases you in. Not yet peak, but heading there.`
        : `${t.artist} bridges calm and active. Smooth transition mode.`,
    (t, useHook) =>
      useHook
        ? `${t.profile.hook} carries ${t.artist}'s ramp-up. Measured acceleration.`
        : `${t.artist}, gradual ${t.profile.genre}. Primes the energy curve.`,
  ],
  throwback: [
    (t) => `${t.artist}, ${t.profile.era}. Familiar energy that keeps the mood up.`,
    (t) => `${t.artist} from ${t.profile.era}. You know this one—still lands.`,
    (t) => `${t.profile.era} ${t.artist}. Proven track, reliable energy.`,
    (t) => `${t.artist}, classic ${t.profile.era}. Comfort without nostalgia drag.`,
    (t) => `${t.artist} from back then. ${t.profile.era} familiarity that still works now.`,
  ],
  discovery: [
    (t) =>
      `${t.profile.genre} with a ${t.profile.vibes[1] || t.profile.vibes[0]} edge. New pick, but fits what you already play.`,
    (t) => `${t.artist}, ${t.profile.vibes[0]} ${t.profile.genre}. Fresh find that aligns with your range.`,
    (t) => `${t.artist} offers ${t.profile.vibes[1] || t.profile.vibes[0]} ${t.profile.genre}. New to you, not a risk.`,
    (t) => `${t.artist}, ${t.profile.genre} adjacent to what you know. Safe exploration.`,
    (t) => `${t.artist}, ${t.profile.vibes[0]} sound. Expands the mix without disrupting it.`,
  ],
}

function personalTrackReason(params: {
  track: MockTrack
  bucket: TimeBucket
  intent: string
  tweak: Tweak
  localTime: string
  usedHooks: Set<string>
  usedTemplates: Set<number> // Track which templates are used in this block
}): string {
  const { track, intent, usedHooks, usedTemplates } = params
  const { profile } = track
  const { hook } = profile

  const useHook = !usedHooks.has(hook)
  if (useHook) usedHooks.add(hook)

  const templates = REASON_TEMPLATES[intent] || REASON_TEMPLATES.discovery

  let templateIndex = -1
  for (let i = 0; i < templates.length; i++) {
    if (!usedTemplates.has(i)) {
      templateIndex = i
      break
    }
  }

  if (templateIndex === -1) {
    templateIndex = usedTemplates.size % templates.length
  }

  usedTemplates.add(templateIndex)

  const template = templates[templateIndex]
  return template(track, useHook)
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

const SITUATION_BIAS: Record<Situation, Partial<Record<string, number>>> = {
  auto: {},
  working: { focus: 3, familiar: 1, energy: -1 },
  studying: { focus: 3, familiar: 1, reset: -2 },
  working_out: { energy: 3, ramp: 2, focus: -3 },
  walking: { reset: 2, ramp: 1, focus: -1 },
  dinner: { reset: 2, familiar: 1, energy: -1 },
  hanging_out: { reset: 2, energy: 1, focus: -2 },
  party: { energy: 3, ramp: 2, focus: -3 },
  late_night: { energy: 2, ramp: 1, throwback: 1 },
  chill: { reset: 3, focus: 1, energy: -2 },
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

        if ((situation === "working" || situation === "studying") && t.profile.focus_noise === "low") {
          score += 2
        }
        if ((situation === "working" || situation === "studying") && t.profile.focus_noise === "high") {
          score -= 2
        }

        if ((situation === "working_out" || situation === "party") && t.profile.focus_noise === "high") {
          score += 1
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

function generateRecommendationBlock(
  intent: string,
  bucket: TimeBucket,
  tweak: Tweak,
  localTime: string,
  situation: Situation,
  existingTracks: Set<string>,
): RecommendationBlock {
  const seen = new Set<string>(existingTracks)
  const topCandidates = MOCK_TRACKS.filter((t) => !seen.has(t.id)).sort(
    (a, b) => scoreTrack(b, intent, tweak) - scoreTrack(a, intent, tweak),
  )

  const usedHooks = new Set<string>()
  const usedTemplates = new Set<number>()

  const selectedTracks = topCandidates.slice(0, 5)
  const tracks = selectedTracks.map((t) => ({
    track_name: t.name,
    artist: t.artist,
    track_url: `https://open.spotify.com/track/${t.id}`,
    reason: "",
  }))

  return {
    id: `block-${selectedTracks[0].id}`,
    title: `Recommended ${intent.charAt(0).toUpperCase() + intent.slice(1)}`,
    subtitle: `Top picks for ${intent}`,
    why_now: `Based on your current ${intent} needs`,
    tracks,
  }
}

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

function buildBlocks(params: {
  bucket: TimeBucket
  tweak: Tweak
  engine: EngineMode
  localTime: string
  seed: number
  situation: Situation
}): Block[] {
  const { bucket, tweak, engine, localTime, seed, situation } = params

  const plan = blockPlan(bucket, situation)

  const seen = new Set<string>()
  const globalSeen = new Set<string>()
  const usedSubtitles = new Set<string>()

  return plan.map((p, idx) => {
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

    const usedHooks = new Set<string>()
    const usedTemplates = new Set<number>()

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
              usedTemplates,
            })

      const reason_signal = engine === "spotify_ai" ? undefined : getReasonSignal(intent)

      return {
        id: t.id,
        name: t.name,
        artist: t.artist,
        reason,
        reason_signal,
        track_url: makeTrackUrl(t.id),
      }
    })

    const subtitle = pickSubtitleVariant(intent, usedSubtitles, blockSeed)

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
        subtitle: subtitle || spotifyAiSubtitle(bucket),
        why_now: spotifyAiWhyNow(bucket),
        tracks,
      }
    }

    return {
      id: `block-${idx}`,
      title: p.title,
      subtitle: subtitle || SUBTITLE_FALLBACK[intent] || "A MODEMENT option tuned for right now.",
      why_now: blockWhyNow({ bucket, tweak, localTime, intent, situation }),
      tracks,
    }
  })
}

export async function GET(req: NextRequest) {
  const now = new Date()

  const tweak = getTweak(req)
  const engine = getEngine(req)
  const situation = getSituation(req)

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

  const blocks = buildBlocks({
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
    blocks,
  }

  return NextResponse.json(body)
}

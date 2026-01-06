"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, AlertCircle, Clock, Info } from "lucide-react"

interface Track {
  id: string
  name: string
  artist: string
  reason: string
  track_url: string
  album_artwork_url: string // Added album artwork URL
}

interface Block {
  id: string
  title: string
  subtitle: string
  why_now: string
  tracks: Track[]
}

interface MixData {
  generated_at: string
  local_time_display: string
  time_bucket: "morning" | "midday" | "evening" | "late_night"
  blocks: Block[]
}

const timeBucketColors = {
  morning: "bg-[#181818] text-[#B3B3B3]",
  midday: "bg-[#181818] text-[#B3B3B3]",
  evening: "bg-[#181818] text-[#B3B3B3]",
  late_night: "bg-[#181818] text-[#B3B3B3]",
}

const timeBucketLabels = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  late_night: "Late Night",
}

const modeLabels = {
  "": "Balanced",
  more_new: "More new",
  more_familiar: "More familiar",
  no_repeats: "No repeats",
}

const spotifyGenericVibes = ["Upbeat Mix", "Chill Indie", "Popular Picks", "Feel Good Songs", "Trending Now"]

const spotifyGenericWhy = "Picked based on your listening habits."

export default function TimeMixPage() {
  const [mixData, setMixData] = useState<MixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTweak, setActiveTweak] = useState<string>("")
  const [simulatedTime, setSimulatedTime] = useState<string>("")
  const [comparisonMode, setComparisonMode] = useState<"my_engine" | "spotify_ai">("my_engine")
  const [situation, setSituation] = useState<string>("auto")

  const fetchMix = async (tweak?: string, time?: string, engine?: string, situationParam?: string) => {
    setLoading(true)
    setError(null)
    setActiveTweak(tweak || "")

    try {
      const params = new URLSearchParams()
      if (tweak) params.set("tweak", tweak)
      if (time) params.set("time", time)
      if (engine) params.set("engine", engine)
      if (situationParam && situationParam !== "auto") params.set("situation", situationParam)

      const url = params.toString() ? `/api/mix?${params.toString()}` : "/api/mix"
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error("Failed to fetch mix")
      }

      const data = await response.json()
      setMixData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleTweakChange = (tweak: string) => {
    setActiveTweak(tweak)
    fetchMix(tweak, simulatedTime, comparisonMode, situation)
  }

  useEffect(() => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    setSimulatedTime(`${hours}:${minutes}`)
  }, [])

  useEffect(() => {
    fetchMix()
  }, [])

  const handleTimeChange = (time: string) => {
    setSimulatedTime(time)
    fetchMix(activeTweak || undefined, time, comparisonMode, situation)
  }

  const handleQuickTime = (time: string) => {
    setSimulatedTime(time)
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    if (timeInput) timeInput.value = time
    fetchMix(activeTweak, simulatedTime, comparisonMode, situation)
  }

  const handleEngineToggle = (engine: "my_engine" | "spotify_ai") => {
    setComparisonMode(engine)
    fetchMix(activeTweak, simulatedTime, engine, situation)
  }

  const handleSituationChange = (newSituation: string) => {
    setSituation(newSituation)
    fetchMix(activeTweak, simulatedTime, comparisonMode, newSituation)
  }

  const situations = [
    "auto",
    "working",
    "studying",
    "working out",
    "dinner",
    "hanging out",
    "party",
    "walking",
    "late night",
    "chill",
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0E10]">
        <header className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10] text-white h-14 md:h-16">
          <div className="container mx-auto px-4 h-full max-w-7xl">
            <div className="flex items-center justify-between h-full gap-4">
              {/* Left: App name */}
              <div className="flex items-center">
                <h1 className="text-base md:text-lg tracking-tight leading-none">
                  <span className="font-bold text-white">MODE</span>
                  <span className="font-normal text-white">MENT</span>
                </h1>
              </div>
              <div className="h-7 w-32 bg-[#181818] animate-pulse rounded-lg" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-8 max-w-7xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="px-1 space-y-2">
                <div className="h-6 w-48 bg-[#181818] rounded" />
                <div className="h-4 w-64 bg-[#181818] rounded" />
              </div>
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex-none w-[230px] h-40 bg-[#181818] rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0E0E10]">
        <header className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10] text-white h-14 md:h-16">
          <div className="container mx-auto px-4 h-full max-w-7xl">
            <div className="flex items-center h-full">
              <h1 className="text-base md:text-lg tracking-tight leading-none">
                <span className="font-bold text-white">MODE</span>
                <span className="font-normal text-white">MENT</span>
              </h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="flex items-start gap-4 p-4 border border-destructive/30 bg-destructive/5 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Failed to load mix</h3>
                <p className="text-sm text-[#B3B3B3] mt-1">{error}</p>
              </div>
              <Button
                onClick={() =>
                  fetchMix(activeTweak || undefined, simulatedTime || undefined, comparisonMode, situation)
                }
                variant="outline"
                size="sm"
                className="transition-all duration-150"
              >
                Retry
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!mixData) return null

  return (
    <div className="min-h-screen bg-[#0E0E10]">
      <header className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10] text-white h-14 md:h-16 transition-all duration-150">
        <div className="container mx-auto px-4 h-full max-w-7xl">
          <div className="flex items-center justify-between h-full gap-4">
            {/* Left: App name */}
            <div className="flex items-center flex-shrink-0">
              <h1 className="text-base md:text-lg tracking-tight leading-none relative">
                <span className="font-bold text-white relative">
                  MODE
                  <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[#1DB954]/25 rounded-full"></span>
                </span>
                <span className="font-normal text-white">MENT</span>
              </h1>
            </div>
            {/* Center: Local time + time bucket pill */}
            <div className="hidden md:flex items-center gap-3 text-sm">
              <span className="text-[#B3B3B3] text-xs">{mixData.local_time_display}</span>
              {simulatedTime && <span className="text-[#1DB954]/70 text-xs">(Testing: {simulatedTime})</span>}
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${timeBucketColors[mixData.time_bucket]}`}
              >
                {timeBucketLabels[mixData.time_bucket]}
              </span>
            </div>
            {/* Right: Engine toggle + active mode pill */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <div className="inline-flex items-center rounded-lg border border-[rgba(255,255,255,0.08)] p-0.5 bg-[#181818] shadow-sm">
                <Button
                  variant={comparisonMode === "my_engine" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleEngineToggle("my_engine")}
                  className="h-7 text-xs px-2 md:px-3 transition-all duration-150 hover:bg-[#1F1F1F]"
                >
                  My Engine
                </Button>
                <Button
                  variant={comparisonMode === "spotify_ai" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleEngineToggle("spotify_ai")}
                  className="h-7 text-xs px-2 md:px-3 transition-all duration-150 hover:bg-[#1F1F1F]"
                >
                  Spotify AI
                </Button>
              </div>
              <span className="hidden lg:inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[#181818] text-[#B3B3B3] shadow-sm transition-all duration-150">
                {modeLabels[activeTweak as keyof typeof modeLabels]}
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="md:hidden border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10]">
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 max-w-7xl">
          <span className="text-xs text-[#B3B3B3]">{mixData.local_time_display}</span>
          {simulatedTime && <span className="text-xs text-[#1DB954]/70">(Testing: {simulatedTime})</span>}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 ${timeBucketColors[mixData.time_bucket]}`}
          >
            {timeBucketLabels[mixData.time_bucket]}
          </span>
        </div>
      </div>
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10]">
        <div className="container mx-auto px-4 py-2.5 max-w-7xl">
          <div className="flex items-start gap-3 bg-[#181818] rounded-lg p-3">
            <Info className="h-4 w-4 text-[#7A7A7A] shrink-0 mt-0.5" />
            <p className="text-sm text-[#B3B3B3]">
              <strong className="font-medium text-white">Live Spotify connection coming soon.</strong> Demo currently
              uses simulated listening history.
            </p>
          </div>
        </div>
      </div>
      {/* Hero copy */}
      <div className="text-center space-y-3 mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold text-white">Decide what to listen to right now.</h1>
        <p className="text-base md:text-lg text-[#B3B3B3] max-w-2xl mx-auto">
          MODEMENT helps you choose music based on your current mode and moment — not just your history.
        </p>
        <p className="text-xs text-[#7A7A7A]">Clear options. Visible reasoning. You stay in control.</p>
      </div>

      <div className="mb-6 space-y-2">
        <p className="text-sm text-[#A0A0A0] text-center">What are you doing right now?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {situations.map((sit) => (
            <button
              key={sit}
              onClick={() => handleSituationChange(sit)}
              className={`px-4 py-2 rounded-full text-sm capitalize transition-all duration-200 ${
                situation === sit
                  ? "bg-[#1DB954] text-white shadow-md"
                  : "bg-[#282828] text-[#B3B3B3] hover:bg-[#3E3E3E] hover:text-white"
              }`}
            >
              {sit === "auto" ? "Auto" : sit}
            </button>
          ))}
        </div>
        {situation !== "auto" && (
          <p className="text-xs text-[#7A7A7A] text-center">Refining your MODEMENT for this activity</p>
        )}
      </div>

      {comparisonMode === "my_engine" && (
        <div className="text-center mb-6">
          <p className="text-sm text-[#7A7A7A]">Designed for how you listen in this MODEMENT.</p>
        </div>
      )}

      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10]">
        <div className="container mx-auto px-4 py-3 max-w-7xl">
          <div className="flex flex-col gap-3">
            {/* Test time controls */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#7A7A7A]" />
                <span className="text-sm font-medium text-white">Test time</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="time"
                  value={simulatedTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="h-9 px-3 py-2 text-sm rounded-md border border-[rgba(255,255,255,0.08)] bg-[#181818] text-white transition-all duration-150 focus:ring-2 focus:ring-[#1DB954]/20"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime("08:30")}
                    className="h-9 bg-[#181818] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#1F1F1F] transition-all duration-150"
                  >
                    08:30
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime("13:00")}
                    className="h-9 bg-[#181818] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#1F1F1F] transition-all duration-150"
                  >
                    13:00
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime("19:30")}
                    className="h-9 bg-[#181818] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#1F1F1F] transition-all duration-150"
                  >
                    19:30
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime("23:30")}
                    className="h-9 bg-[#181818] border-[rgba(255,255,255,0.08)] text-white hover:bg-[#1F1F1F] transition-all duration-150"
                  >
                    23:30
                  </Button>
                </div>
              </div>
            </div>
            {/* Mode controls */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Mode</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleTweakChange("")}
                  disabled={loading}
                  className={`transition-all duration-150 ${
                    activeTweak === ""
                      ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90"
                      : "bg-[#181818] text-[#B3B3B3] hover:bg-[#1F1F1F]"
                  }`}
                >
                  Balanced
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleTweakChange("more_new")}
                  disabled={loading}
                  className={`transition-all duration-150 ${
                    activeTweak === "more_new"
                      ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90"
                      : "bg-[#181818] text-[#B3B3B3] hover:bg-[#1F1F1F]"
                  }`}
                >
                  More new
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleTweakChange("more_familiar")}
                  disabled={loading}
                  className={`transition-all duration-150 ${
                    activeTweak === "more_familiar"
                      ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90"
                      : "bg-[#181818] text-[#B3B3B3] hover:bg-[#1F1F1F]"
                  }`}
                >
                  More familiar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleTweakChange("no_repeats")}
                  disabled={loading}
                  className={`transition-all duration-150 ${
                    activeTweak === "no_repeats"
                      ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90"
                      : "bg-[#181818] text-[#B3B3B3] hover:bg-[#1F1F1F]"
                  }`}
                >
                  No repeats
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-4 py-4 space-y-6 max-w-7xl">
        <Card className="border-[rgba(255,255,255,0.05)] bg-[#121212] rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-normal text-[#B3B3B3]">Why this MODEMENT</CardTitle>
            <p className="text-xs text-[#7A7A7A] mt-1">
              This mix adapts to your current mode, not just your overall taste.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm text-[#7A7A7A]">
              <li className="flex gap-2">
                <span className="text-[#7A7A7A] mt-0.5">•</span>
                <span>
                  <strong className="font-medium text-[#A0A0A0]">MODE awareness:</strong> MODEMENT adapts to how you
                  usually listen in different states of the day
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7A7A7A] mt-0.5">•</span>
                <span>
                  <strong className="font-medium text-[#A0A0A0]">Explainability:</strong> every track includes a reason,
                  so the logic is visible, not hidden
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#7A7A7A] mt-0.5">•</span>
                <span>
                  <strong className="font-medium text-[#A0A0A0]">Control:</strong> you can shift the MODE toward new,
                  familiar, or zero repeats at any time
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
        {mixData.blocks.map((block, index) => (
          <div key={block.id} className="space-y-3">
            <div className="px-1">
              <h2 className="text-xl font-medium text-white">
                {comparisonMode === "spotify_ai" ? spotifyGenericVibes[index] || block.title : block.title}
              </h2>
              {comparisonMode === "spotify_ai" ? (
                <p className="text-sm text-[#A0A0A0] mt-0.5">{spotifyGenericWhy}</p>
              ) : (
                <p className="text-sm text-[#A0A0A0] mt-0.5">{block.why_now}</p>
              )}
            </div>
            <div
              className={`relative -mx-4 px-4 sm:mx-0 sm:px-0 ${index === 0 ? "rounded-xl bg-gradient-to-r from-[#181818]/30 to-transparent p-3 -mx-4 sm:-mx-3 border-l-2 border-[#1DB954]/40" : ""}`}
            >
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin">
                {block.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex-none w-[230px] min-h-[180px] bg-[#181818] rounded-xl p-3.5 shadow-sm snap-start group hover:shadow-lg hover:-translate-y-1 hover:bg-[#1F1F1F] transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-[#2A2A2A] to-[#1A1A1A] flex items-center justify-center shadow-md">
                          <span className="text-lg font-bold text-[#B3B3B3]">{track.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="font-bold text-sm leading-tight line-clamp-2 text-white">{track.name}</h3>
                          <p className="text-xs text-[#B3B3B3] line-clamp-1">{track.artist}</p>
                        </div>
                      </div>
                      {comparisonMode === "my_engine" && (
                        <div className="pl-2.5 border-l-2 border-[#B3B3B3]/20 bg-gradient-to-r from-[#B3B3B3]/5 to-transparent min-h-[40px]">
                          <p className="text-[11px] text-[#7A7A7A] italic leading-relaxed line-clamp-2 py-1">
                            {track.reason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="text-xs h-7 px-3 text-[#1DB954] hover:text-[#1ED760] hover:bg-[#1DB954]/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200"
                      >
                        <a href={track.track_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1.5 h-3 w-3" />
                          Open in Spotify
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

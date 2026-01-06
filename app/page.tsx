"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ExternalLink, AlertCircle, Clock, Info, ChevronDown } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface Track {
  id: string
  name: string
  artist: string
  reason: string
  track_url: string
  album_artwork_url: string // Added album artwork URL
  reason_signal?: string // Added reason_signal
}

interface Block {
  id: string
  title: string
  subtitle: string
  why_now: string
  tracks: Track[]
}

interface MixResponse {
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
  balanced: "Balanced",
  more_new: "More new",
  more_familiar: "More familiar",
  no_repeats: "No repeats",
}

const spotifyGenericVibes = ["Upbeat Mix", "Chill Indie", "Popular Picks", "Feel Good Songs", "Trending Now"]

const spotifyGenericWhy = "Picked based on your listening habits."

const artworkCache = new Map<string, string>()

export default function Home() {
  const [view, setView] = useState<"decision" | "recommendations">("decision")
  const [situation, setSituation] = useState<string>("auto")
  const [mix, setMix] = useState<MixResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testTime, setTestTime] = useState<string>("")
  const [simulatedTime, setSimulatedTime] = useState<string>("")
  const [tweak, setTweak] = useState<string>("balanced")
  const [expandedBlock, setExpandedBlock] = useState<string | undefined>(undefined)
  const [loadedArtwork, setLoadedArtwork] = useState<Map<string, string>>(new Map())
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())

  const fetchMix = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append("tweak", tweak)
      params.append("time", simulatedTime)
      params.append("situation", situation)

      const response = await fetch(`/api/mix?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch mix")
      const data = await response.json()
      setMix(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const fetchAlbumArtwork = async (trackUrl: string): Promise<string | null> => {
    // Check cache first
    if (artworkCache.has(trackUrl)) {
      return artworkCache.get(trackUrl) || null
    }

    try {
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`)
      if (!response.ok) return null

      const data = await response.json()
      const thumbnailUrl = data.thumbnail_url || null

      // Cache the result
      if (thumbnailUrl) {
        artworkCache.set(trackUrl, thumbnailUrl)
      }

      return thumbnailUrl
    } catch (error) {
      console.error("[v0] Failed to fetch album artwork:", error)
      return null
    }
  }

  const handleSituationChange = (sit: string) => {
    setSituation(sit)
    fetchMix()
  }

  const handleTweakChange = (newTweak: string) => {
    setTweak(newTweak)
    fetchMix()
  }

  const handleTimeChange = (newTime: string) => {
    setSimulatedTime(newTime)
    fetchMix()
  }

  const handleQuickTime = (time: string) => {
    setSimulatedTime(time)
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
    if (timeInput) timeInput.value = time
    fetchMix()
  }

  const toggleReason = (trackId: string) => {
    setExpandedReasons((prev) => {
      const next = new Set(prev)
      if (next.has(trackId)) {
        next.delete(trackId)
      } else {
        next.add(trackId)
      }
      return next
    })
  }

  useEffect(() => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    setSimulatedTime(`${hours}:${minutes}`)
    fetchMix()
  }, [])

  useEffect(() => {
    if (!expandedBlock || !mix) return

    const block = mix.blocks.find((b) => b.id === expandedBlock)
    if (!block) return

    // Fetch artwork for all tracks in the expanded block
    block.tracks.forEach(async (track) => {
      if (!loadedArtwork.has(track.id)) {
        const artworkUrl = await fetchAlbumArtwork(track.track_url)
        if (artworkUrl) {
          setLoadedArtwork((prev) => new Map(prev).set(track.id, artworkUrl))
        }
      }
    })
  }, [expandedBlock, mix, loadedArtwork])

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

  if (view === "decision") {
    const now = new Date()
    const timeString = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    return (
      <div
        className="min-h-[100svh] bg-black text-white flex items-center justify-center px-6 py-12"
        style={{
          paddingTop: "max(3rem, env(safe-area-inset-top))",
          paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-full max-w-2xl space-y-12 text-center">
          {/* Greeting */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            Hi, <span className="font-bold">there</span>
          </h1>

          {/* Current time */}
          <p className="text-3xl md:text-4xl text-white/60 font-light">{timeString}</p>

          {/* Primary question */}
          <div className="space-y-8 pt-4">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">What are you doing right now?</h2>

            {/* Situation pills */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {situations.map((sit) => (
                <button
                  key={sit}
                  onClick={() => handleSituationChange(sit)}
                  className={`min-h-[52px] px-6 py-3 rounded-full text-lg capitalize transition-all duration-200 touch-manipulation ${
                    situation === sit
                      ? "bg-white text-black font-semibold shadow-lg"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white font-medium"
                  }`}
                >
                  {sit === "auto" ? "Auto" : sit}
                </button>
              ))}
            </div>
          </div>

          {/* Continue button */}
          <div className="pt-12">
            <Button
              onClick={() => setView("recommendations")}
              size="lg"
              className="min-h-[60px] bg-white text-black hover:bg-white/90 text-xl px-16 py-4 h-auto font-bold transition-all duration-200 shadow-xl touch-manipulation"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#0E0E10]">
        <header
          className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10] text-white h-14 md:h-16"
          style={{
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
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
      <div className="min-h-[100svh] bg-[#0E0E10]">
        <header
          className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.08)] bg-[#0E0E10] text-white h-14 md:h-16"
          style={{
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
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
                onClick={fetchMix}
                variant="outline"
                size="sm"
                className="transition-all duration-150 bg-transparent"
              >
                Retry
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!mix) return null

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-50 bg-[#0A0A0A] border-b border-white/5 safe-area-top"
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-14 md:h-16 gap-2 md:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <h1 className="text-base md:text-lg tracking-tight leading-none relative">
                <span className="font-bold text-white relative">
                  MODE
                  <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-[#1DB954]/25 rounded-full"></span>
                </span>
                <span className="font-normal text-white">MENT</span>
              </h1>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-white/60 flex-shrink-0">
              <span className="text-xs text-white/60">{mix.local_time_display}</span>
              {simulatedTime && <span className="text-xs text-[#1DB954]/70">(Testing: {simulatedTime})</span>}
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${timeBucketColors[mix.time_bucket]}`}
              >
                {timeBucketLabels[mix.time_bucket]}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="px-3 py-1.5 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 text-xs text-[#1DB954] font-medium whitespace-nowrap">
                {modeLabels[tweak]}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 pb-8 max-w-4xl text-center">
        <p className="text-base md:text-lg text-white/50 leading-relaxed">
          Designed for how you listen in this MODEMENT.
        </p>
      </div>

      <div className="container mx-auto px-6 pb-8 max-w-4xl">
        <div className="space-y-4">
          <p className="text-lg md:text-xl text-white/70 text-center font-medium">What are you doing right now?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {situations.map((sit) => (
              <button
                key={sit}
                onClick={() => handleSituationChange(sit)}
                className={`min-h-[52px] px-6 py-3 rounded-full text-base md:text-lg capitalize transition-all duration-200 font-medium touch-manipulation ${
                  situation === sit
                    ? "bg-[#1DB954] text-white shadow-lg"
                    : "bg-[#282828] text-white/70 hover:bg-[#3E3E3E] hover:text-white"
                }`}
              >
                {sit === "auto" ? "Auto" : sit}
              </button>
            ))}
          </div>
          {situation !== "auto" && (
            <p className="text-sm md:text-base text-white/50 text-center pt-2 leading-relaxed">
              Refining your MODEMENT for this activity
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 pb-6 max-w-4xl">
        <div className="flex items-start gap-4 p-6 bg-white/5 rounded-2xl">
          <Info className="h-5 w-5 text-white/50 shrink-0 mt-1" />
          <p className="text-base md:text-lg text-white/80 leading-relaxed">
            <strong className="font-semibold text-white">Live Spotify connection coming soon.</strong> Demo currently
            uses simulated listening history.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-8 max-w-4xl">
        <div className="space-y-6">
          {/* Test time controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-white/50" />
              <span className="text-lg font-semibold text-white">Test time</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="time"
                value={simulatedTime || ""}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="min-h-[52px] px-4 py-3 text-base rounded-xl bg-white/5 text-white transition-all duration-150 focus:ring-2 focus:ring-[#1DB954]/30 border-0"
                style={{ fontSize: "16px" }}
              />
              <div className="flex flex-wrap gap-2">
                {["08:30", "13:00", "19:30", "23:30"].map((time) => (
                  <Button
                    key={time}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTime(time)}
                    className="min-h-[52px] px-5 bg-white/5 text-white hover:bg-white/10 transition-all duration-150 border-0 text-base touch-manipulation"
                  >
                    {time}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          {/* Mode controls */}
          <div className="space-y-3">
            <span className="text-lg font-semibold text-white">Mode</span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleTweakChange("balanced")}
                disabled={loading}
                className={`min-h-[52px] px-6 text-base transition-all duration-150 touch-manipulation ${
                  tweak === "balanced"
                    ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90 font-semibold shadow-lg"
                    : "bg-white/5 text-white/70 hover:bg-white/10 font-medium"
                }`}
              >
                Balanced
              </Button>
              <Button
                size="sm"
                onClick={() => handleTweakChange("more_new")}
                disabled={loading}
                className={`min-h-[52px] px-6 text-base transition-all duration-150 touch-manipulation ${
                  tweak === "more_new"
                    ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90 font-semibold shadow-lg"
                    : "bg-white/5 text-white/70 hover:bg-white/10 font-medium"
                }`}
              >
                More new
              </Button>
              <Button
                size="sm"
                onClick={() => handleTweakChange("more_familiar")}
                disabled={loading}
                className={`min-h-[52px] px-6 text-base transition-all duration-150 touch-manipulation ${
                  tweak === "more_familiar"
                    ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90 font-semibold shadow-lg"
                    : "bg-white/5 text-white/70 hover:bg-white/10 font-medium"
                }`}
              >
                More familiar
              </Button>
              <Button
                size="sm"
                onClick={() => handleTweakChange("no_repeats")}
                disabled={loading}
                className={`min-h-[52px] px-6 text-base transition-all duration-150 touch-manipulation ${
                  tweak === "no_repeats"
                    ? "bg-[#1DB954] text-black hover:bg-[#1DB954]/90 font-semibold shadow-lg"
                    : "bg-white/5 text-white/70 hover:bg-white/10 font-medium"
                }`}
              >
                No repeats
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main
        className="min-h-screen bg-black px-4 py-8"
        style={{
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <Accordion type="single" collapsible className="space-y-4">
          {mix.blocks.map((block, index) => (
            <AccordionItem
              key={index}
              value={`block-${index}`}
              className={`border-b border-white/5 ${index === 0 ? "border-l-4 border-[#1DB954]/50 pl-4" : ""}`}
            >
              <AccordionTrigger
                className="hover:no-underline px-6 py-6 md:px-8 md:py-8"
                onClick={() => setExpandedBlock(block.id)}
              >
                <div className="flex flex-col items-start gap-3 text-left w-full pr-4">
                  <h2 className="text-xl md:text-2xl font-medium text-white leading-tight">{block.title}</h2>
                  <p className="text-base md:text-lg text-white/60 leading-relaxed">{block.why_now}</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 py-0">
                <div className="space-y-0 pb-4">
                  {block.tracks.map((track) => {
                    const artworkUrl = loadedArtwork.get(track.id)
                    const isReasonExpanded = expandedReasons.has(track.id)

                    return (
                      <div
                        key={track.id}
                        className="px-6 py-4 md:px-8 md:py-5 hover:bg-white/[0.02] transition-colors duration-150"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                            {artworkUrl ? (
                              <img
                                src={artworkUrl || "/placeholder.svg"}
                                alt={`${track.name} album artwork`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-bold text-white/70">
                                {track.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-base md:text-lg font-semibold text-white leading-snug">{track.name}</p>
                            <p className="text-sm md:text-base text-white/60 leading-relaxed">{track.artist}</p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {track.reason && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleReason(track.id)}
                                aria-expanded={isReasonExpanded}
                                aria-label={`${isReasonExpanded ? "Hide" : "Show"} reason for ${track.name}`}
                                className="min-h-[48px] px-3 text-white/50 hover:text-white hover:bg-white/5 transition-all touch-manipulation text-sm"
                              >
                                Why
                                <ChevronDown
                                  className={`ml-1 h-4 w-4 transition-transform duration-200 ${isReasonExpanded ? "rotate-180" : ""}`}
                                />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              className="min-h-[48px] min-w-[48px] p-0 text-[#1DB954] hover:text-[#1ED760] hover:bg-[#1DB954]/10 transition-all touch-manipulation"
                            >
                              <a href={track.track_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-5 w-5" />
                              </a>
                            </Button>
                          </div>
                        </div>

                        {track.reason && isReasonExpanded && (
                          <div className="mt-3 ml-[72px] animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="pl-4 border-l-2 border-[#1DB954]/30">
                              {track.reason_signal && (
                                <div className="mb-2">
                                  <span className="inline-block px-2 py-1 text-[10px] md:text-xs font-semibold tracking-wider uppercase bg-[#1DB954]/10 text-[#1DB954] rounded">
                                    {track.reason_signal}
                                  </span>
                                </div>
                              )}
                              <p className="text-xs md:text-sm text-white/50 leading-relaxed">{track.reason}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
    </div>
  )
}

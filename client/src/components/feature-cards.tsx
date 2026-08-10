import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const coreFeatures = [
  {
    title: "End-to-End Encryption",
    desc: "Seamless WebCrypto API integration encrypts your calls via ECDH and AES-GCM before they leave your device.",
    img: "/images/timeline-editing.jpg",
  },
  {
    title: "AI Live Captions",
    desc: "Never miss a word. Real-time, browser-native speech-to-text generating highly accurate subtitles seamlessly.",
    img: "/images/feature-ai-cohost.jpg",
  },
  {
    title: "Real-Time Whiteboards",
    desc: "Sketch ideas in real-time with an interactive HTML5 canvas fully synced across all peers via ultra-fast WebSockets.",
    img: "/images/feature-triple-recording.jpg",
  },
  {
    title: "Virtual Backgrounds",
    desc: "Locally executed MediaPipe selfie segmentation allows privacy blurs and custom image backgrounds instantly.",
    img: "/images/virtualbg.jpg",
    imgPos: "object-top",
  },
  {
    title: "Meeting Analytics",
    desc: "A premium dashboard to track your meeting hours, activity charts, and speaking time breakdowns.",
    img: "/images/meeting-analytics.jpg",
  },
  {
    title: "Floating Reactions",
    desc: "Keep the energy high without interrupting the speaker using fully animated real-time emoji reactions.",
    img: "/images/feature-emoji.jpg",
  },
]

const upcomingFeatures = [
  {
    title: "HQ P2P Recording",
    desc: "Record your 1:1 sessions locally in maximum quality without relying on cloud lossy compression.",
    img: "/images/recording-and-rtmp.jpg",
  },
  {
    title: "AI Auto-Highlights",
    desc: "Our transcription engine will automatically detect key moments and generate post-meeting summaries.",
    img: "/images/timeline-editing.jpg",
  },
  {
    title: "Spatial Audio Rooms",
    desc: "Immersive group calls where participant audio reflects their visual position on your screen.",
    img: "/images/feature-multitrack.jpg",
  },
]

function FeatureCard({ f }: { f: any }) {
  return (
    <Card className="rounded-[var(--radius-lg)] border border-border bg-card shadow-soft">
      <div className="border-b border-border">
        <img
          src={f.img || "/placeholder.svg?height=220&width=400&query=Feature image"}
          alt={f.title}
          className={cn("w-full h-[220px] object-cover rounded-t-[var(--radius-lg)]", f.imgPos)}
        />
      </div>
      <CardHeader className="p-5 pb-0">
        <CardTitle className="text-lg leading-tight">{f.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-0 -mt-2 text-foreground/80">{f.desc}</CardContent>
    </Card>
  )
}

export function FeatureCards({ className }: { className?: string }) {
  return (
    <section id="features" className={cn("mx-auto max-w-6xl px-6 py-8 md:py-12", className)}>
      <h2 className="text-2xl md:text-3xl font-bold mb-6">Core Features</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {coreFeatures.map((f) => (
          <FeatureCard key={f.title} f={f} />
        ))}
      </div>

      <div className="mt-16 pt-12 border-t border-border/50">
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-foreground/90">Upcoming Roadmap</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 opacity-80 hover:opacity-100 transition-opacity">
          {upcomingFeatures.map((f) => (
            <FeatureCard key={f.title} f={f} />
          ))}
        </div>
      </div>
    </section>
  )
}

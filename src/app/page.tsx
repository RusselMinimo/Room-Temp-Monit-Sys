import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Flame, LineChart, Lock, Sparkles, Waves, Wifi } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/ui/navigation";
import { getSession, isAdminEmail } from "@/lib/auth";

const heroHighlights = [
  { icon: Sparkles, label: "Realtime telemetry", detail: "1s polling + SSE" },
  { icon: Lock, label: "Secured sessions", detail: "HTTP-only cookies" },
  { icon: Wifi, label: "Wi-Fi ready", detail: "ESP32 • Pico W" },
];

const stats = [
  { value: "1s", label: "Refresh cadence" },
  { value: "60", label: "Samples per device" },
  { value: "8h", label: "Session lifetime" },
];

const featureCards = [
  {
    title: "Realtime dashboard",
    description: "Server components stream fresh readings without client state bloat.",
    icon: Activity,
  },
  {
    title: "Trend insights",
    description: "Micro charts highlight drift, spikes, and recovery inside the same card.",
    icon: LineChart,
  },
  {
    title: "Wi-Fi simplicity",
    description: "Point any Wi-Fi microcontroller at /api/ingest and watch it go live.",
    icon: Wifi,
  },
];

const comfortInsights = [
  { label: "Comfort band", value: "22–26°C", detail: "WHO indoor target" },
  { label: "Humidity sweet spot", value: "45–55% RH", detail: "Mold-safe range" },
  { label: "Delta vs outdoors", value: "-4.2°C cooler", detail: "Better insulation" },
];

const hourlyTemps = [23.4, 23.8, 24.1, 24.6, 24.9, 24.4, 24.0, 23.7];
const maxHourlyTemp = Math.max(...hourlyTemps);

// Force dynamic rendering to check session on every request
export const dynamic = "force-dynamic";

export default async function Home() {
  // #region agent log
  console.log('[DEBUG] Home component entry');
  // #endregion
  // Redirect authenticated users to their dashboard
  // #region agent log
  console.log('[DEBUG] Before getSession call');
  // #endregion
  const session = await getSession();
  // #region agent log
  console.log('[DEBUG] After getSession call', { 
    hasSession: !!session, 
    email: session?.email, 
    isPromise: session instanceof Promise,
    type: typeof session,
    sessionDetails: session ? { token: session.token?.substring(0, 8) + '...', expiresAt: session.expiresAt } : null
  });
  // #endregion
  if (session) {
    // #region agent log
    console.log('[DEBUG] Session exists, checking admin status', { email: session.email });
    // #endregion
    const isAdmin = isAdminEmail(session.email);
    // #region agent log
    console.log('[DEBUG] Redirecting authenticated user', { isAdmin, redirectTo: isAdmin ? '/admin-dashboard' : '/user-dashboard' });
    // #endregion
    redirect(isAdmin ? "/admin-dashboard" : "/user-dashboard");
  }
  // #region agent log
  console.log('[DEBUG] No session, rendering landing page');
  // #endregion

  return (
    <>
      <Navigation isAuthenticated={false} />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">

      <section className="landing-scene relative grid gap-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background via-background to-primary/10 p-8 shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
        <div className="landing-blob landing-blob--primary" />
        <div className="landing-blob landing-blob--secondary" />

        <div className="relative space-y-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Clean landing
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight">Focus on your sensors, we handle the visuals</h1>
            <p className="text-base text-muted-foreground">
              The dashboard stays pared down: instant readings, subtle gradients, and a single pane of glass for your Arduino or ESP32 nodes. Only the essential CTAs stay visible so onboarding is frictionless.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {heroHighlights.map((item, index) => (
              <div
                key={item.label}
                className="hero-chip"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <item.icon className="h-3.5 w-3.5 text-primary" />
                <span>{item.label}</span>
                <span className="text-border">•</span>
                <span className="text-foreground">{item.detail}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="floating-panel relative rounded-2xl border border-border/70 bg-card/80 p-6 shadow-inner">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Room-Temperature</span>
            <span className="flex items-center gap-1 text-emerald-600">
              Live
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Temperature</p>
              <p className="text-5xl font-semibold tracking-tight">
                24.6
                <span className="ml-1 text-lg text-muted-foreground">°C</span>
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Humidity</p>
                <p className="text-2xl font-semibold">48%</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signal</p>
                <p className="text-2xl font-semibold">-51 dBm</p>
              </div>
            </div>
          </div>
        </div>

        <div className="house-scene" aria-hidden="true">
          <div className="house-roof" />
          <div className="house-body">
            <span className="house-window house-window--left" />
            <span className="house-window house-window--right" />
            <span className="house-door" />
          </div>
          <div className="house-shadow" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card rounded-2xl border border-border/70 bg-card/70 p-5 text-center shadow-sm">
            <p className="text-3xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {featureCards.map((feature) => (
          <article key={feature.title} className="feature-card rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm">
            <feature.icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="temp-visual grid gap-6 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
        <div className="temp-orb">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room comfort</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight text-white">24.6°C</h2>
            <p className="text-sm text-white/80">Feels-like temperature based on humidity offset.</p>
          </div>
          <div className="temp-orb__ring">
            <span className="temp-orb__ring-value">48% RH</span>
            <span className="temp-orb__ring-label">Humidity</span>
          </div>
        </div>

        <div className="grid gap-4">
          <article className="rounded-2xl border border-border/60 bg-background/80 p-5 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" />
              Comfort insights
            </div>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {comfortInsights.map((item) => (
                <li key={item.label} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-xs">{item.detail}</p>
                  </div>
                  <span className="text-base font-semibold text-primary">{item.value}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-border/60 bg-background/80 p-5 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Waves className="h-4 w-4 text-primary" />
              Hourly drift
            </div>
            <div className="temp-bars mt-6 flex items-end justify-between gap-2">
              {hourlyTemps.map((value, index) => {
                const height = (value / maxHourlyTemp) * 100;
                return (
                  <div key={index} className="temp-bar">
                    <div className="temp-bar__fill" style={{ height: `${height}%` }} />
                    <span className="temp-bar__label">{index + 14}</span>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t border-border/40 py-8">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} IoT Room Temperature. Real-time monitoring made simple.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
              Home
            </Link>
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
    </>
  );
}

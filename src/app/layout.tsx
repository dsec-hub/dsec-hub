import type { Metadata } from "next";
import {
  Inter,
  Geist,
  Geist_Mono,
  Figtree,
  Plus_Jakarta_Sans,
  Source_Sans_3,
  Manrope,
  Outfit,
  DM_Sans,
  Sora,
  Space_Grotesk,
  JetBrains_Mono,
  Fraunces,
  Lora,
} from "next/font/google";
import { Toaster } from "sonner";
import { TopProgressBar } from "@/components/top-progress-bar";
import "./globals.css";

// Resend's DESIGN.md uses Inter for UI and Geist Mono on code surfaces. Per the
// brief we also run Geist Mono on titles (in place of Resend's Domaine serif).
// Inter (body default) and Geist Mono (title default) preload; the selectable
// Appearance fonts don't, so we don't ship a dozen <link rel=preload> — each
// only downloads when a user actually picks it.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Additional UI fonts users can pick from in Appearance settings. Each exposes a
// CSS variable (see FONT_OPTIONS in lib/theme) the per-user override swaps in.
// next/font needs a literal options object per call (no spread/variables), so
// `subsets`/`preload`/`display` are repeated inline below.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], preload: false, display: "swap" });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], preload: false, display: "swap" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], preload: false, display: "swap" });
const sourceSans = Source_Sans_3({ variable: "--font-source", subsets: ["latin"], preload: false, display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], preload: false, display: "swap" });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], preload: false, display: "swap" });
const dmSans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"], preload: false, display: "swap" });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], preload: false, display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-spacegrotesk", subsets: ["latin"], preload: false, display: "swap" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], preload: false, display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false, display: "swap" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], preload: false, display: "swap" });

export const metadata: Metadata = {
  title: "DSEC — Exec Dashboard",
  description: "Internal operations dashboard for the DSEC committee.",
};

// Runs before first paint: resolves the saved theme (or system preference) and
// sets the `.dark` class + color-scheme so there is no light/dark flash, then
// applies the saved display-size + motion preferences (data-display / data-motion)
// the same way so those never flash either. See settings/appearance/client-prefs.
const themeInit = `(function(){try{var e=document.documentElement;var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}e.classList.toggle('dark',t==='dark');e.style.colorScheme=t;var d=localStorage.getItem('dsec-display');if(d==='compact'||d==='large')e.dataset.display=d;if(localStorage.getItem('dsec-motion')==='reduce')e.dataset.motion='reduce';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const fontVars = [
    inter,
    geistMono,
    geist,
    figtree,
    jakarta,
    sourceSans,
    manrope,
    outfit,
    dmSans,
    sora,
    spaceGrotesk,
    jetbrains,
    fraunces,
    lora,
  ]
    .map((f) => f.variable)
    .join(" ");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVars} h-full antialiased`}
    >
      <head>
        {/* Resolves the saved/system theme before first paint so there's no
            light/dark flash. A plain inline <script> in the server-rendered
            <head> is the documented pattern (Next's "Preventing Flash Before
            Hydration" guide); the browser runs it during HTML parsing. */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">
        <TopProgressBar />
        {children}
        <Toaster richColors closeButton position="top-right" theme="system" />
      </body>
    </html>
  );
}

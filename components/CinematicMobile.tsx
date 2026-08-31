"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { OPS_EMAIL, PARTNER_SITE } from "@/lib/clips";
import CaptureScene from "@/components/CaptureScene";

const EGO = [
  { id: "diamond", label: "egocentric · diamond", src: "/clips/diamond.mp4" },
  { id: "refinery", label: "egocentric · refinery", src: "/clips/refinery.mp4" },
  { id: "assembly", label: "egocentric · assembly", src: "/clips/assembly.mp4" },
  { id: "residential", label: "egocentric · pharmaceutical", src: "/clips/residential.mp4" },
];

/**
 * Mobile experience — a normal vertically-scrolling page (the desktop build is
 * a fixed wheel-driven scrubber that touch can't drive). The three "acts" are
 * stacked full-bleed sections tuned for portrait screens.
 */
export default function CinematicMobile() {
  return (
    <main className="min-h-[100svh] bg-[#0f0e0b] text-[var(--bone-50)]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[rgba(246,242,234,0.08)] bg-[rgba(15,14,11,0.72)] px-5 py-3 backdrop-blur-md">
        <span className="font-serif text-[22px] leading-none text-[#f6f2ea]">
          Praxis<span className="text-[var(--accent-500)]">.</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#9b9486]">
            Backed by
          </span>
          <Image
            src="/yc-logo.png"
            alt="Y Combinator"
            width={948}
            height={198}
            priority
            className="h-[13px] w-auto"
          />
        </div>
      </header>

      {/* Act 1 — the lesson */}
      <section className="px-5 pb-14 pt-6">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[3px] border border-[rgba(246,242,234,0.1)]">
          <Image
            src="/inheritance/engraving.png"
            alt="Aristotle teaching the young Alexander"
            fill
            priority
            sizes="100vw"
            style={{
              objectFit: "cover",
              filter: "grayscale(1) sepia(0.32) contrast(1.06) brightness(0.94)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 55%, rgba(15,14,11,0.55) 100%)",
            }}
          />
        </div>
        <h1 className="mt-7 font-sans text-[clamp(2rem,8.5vw,2.9rem)] font-medium leading-[1.02] tracking-[-0.03em] text-[#f6f2ea]">
          Great men were forged by great teachers.
        </h1>
      </section>

      {/* Act 2 — the demonstration */}
      <section className="border-t border-[rgba(246,242,234,0.06)] px-5 py-14">
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--bone-50)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-500)] blink" />
          rec · 4 streams
        </div>
        <h2 className="m-0 font-sans text-[clamp(1.75rem,7.5vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.03em] text-[#f6f2ea]">
          Great machines will be forged by human intuition.
        </h2>
        <div className="mt-7 grid grid-cols-2 gap-2">
          {EGO.map((e) => (
            <MobileTile key={e.id} label={e.label} src={e.src} />
          ))}
        </div>
      </section>

      {/* Act 3 — the inheritor: capture + CTA */}
      <section className="border-t border-[rgba(246,242,234,0.06)] pb-16 pt-14">
        <h2 className="px-5 font-sans text-[clamp(1.75rem,7.5vw,2.5rem)] font-medium leading-[1.05] tracking-[-0.03em] text-[#f6f2ea]">
          One demonstration, every modality.
        </h2>
        <p className="mt-3 px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--fg-on-ink-2)]">
          head + wrist cams · live 3D mocap
        </p>
        <div className="relative mt-6 h-[86svh] w-full overflow-hidden border-y border-[rgba(246,242,234,0.08)] bg-[#0b0a08]">
          <CaptureScene bare />
        </div>

        <div className="mt-12 flex flex-col items-center px-5 text-center">
          <div className="font-serif text-[clamp(3rem,15vw,4.5rem)] leading-none tracking-[-0.01em] text-[#f6f2ea]">
            Praxis<span className="text-[var(--accent-500)]">.</span>
          </div>
          <a
            href={PARTNER_SITE}
            className="mt-6 inline-flex h-[52px] items-center gap-2 rounded-[2px] bg-[var(--accent-500)] px-7 font-sans text-[15px] font-medium text-[var(--bone-50)] transition-colors active:bg-[var(--accent-600)]"
          >
            Learn more <span aria-hidden>→</span>
          </a>
          <a
            href={`mailto:${OPS_EMAIL}`}
            className="mt-4 font-mono text-[12px] tracking-[0.06em] text-[var(--fg-on-ink-2)] underline-offset-4"
          >
            {OPS_EMAIL}
          </a>
        </div>
      </section>
    </main>
  );
}

function MobileTile({ label, src }: { label: string; src: string }) {
  const [ok, setOk] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const reveal = () => {
      setOk(true);
      v.play().catch(() => {});
    };
    if (v.readyState >= 2) reveal();
    v.addEventListener("loadeddata", reveal);
    v.addEventListener("canplay", reveal);
    return () => {
      v.removeEventListener("loadeddata", reveal);
      v.removeEventListener("canplay", reveal);
    };
  }, [src]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[2px] border border-[rgba(246,242,234,0.1)] bg-[var(--bg-ink-elev)]">
      <video
        ref={vidRef}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: ok ? 1 : 0,
          filter: "grayscale(1) contrast(1.04) brightness(.9)",
        }}
        onError={() => setOk(false)}
      />
      {!ok && <div className="bg-grid absolute inset-0 opacity-40" />}
      <span className="absolute bottom-1.5 left-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--fg-on-ink-2)]">
        {label}
      </span>
    </div>
  );
}

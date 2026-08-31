"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EMAIL, PARTNER_SITE } from "@/lib/clips";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const seg = (p: number, lo: number, hi: number) => clamp((p - lo) / (hi - lo));
const ease = (t: number) => t * t * (3 - 2 * t);

// Scene-2 footage grid. Drop matching files in /public/clips/ and they auto-play;
// until a file exists the styled placeholder shows.
const EGO = [
  { id: "diamond", label: "egocentric · diamond", src: "/clips/diamond.mp4" },
  { id: "refinery", label: "egocentric · refinery", src: "/clips/refinery.mp4" },
  { id: "assembly", label: "egocentric · assembly", src: "/clips/assembly.mp4" },
  { id: "residential", label: "egocentric · residential", src: "/clips/residential.mp4" },
];

// Scene-3 background. Drop /public/inheritance/robot.mp4 (or .webm) to fill it.
const ROBOT_SRC = "/inheritance/robot.mp4";

export default function Cinematic() {
  const stage = useRef<HTMLDivElement>(null);
  const s1 = useRef<HTMLDivElement>(null);
  const s2 = useRef<HTMLDivElement>(null);
  const s3 = useRef<HTMLDivElement>(null);
  const s3end = useRef<HTMLDivElement>(null);
  const tl1 = useRef<HTMLDivElement>(null);
  const tl2 = useRef<HTMLDivElement>(null);
  const tl3 = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const replay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Lock page scroll — this is a fixed, scrubbed experience.
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    let p = 0;
    let autoP = 0;
    let manual = false;
    let raf = 0;
    let last = 0;
    let ty = 0;

    const st = stage.current!;
    const replayEl = replay.current;

    const render = () => {
      const o1 = 1 - seg(p, 0.26, 0.37);
      const o2 = seg(p, 0.28, 0.39) * (1 - seg(p, 0.6, 0.71));
      const o3 = seg(p, 0.62, 0.73);
      if (s1.current) s1.current.style.opacity = o1.toFixed(3);
      if (s2.current) s2.current.style.opacity = o2.toFixed(3);
      if (s3.current) s3.current.style.opacity = o3.toFixed(3);
      if (s1.current)
        s1.current.style.transform = `scale(${1 + 0.05 * ease(seg(p, 0, 0.37))})`;
      if (s2.current)
        s2.current.style.transform = `scale(${1 + 0.05 * ease(seg(p, 0.28, 0.71))})`;
      if (s3.current)
        s3.current.style.transform = `scale(${1 + 0.06 * ease(seg(p, 0.62, 1))})`;
      const endO = seg(p, 0.7, 0.82);
      if (s3end.current) {
        s3end.current.style.opacity = endO.toFixed(3);
        s3end.current.style.pointerEvents = endO > 0.5 ? "auto" : "none";
        s3end.current.inert = endO <= 0.5;
      }
      if (tl1.current)
        tl1.current.style.transform = `scaleX(${clamp(p / 0.33)})`;
      if (tl2.current)
        tl2.current.style.transform = `scaleX(${clamp((p - 0.33) / 0.33)})`;
      if (tl3.current)
        tl3.current.style.transform = `scaleX(${clamp((p - 0.66) / 0.34)})`;
    };

    const onWheel = (e: WheelEvent) => {
      manual = true;
      p = clamp(p + e.deltaY * 0.0007);
      if (hint.current) hint.current.style.opacity = "0";
      if (replay.current) replay.current.style.opacity = "0.8";
      e.preventDefault();
    };
    const onReplay = () => {
      manual = false;
      autoP = 0;
      p = 0;
      if (replay.current) replay.current.style.opacity = "0";
      if (hint.current) hint.current.style.opacity = "1";
    };
    const onDown = (e: PointerEvent) => {
      ty = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons) {
        manual = true;
        p = clamp(p + (ty - e.clientY) * 0.0013);
        ty = e.clientY;
        if (hint.current) hint.current.style.opacity = "0";
        if (replay.current) replay.current.style.opacity = "0.8";
      }
    };

    st.addEventListener("wheel", onWheel, { passive: false });
    st.addEventListener("pointerdown", onDown);
    st.addEventListener("pointermove", onMove);
    replayEl?.addEventListener("click", onReplay);

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 16.67, 3) : 1;
      last = now;
      if (reduce) {
        // Reduced motion: jump to the ending so the CTA is visible & static.
        p = 1;
      } else if (!manual) {
        autoP = Math.min(1, autoP + dt / 720);
        p = autoP;
        if (autoP >= 1 && replay.current) replay.current.style.opacity = "0.8";
      }
      render();
      raf = requestAnimationFrame(frame);
    };
    render();
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      st.removeEventListener("wheel", onWheel);
      st.removeEventListener("pointerdown", onDown);
      st.removeEventListener("pointermove", onMove);
      replayEl?.removeEventListener("click", onReplay);
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div
      ref={stage}
      id="stage"
      className="fixed inset-0 overflow-hidden bg-[#0f0e0b] text-[var(--bone-50)]"
      style={{ touchAction: "none" }}
    >
      <div ref={s1} className="scene absolute inset-0" style={{ willChange: "opacity, transform" }}>
        <Image
          src="/inheritance/engraving.png"
          alt="Aristotle teaching the young Alexander"
          fill
          priority
          sizes="100vw"
          style={{
            objectFit: "cover",
            filter: "grayscale(1) sepia(0.32) contrast(1.06) brightness(0.92)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,14,11,.45) 0%, transparent 26%, transparent 52%, rgba(15,14,11,.82) 100%)",
          }}
        />
        <div className="absolute bottom-[15%] left-[5%] right-[5%] max-w-[760px]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#c7b8a6]">
            343 BC · the lesson
          </div>
          <h1 className="m-0 font-sans text-[clamp(2.2rem,6.2vw,4rem)] font-medium leading-[0.96] tracking-[-0.035em] text-[#f6f2ea]">
            Great men were forged by great teachers.
          </h1>
        </div>
      </div>

      <div ref={s2} className="scene absolute inset-0 bg-[#0f0e0b]" style={{ opacity: 0, willChange: "opacity, transform" }}>
        <div
          className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[3px]"
          style={{ filter: "grayscale(1) contrast(1.04) brightness(.9)" }}
          aria-hidden
        >
          {EGO.map((e) => (
            <FootageTile key={e.id} label={e.label} src={e.src} />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,14,11,.4) 0%, transparent 30%, transparent 50%, rgba(15,14,11,.85) 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[18px] top-[88px] inline-flex items-center gap-1.5 rounded-full bg-[rgba(15,14,11,0.7)] px-2 py-[3px] font-mono text-[10px] tracking-[0.08em] text-[var(--bone-50)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-500)] blink" />
            REC · 4 streams
          </div>
          <div className="absolute right-[18px] top-1/2 h-16 w-px -translate-y-1/2 bg-[rgba(20,164,188,0.5)]" />
          <div className="absolute right-0 top-1/2 h-px w-16 -translate-y-1/2 bg-[rgba(20,164,188,0.5)]" />
        </div>
        <div className="absolute bottom-[15%] left-[5%] right-[5%]">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--fg-on-ink-2)]">
            now · the demonstration
          </div>
          <h1 className="m-0 font-sans text-[clamp(1.9rem,5vw,3.1rem)] font-medium leading-[0.99] tracking-[-0.035em] text-[#f6f2ea]">
            <span className="block">Great machines will be forged</span>
            <span className="block">by human intuition.</span>
          </h1>
        </div>
      </div>

      <div ref={s3} className="scene absolute inset-0 bg-[#0f0e0b]" style={{ opacity: 0, willChange: "opacity, transform" }}>
        <RobotPlaceholder />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,14,11,.4) 0%, transparent 24%, transparent 44%, rgba(15,14,11,.9) 100%)",
          }}
        />
        <div
          ref={s3end}
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ opacity: 0 }}
        >
          <div className="font-serif text-[clamp(4rem,12vw,6.5rem)] leading-none tracking-[-0.01em] text-[#f6f2ea]">
            Praxis<span className="text-[var(--accent-500)]">.</span>
          </div>
          <div className="mt-7">
            <a
              href={PARTNER_SITE}
              className="inline-flex h-[52px] items-center gap-2 rounded-[2px] bg-[var(--accent-500)] px-7 font-sans text-[15px] font-medium text-[var(--bone-50)] transition-colors hover:bg-[var(--accent-600)]"
            >
              Learn more <span aria-hidden>→</span>
            </a>
          </div>
          <a
            href={`mailto:${EMAIL}`}
            className="mt-5 font-mono text-[12px] tracking-[0.06em] text-[var(--fg-on-ink-2)] underline-offset-4 hover:text-[var(--accent-300)] hover:underline"
          >
            {EMAIL}
          </a>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[6] opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,.16) 3px, rgba(0,0,0,.16) 4px)",
        }}
        aria-hidden
      />

      <div className="absolute left-10 top-[30px] z-[8]">
        <span className="font-serif text-[28px] leading-none text-[#f6f2ea]">
          Praxis<span className="text-[var(--accent-500)]">.</span>
        </span>
      </div>

      <div className="absolute bottom-[44px] left-[56px] right-[56px] z-[8] grid grid-cols-3 gap-[18px] max-sm:left-5 max-sm:right-5">
        {[
          { ref: tl1, label: "The lesson", color: "#E6DECF" },
          { ref: tl2, label: "The demonstration", color: "#E6DECF" },
          { ref: tl3, label: "The inheritor", color: "#C9A8F0" },
        ].map((t, i) => (
          <div key={i}>
            <div className="relative h-[2px] overflow-hidden bg-[rgba(246,242,234,0.16)]">
              <div
                ref={t.ref}
                className="absolute inset-0 origin-left"
                style={{ background: t.color, transform: "scaleX(0)" }}
              />
            </div>
            <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9b9486]">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      <div
        ref={hint}
        className="absolute right-10 top-[34px] z-[8] flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#9b9486]"
      >
        <span>scroll to scrub</span>
        <span className="cue-bob inline-block" aria-hidden>
          ↓
        </span>
      </div>
      <button
        ref={replay}
        type="button"
        className="absolute right-10 top-[34px] z-[8] cursor-pointer font-mono text-[11px] uppercase tracking-[0.14em] text-[#9b9486] opacity-0 transition-opacity"
      >
        ↻ replay
      </button>
    </div>
  );
}

function FootageTile({ label, src }: { label: string; src?: string }) {
  // Show the video when its file loads; otherwise fall back to the placeholder
  // (so unset/missing files degrade gracefully with no broken media).
  const [ok, setOk] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-ink-elev)]">
      {src && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onLoadedData={() => setOk(true)}
          onError={() => setOk(false)}
          style={{ opacity: ok ? 1 : 0 }}
        />
      )}
      {!ok && (
        <>
          <div className="bg-grid absolute inset-0 opacity-50" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(124,58,237,0.14),transparent_70%)]" />
          <span className="absolute bottom-2 left-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg-on-ink-2)]">
            {label}
          </span>
          <span className="absolute right-2 top-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[var(--fg4)]">
            footage soon
          </span>
        </>
      )}
    </div>
  );
}

function RobotPlaceholder() {
  // Plays /public/inheritance/robot.mp4 once present; else shows the gradient.
  const [ok, setOk] = useState(false);
  return (
    <div
      className="absolute inset-0"
      style={{ filter: "grayscale(1) contrast(1.05) brightness(.9)" }}
      aria-hidden
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={ROBOT_SRC}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onLoadedData={() => setOk(true)}
        onError={() => setOk(false)}
        style={{ opacity: ok ? 1 : 0 }}
      />
      {!ok && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 35%, #1c1a14 0%, #0f0e0b 72%)",
            }}
          />
          <div className="bg-grid absolute inset-0 opacity-30" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(124,58,237,0.12),transparent_60%)]" />
        </>
      )}
    </div>
  );
}

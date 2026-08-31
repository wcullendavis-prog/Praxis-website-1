"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { OPS_EMAIL } from "@/lib/clips";

// ---------------------------------------------------------------------------
// Types mirroring public/demo/pose.json (extracted from the real HDF5 mocap).
// ---------------------------------------------------------------------------
type V3 = [number, number, number];
type V4 = [number, number, number, number];

interface PoseData {
  meta: {
    task: string;
    scene: string;
    world: string;
    fps: number;
    nSamples: number;
    clipDur: number;
    sessionFrames: number;
    sessionDur: number;
    rateHz: number;
    center: V3;
    radius: number;
    counts: Record<string, number>;
    camera: {
      model: string;
      serial: string;
      sdk: string;
      fx: number;
      fy: number;
      cx: number;
      cy: number;
      res: [number, number];
      hFOV: number;
      vFOV: number;
      dFOV: number;
      baselineMM: number;
    };
    dataset: {
      hours: number;
      sessions: number;
      categories: number;
      urls: number;
      filesPerPackage: number;
    };
    fingerNames: string[];
  };
  segments: { label: string; t0: number; t1: number }[];
  subIdx: number[];
  head_pos: V3[];
  head_q: V4[];
  L_pos: V3[];
  L_q: V4[];
  L_fj: V3[][];
  R_pos: V3[];
  R_q: V4[];
  R_fj: V3[][];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// Rotate vector v by unit quaternion q = [x,y,z,w].
function qRot(q: V4, v: V3): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

export default function Demo() {
  const [pose, setPose] = useState<PoseData | null>(null);
  const [err, setErr] = useState(false);
  const [playing, setPlaying] = useState(true);

  const head = useRef<HTMLVideoElement>(null);
  const wl = useRef<HTMLVideoElement>(null);
  const wr = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scrub = useRef<HTMLInputElement>(null);

  // live text read-outs (updated imperatively to avoid per-frame re-renders)
  const tRead = useRef<HTMLSpanElement>(null);
  const subRead = useRef<HTMLSpanElement>(null);
  const headRead = useRef<HTMLSpanElement>(null);
  const lRead = useRef<HTMLSpanElement>(null);
  const rRead = useRef<HTMLSpanElement>(null);
  const gripL = useRef<HTMLDivElement>(null);
  const gripR = useRef<HTMLDivElement>(null);
  const playheadRefs = useRef<HTMLDivElement[]>([]);

  // orbit state for the 3D view
  const orbit = useRef({ yaw: -0.6, pitch: 0.32, drag: false, px: 0, py: 0, auto: true });

  useEffect(() => {
    fetch("/demo/pose.json")
      .then((r) => r.json())
      .then((d: PoseData) => setPose(d))
      .catch(() => setErr(true));
  }, []);

  useEffect(() => {
    if (!pose) return;
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const vids = [head.current, wl.current, wr.current].filter(
      Boolean
    ) as HTMLVideoElement[];
    const master = head.current!;
    const { center, radius } = pose.meta;
    const N = pose.meta.nSamples;
    const FPS = pose.meta.fps;

    let raf = 0;
    let W = 0,
      H = 0,
      dpr = 1;

    const resize = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    // normalize a world point into unit-ish view space
    const norm = (p: V3): V3 => [
      (p[0] - center[0]) / radius,
      (p[1] - center[1]) / radius,
      (p[2] - center[2]) / radius,
    ];

    // project a normalized point to screen using yaw/pitch orbit.
    // world is FLU: x fwd, y left, z up. keep z vertical on screen.
    const project = (p: V3) => {
      const { yaw, pitch } = orbit.current;
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw);
      const x = p[0] * cy - p[1] * sy;
      const y = p[0] * sy + p[1] * cy;
      const z = p[2];
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      const y2 = y * cp - z * sp;
      const z2 = y * sp + z * cp;
      const depth = y2;
      const persp = 2.6 / (3.1 + depth);
      const s = Math.min(W, H) * 0.42;
      return {
        x: W / 2 + x * persp * s,
        y: H / 2 - z2 * persp * s,
        d: depth,
        persp,
      };
    };

    const at = (arr: V3[], i0: number, i1: number, f: number) =>
      lerp3(arr[i0], arr[i1], f);

    // finger chains: wrist -> joint0 -> 1 -> 2 -> 3 for each of 5 fingers
    const drawHand = (
      wrist: V3,
      joints: V3[],
      color: string,
      glow: string
    ) => {
      const wp = project(norm(wrist));
      for (let fi = 0; fi < 5; fi++) {
        let prev = wp;
        for (let j = 0; j < 4; j++) {
          const jp = project(norm(joints[fi * 4 + j]));
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.6, 2.4 * jp.persp);
          ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, jp.persp);
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(jp.x, jp.y);
          ctx.stroke();
          prev = jp;
        }
      }
      // joints
      ctx.globalAlpha = 1;
      for (let k = 0; k < joints.length; k++) {
        const jp = project(norm(joints[k]));
        const r = Math.max(1.2, 3.1 * jp.persp);
        ctx.beginPath();
        ctx.fillStyle = k % 4 === 3 ? glow : color;
        ctx.arc(jp.x, jp.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // wrist node
      ctx.beginPath();
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.arc(wp.x, wp.y, Math.max(2.5, 5 * wp.persp), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      return wp;
    };

    const drawAxes = (origin: V3, q: V4, len: number) => {
      const o = project(norm(origin));
      const axes: [V3, string][] = [
        [[len, 0, 0], "#e04a0b"],
        [[0, len, 0], "#14a4bc"],
        [[0, 0, len], "#7c3aed"],
      ];
      for (const [ax, col] of axes) {
        const tip = qRot(q, ax);
        const end = project(norm([origin[0] + tip[0], origin[1] + tip[1], origin[2] + tip[2]]));
        ctx.beginPath();
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 1.5;
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const grip = (wrist: V3, joints: V3[]) => {
      // mean tip distance from wrist -> smaller = closed grip
      let sum = 0;
      for (let fi = 0; fi < 5; fi++) {
        const t = joints[fi * 4 + 3];
        sum += Math.hypot(t[0] - wrist[0], t[1] - wrist[1], t[2] - wrist[2]);
      }
      const spread = sum / 5; // meters
      return Math.max(0, Math.min(1, 1 - (spread - 0.06) / 0.12));
    };

    const fmt3 = (p: V3) =>
      `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p[2].toFixed(2)}`;

    const draw = () => {
      const t = master.currentTime % pose.meta.clipDur;
      const fpos = t * FPS;
      const i0 = Math.min(N - 1, Math.floor(fpos));
      const i1 = Math.min(N - 1, i0 + 1);
      const f = fpos - i0;

      // keep wrist cams locked to master
      for (const v of vids) {
        if (v !== master && Math.abs(v.currentTime - master.currentTime) > 0.12) {
          v.currentTime = master.currentTime;
        }
      }

      if (orbit.current.auto && !orbit.current.drag) orbit.current.yaw += 0.0016;

      ctx.clearRect(0, 0, W, H);

      // floor grid (world z = 0 plane)
      ctx.strokeStyle = "rgba(246,242,234,0.06)";
      ctx.lineWidth = 1;
      const g = 5;
      const zf = -(center[2]) / radius; // floor height in norm space
      for (let i = -g; i <= g; i++) {
        const a = project([i / g * 1.4, -1.4, zf]);
        const b = project([i / g * 1.4, 1.4, zf]);
        const c = project([-1.4, i / g * 1.4, zf]);
        const d = project([1.4, i / g * 1.4, zf]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }

      const hp = at(pose.head_pos, i0, i1, f);
      const lp = at(pose.L_pos, i0, i1, f);
      const rp = at(pose.R_pos, i0, i1, f);
      const lj = pose.L_fj[i0].map((_, k) => lerp3(pose.L_fj[i0][k], pose.L_fj[i1][k], f));
      const rj = pose.R_fj[i0].map((_, k) => lerp3(pose.R_fj[i0][k], pose.R_fj[i1][k], f));

      // head as camera frustum
      const hproj = project(norm(hp));
      drawAxes(hp, pose.head_q[i0], 0.18);
      ctx.beginPath();
      ctx.fillStyle = "#f6f2ea";
      ctx.shadowColor = "#f6f2ea";
      ctx.shadowBlur = 10;
      ctx.arc(hproj.x, hproj.y, Math.max(3, 6 * hproj.persp), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(246,242,234,0.55)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("HEAD", hproj.x + 8, hproj.y - 8);

      drawAxes(lp, pose.L_q[i0], 0.12);
      drawAxes(rp, pose.R_q[i0], 0.12);
      const lw = drawHand(lp, lj, "rgba(20,164,188,0.85)", "#14a4bc");
      const rw = drawHand(rp, rj, "rgba(124,58,237,0.9)", "#c9a8f0");
      ctx.fillStyle = "rgba(20,164,188,0.7)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("L", lw.x + 8, lw.y + 4);
      ctx.fillStyle = "rgba(201,168,240,0.85)";
      ctx.fillText("R", rw.x + 8, rw.y + 4);

      // read-outs
      if (tRead.current)
        tRead.current.textContent = `${t.toFixed(2)}s / ${pose.meta.clipDur.toFixed(0)}s`;
      const si = pose.subIdx[i0] ?? 0;
      if (subRead.current) subRead.current.textContent = pose.segments[si]?.label ?? "";
      if (headRead.current) headRead.current.textContent = fmt3(hp);
      if (lRead.current) lRead.current.textContent = fmt3(lp);
      if (rRead.current) rRead.current.textContent = fmt3(rp);
      const gl = grip(lp, lj) * 100;
      const gr = grip(rp, rj) * 100;
      if (gripL.current) gripL.current.style.width = `${gl}%`;
      if (gripR.current) gripR.current.style.width = `${gr}%`;

      // scrubber + playheads
      if (scrub.current && document.activeElement !== scrub.current)
        scrub.current.value = String(t);
      const frac = t / pose.meta.clipDur;
      for (const ph of playheadRefs.current)
        if (ph) ph.style.left = `${frac * 100}%`;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // orbit interactions
    const down = (e: PointerEvent) => {
      orbit.current.drag = true;
      orbit.current.auto = false;
      orbit.current.px = e.clientX;
      orbit.current.py = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (!orbit.current.drag) return;
      orbit.current.yaw += (e.clientX - orbit.current.px) * 0.008;
      orbit.current.pitch = Math.max(
        -1.2,
        Math.min(1.3, orbit.current.pitch + (e.clientY - orbit.current.py) * 0.006)
      );
      orbit.current.px = e.clientX;
      orbit.current.py = e.clientY;
    };
    const up = () => (orbit.current.drag = false);
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cv.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [pose]);

  const togglePlay = () => {
    const vids = [head.current, wl.current, wr.current];
    if (playing) vids.forEach((v) => v?.pause());
    else vids.forEach((v) => v?.play());
    setPlaying(!playing);
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    [head.current, wl.current, wr.current].forEach((v) => {
      if (v) v.currentTime = t;
    });
  };

  const registerPlayhead = (el: HTMLDivElement | null) => {
    if (el && !playheadRefs.current.includes(el)) playheadRefs.current.push(el);
  };

  const m = pose?.meta;

  return (
    <main className="surface-ink min-h-screen bg-[#0f0e0b] text-[var(--fg1)]">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--rule-1)] bg-[rgba(15,14,11,0.82)] px-6 py-3 backdrop-blur-md">
        <Link href="/" className="font-serif text-[22px] leading-none text-[#f6f2ea]">
          Praxis<span className="text-[var(--accent-500)]">.</span>
        </Link>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg3)] sm:inline">
            Multimodal capture · residential
          </span>
          <a
            href={`mailto:${OPS_EMAIL}`}
            className="rounded-[2px] bg-[var(--accent-500)] px-4 py-2 font-sans text-[13px] font-medium text-[#f6f2ea] transition-colors hover:bg-[var(--accent-600)]"
          >
            Request access
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-[1240px] px-6 pt-12 pb-6">
        <div className="t-eyebrow mb-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-500)] blink" />
          one capture · every modality
        </div>
        <h1 className="m-0 max-w-[900px] font-sans text-[clamp(2rem,5.2vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.035em] text-[#f6f2ea]">
          One home task, recorded the way a machine must learn it.
        </h1>
        <p className="mt-5 max-w-[680px] font-sans text-[15px] leading-relaxed text-[var(--fg2)]">
          A single residential demonstration —{" "}
          <span className="text-[#f6f2ea]">tidying pillowcases</span> — captured
          across three synchronized camera views, stereo depth, and full
          motion capture of both hands, every finger, and the head.
        </p>
      </section>

      {err && (
        <div className="mx-auto max-w-[1240px] px-6 py-10 font-mono text-sm text-[var(--flare-500)]">
          Could not load demo data (public/demo/pose.json).
        </div>
      )}

      {/* stage */}
      <section className="mx-auto max-w-[1240px] px-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          {/* cameras */}
          <div className="flex flex-col gap-3">
            <Panel label="egocentric · head (ZED 2i)" accent="#f6f2ea">
              <video
                ref={head}
                src="/demo/head.mp4"
                muted
                loop
                autoPlay
                playsInline
                preload="auto"
                className="aspect-video w-full object-cover"
              />
            </Panel>
            <div className="grid grid-cols-2 gap-3">
              <Panel label="wrist · left" accent="#14a4bc">
                <video
                  ref={wl}
                  src="/demo/wristL.mp4"
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="auto"
                  className="aspect-video w-full object-cover"
                />
              </Panel>
              <Panel label="wrist · right" accent="#c9a8f0">
                <video
                  ref={wr}
                  src="/demo/wristR.mp4"
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="auto"
                  className="aspect-video w-full object-cover"
                />
              </Panel>
            </div>
          </div>

          {/* 3D mocap */}
          <Panel
            label="motion capture · live reconstruction"
            accent="#7c3aed"
            hint="drag to orbit"
            fill
          >
            <div className="relative h-full min-h-[420px] w-full bg-[#0b0a08]">
              <canvas ref={canvas} className="h-full w-full cursor-grab active:cursor-grabbing" />
              <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 font-mono text-[9px] uppercase tracking-[0.1em]">
                <span className="text-[#14a4bc]">■ left hand · 20 joints</span>
                <span className="text-[#c9a8f0]">■ right hand · 20 joints</span>
                <span className="text-[#f6f2ea]">■ head · 6dof</span>
              </div>
              <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fg4)]">
                {m?.world}
              </div>
            </div>
          </Panel>
        </div>

        {/* transport + language track */}
        <div className="mt-3 rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-500)] text-[#f6f2ea] transition-colors hover:bg-[var(--accent-600)]"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div className="relative flex-1">
              <input
                ref={scrub}
                type="range"
                min={0}
                max={m?.clipDur ?? 40}
                step={0.02}
                defaultValue={0}
                onChange={onScrub}
                className="praxis-range w-full"
              />
            </div>
            <span
              ref={tRead}
              className="w-[110px] shrink-0 text-right font-mono text-[11px] text-[var(--fg2)]"
            >
              0.00s
            </span>
          </div>

          {/* sub-task language track */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--fg4)]">
                sub-task instruction
              </span>
              <span ref={subRead} className="font-mono text-[11px] text-[var(--signal-500)]">
                —
              </span>
            </div>
            <div className="relative h-8 overflow-hidden rounded-[2px] bg-[#0b0a08]">
              {pose?.segments.map((s, i) => {
                const left = (s.t0 / (m!.clipDur)) * 100;
                const w = ((s.t1 - s.t0) / m!.clipDur) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full items-center overflow-hidden border-l border-[rgba(246,242,234,0.14)] px-2"
                    style={{
                      left: `${left}%`,
                      width: `${w}%`,
                      background:
                        i % 2 === 0
                          ? "rgba(20,164,188,0.14)"
                          : "rgba(124,58,237,0.16)",
                    }}
                  >
                    <span className="truncate font-mono text-[9px] tracking-[0.02em] text-[var(--fg2)]">
                      {s.label}
                    </span>
                  </div>
                );
              })}
              <div
                ref={registerPlayhead}
                className="absolute top-0 z-10 h-full w-px bg-[var(--flare-500)]"
                style={{ left: 0 }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* live readouts / modality rail */}
      <section className="mx-auto max-w-[1240px] px-6 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Readout label="head · pose (m)" refEl={headRead} accent="#f6f2ea" />
          <Readout label="left EE · pos (m)" refEl={lRead} accent="#14a4bc" />
          <Readout label="right EE · pos (m)" refEl={rRead} accent="#c9a8f0" />
          <div className="rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-3">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg4)]">
              grip · L / R
            </div>
            <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[#0b0a08]">
              <div ref={gripL} className="h-full bg-[var(--signal-500)]" style={{ width: "0%" }} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#0b0a08]">
              <div ref={gripR} className="h-full bg-[var(--accent-300)]" style={{ width: "0%" }} />
            </div>
          </div>
        </div>
      </section>

      {/* modality spec grid */}
      <section className="mx-auto max-w-[1240px] px-6 pb-6">
        <SectionTitle n="01" title="What one capture contains" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Spec
            title="3 RGB streams"
            value="720p · 30 Hz"
            body="Global head view (ZED 2i) plus left & right wrist cameras — frame-synchronized so hand and scene are always in register."
            accent="#f6f2ea"
          />
          <Spec
            title="Stereo depth + point cloud"
            value={`${m?.camera.baselineMM ?? "—"} mm baseline`}
            body="Per-frame depth and 3D point cloud recorded in the raw SVO2, from a calibrated stereo pair."
            accent="#14a4bc"
          />
          <Spec
            title="Head pose"
            value="6 DoF"
            body="Position + orientation of the head/camera, the egocentric frame every other signal is expressed against."
            accent="#7c3aed"
          />
          <Spec
            title="Dual end-effectors"
            value="2 × 6 DoF"
            body="Left and right hand pose tracked as full 6-DoF end-effectors — the trajectories a bimanual policy imitates."
            accent="#c9a8f0"
          />
          <Spec
            title="Full-hand articulation"
            value="40 finger joints"
            body="Every finger of both hands — thumb, index, middle, ring, little × four joints — as position + quaternion."
            accent="#e04a0b"
          />
          <Spec
            title="Hierarchical language"
            value="task → sub-task"
            body="Each frame is labelled with a high-level goal, a fine-grained sub-task, and scene category — grounding vision-language-action training."
            accent="#f6f2ea"
          />
        </div>
      </section>

      {/* calibration / rigor */}
      <section className="mx-auto max-w-[1240px] px-6 py-6">
        <SectionTitle n="02" title="Calibrated, not just recorded" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <CalCard title="Coordinate frame" src="/demo/coord.jpg" alt="Right-handed FLU coordinate system" />
          <CalCard title="Rig extrinsics" src="/demo/extrinsics.png" alt="Head tracker to camera extrinsics" />
          <CalCard title="Hand joint map" src="/demo/handmap.png" alt="Finger joint naming convention" />
        </div>
        {m && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-4 font-mono text-[11px] text-[var(--fg2)] sm:grid-cols-3 lg:grid-cols-6">
            <KV k="camera" v={m.camera.model} />
            <KV k="fx / fy" v={`${m.camera.fx} / ${m.camera.fy}`} />
            <KV k="cx / cy" v={`${m.camera.cx} / ${m.camera.cy}`} />
            <KV k="resolution" v={m.camera.res.join("×")} />
            <KV k="dFOV" v={`${m.camera.dFOV}°`} />
            <KV k="SDK" v={m.camera.sdk.replace("[SDK]: ", "").split(" ")[0]} />
          </div>
        )}
      </section>

      {/* scale */}
      <section className="mx-auto max-w-[1240px] px-6 py-6">
        <SectionTitle n="03" title="This is one of thousands" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat big="100,024" unit="hours" sub="in this delivery alone" />
          <Stat big="797,940" unit="sessions" sub="6 files each · 100% complete" />
          <Stat big="124" unit="task types" sub="standardized household work" />
          <Stat big={`${m?.rateHz ?? 30} Hz`} unit="every stream" sub="video + depth + mocap" />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1240px] px-6 py-16 text-center">
        <div className="font-serif text-[clamp(2.4rem,7vw,4rem)] leading-none text-[#f6f2ea]">
          The record the machines inherit.
        </div>
        <p className="mx-auto mt-5 max-w-[520px] font-sans text-[15px] text-[var(--fg2)]">
          Praxis captures how real work is actually done — in full multimodal
          fidelity — and hands it to the systems that will learn it.
        </p>
        <div className="mt-8">
          <a
            href={`mailto:${OPS_EMAIL}`}
            className="inline-flex h-[52px] items-center gap-2 rounded-[2px] bg-[var(--accent-500)] px-7 font-sans text-[15px] font-medium text-[#f6f2ea] transition-colors hover:bg-[var(--accent-600)]"
          >
            Request access <span aria-hidden>→</span>
          </a>
        </div>
        <a
          href={`mailto:${OPS_EMAIL}`}
          className="mt-5 inline-block font-mono text-[12px] tracking-[0.06em] text-[var(--fg3)] underline-offset-4 hover:text-[var(--accent-300)] hover:underline"
        >
          {OPS_EMAIL}
        </a>
      </section>

      <style jsx global>{`
        .praxis-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
          background: rgba(246, 242, 234, 0.16);
          outline: none;
        }
        .praxis-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid #f6f2ea;
        }
        .praxis-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid #f6f2ea;
        }
      `}</style>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------
function Panel({
  label,
  accent,
  hint,
  fill,
  children,
}: {
  label: string;
  accent: string;
  hint?: string;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] ${
        fill ? "flex h-full flex-col" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--rule-1)] px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg3)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
          {label}
        </span>
        {hint && (
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fg4)]">
            {hint}
          </span>
        )}
      </div>
      {fill ? <div className="min-h-0 flex-1">{children}</div> : children}
    </div>
  );
}

function Readout({
  label,
  refEl,
  accent,
}: {
  label: string;
  refEl: React.RefObject<HTMLSpanElement | null>;
  accent: string;
}) {
  return (
    <div className="rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-3">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg4)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {label}
      </div>
      <span ref={refEl} className="font-mono text-[13px] tabular-nums text-[#f6f2ea]">
        —
      </span>
    </div>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <span className="font-mono text-[11px] text-[var(--accent-300)]">{n}</span>
      <h2 className="m-0 font-sans text-[clamp(1.3rem,2.6vw,1.9rem)] font-medium tracking-[-0.02em] text-[#f6f2ea]">
        {title}
      </h2>
    </div>
  );
}

function Spec({
  title,
  value,
  body,
  accent,
}: {
  title: string;
  value: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-4 transition-colors hover:border-[var(--rule-2)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="font-mono text-[11px] text-[var(--fg3)]">{value}</span>
      </div>
      <div className="mb-1.5 font-sans text-[16px] font-medium text-[#f6f2ea]">{title}</div>
      <p className="m-0 font-sans text-[13px] leading-relaxed text-[var(--fg2)]">{body}</p>
    </div>
  );
}

function CalCard({
  title,
  src,
  alt,
  children,
}: {
  title: string;
  src: string;
  alt: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)]">
      <div className="relative aspect-[16/10] w-full bg-[#0b0a08]">
        <Image src={src} alt={alt} fill sizes="(max-width:1024px) 100vw, 33vw" style={{ objectFit: "contain" }} />
      </div>
      <div className="p-3">
        <div className="font-sans text-[14px] font-medium text-[#f6f2ea]">{title}</div>
        {children && (
          <p className="m-0 mt-1 font-sans text-[12px] leading-relaxed text-[var(--fg2)]">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-[var(--fg4)]">{k}</span>
      <br />
      <span className="text-[#f6f2ea]">{v}</span>
    </div>
  );
}

function Stat({ big, unit, sub }: { big: string; unit: string; sub: string }) {
  return (
    <div className="rounded-[3px] border border-[var(--rule-1)] bg-[var(--bg-ink-elev)] p-4">
      <div className="font-serif text-[clamp(1.8rem,4vw,2.6rem)] leading-none text-[#f6f2ea]">
        {big}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent-300)]">
        {unit}
      </div>
      <div className="mt-1 font-sans text-[12px] text-[var(--fg3)]">{sub}</div>
    </div>
  );
}

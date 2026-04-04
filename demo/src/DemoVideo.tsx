import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Easing,
  spring,
} from "remotion";
import { loadFont as loadSpaceMono } from "@remotion/google-fonts/SpaceMono";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { pwnkitIcon as PwnkitIcon } from "./PwnkitIcon";

const { fontFamily: spaceMono } = loadSpaceMono("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

const { fontFamily: outfit } = loadOutfit("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// ── Colors ──
const C = {
  bg: "#0a0a0a",
  crimson: "#DC2626",
  crimsonGlow: "rgba(220, 38, 38, 0.3)",
  white: "#ffffff",
  dimmed: "#6b7280",
  green: "#22c55e",
  orange: "#f97316",
  yellow: "#eab308",
  blue: "#3b82f6",
  darkPanel: "#111111",
  border: "#1f1f1f",
  laneActive: "rgba(220, 38, 38, 0.08)",
};

// ── Scene boundaries (seconds) ──
const S = {
  // Scene 1: Intro (0-3s)
  introStart: 0,
  introEnd: 3,
  // Scene 2: Command (3-8s)
  cmdStart: 3,
  cmdEnd: 8,
  // Scene 3: Agents (8-14s)
  agentsStart: 8,
  agentsEnd: 14,
  // Scene 4: Results (14-18s)
  resultsStart: 14,
  resultsEnd: 18,
  // Scene 5: Benchmark (18-22s)
  benchStart: 18,
  benchEnd: 22,
  // Scene 6: CTA (22-26s)
  ctaStart: 22,
  ctaEnd: 26,
};

// Auto-detect commands shown in sequence
const COMMANDS = [
  { text: "pwnkit-cli express", label: "npm package" },
  { text: "pwnkit-cli ./my-repo", label: "source code" },
  { text: "pwnkit-cli https://api.com/chat", label: "LLM endpoint" },
];

// ── Main Component ──
export const DemoVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        fontFamily: outfit,
        color: C.white,
        overflow: "hidden",
      }}
    >
      {/* Subtle grid background */}
      <GridBackground />

      {/* Radial vignette for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Scene 1: Intro */}
      <Sequence from={0} durationInFrames={Math.floor(S.introEnd * fps)} layout="none">
        <IntroScene />
      </Sequence>

      {/* Scene 2: Command */}
      <Sequence from={Math.floor(S.cmdStart * fps)} durationInFrames={Math.floor((S.cmdEnd - S.cmdStart) * fps)} layout="none">
        <CommandScene />
      </Sequence>

      {/* Scene 3: Agents at Work */}
      <Sequence from={Math.floor(S.agentsStart * fps)} durationInFrames={Math.floor((S.agentsEnd - S.agentsStart) * fps)} layout="none">
        <AgentsScene />
      </Sequence>

      {/* Scene 4: Results */}
      <Sequence from={Math.floor(S.resultsStart * fps)} durationInFrames={Math.floor((S.resultsEnd - S.resultsStart) * fps)} layout="none">
        <ResultsScene />
      </Sequence>

      {/* Scene 5: Benchmark */}
      <Sequence from={Math.floor(S.benchStart * fps)} durationInFrames={Math.floor((S.benchEnd - S.benchStart) * fps)} layout="none">
        <BenchmarkScene />
      </Sequence>

      {/* Scene 6: CTA */}
      <Sequence from={Math.floor(S.ctaStart * fps)} durationInFrames={Math.floor((S.ctaEnd - S.ctaStart) * fps)} layout="none">
        <CTAScene />
      </Sequence>

      {/* Bottom progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: "rgba(220, 38, 38, 0.1)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(sec / S.ctaEnd) * 100}%`,
            backgroundColor: C.crimson,
            boxShadow: `0 0 8px ${C.crimson}`,
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Grid Background ──
const GridBackground = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  const opacity = interpolate(sec, [0, 1], [0, 0.04], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `
          linear-gradient(rgba(220,38,38,0.15) 1px, transparent 1px),
          linear-gradient(90deg, rgba(220,38,38,0.15) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
};

// ── Scene 1: INTRO ──
const IntroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // Logo scale with spring
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
    durationInFrames: 40,
  });

  // Logo opacity
  const logoOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text fade in (staggered)
  const titleOpacity = interpolate(sec, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(sec, [0.6, 1.0], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const taglineOpacity = interpolate(sec, [1.2, 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(sec, [1.2, 1.6], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Fade out at end of scene
  const fadeOut = interpolate(sec, [2.4, 3.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(sec * 3),
    [-1, 1],
    [0.2, 0.6],
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      {/* Animated Logo with glow */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: 24,
          width: 80,
          height: 80,
          position: "relative",
        }}
      >
        {/* Glow behind logo */}
        <div
          style={{
            position: "absolute",
            inset: -30,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.crimsonGlow} 0%, transparent 70%)`,
            opacity: glowIntensity,
          }}
        />
        <PwnkitIcon />
      </div>

      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 48,
          fontWeight: 700,
          color: C.white,
          letterSpacing: -1,
        }}
      >
        pwnkit
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontSize: 18,
          color: C.dimmed,
          marginTop: 12,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        Autonomous AI agents hack you so the real ones can't
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: THE COMMAND (auto-detect multi-target) ──
const CommandScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // Terminal window fades/slides in
  const terminalScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100, mass: 0.6 },
    durationInFrames: 25,
  });

  const terminalOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // "Just give it a target" header
  const headerOpacity = interpolate(sec, [0.3, 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Staggered command entries
  const cmdTimings = [
    { start: 0.8, typeEnd: 1.8 },
    { start: 2.0, typeEnd: 2.8 },
    { start: 3.0, typeEnd: 4.0 },
  ];

  // Fade out
  const fadeOut = interpolate(sec, [4.2, 5.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          width: 900,
          opacity: terminalOpacity,
          transform: `scale(${0.95 + terminalScale * 0.05})`,
        }}
      >
        {/* "Just give it a target" */}
        <div
          style={{
            opacity: headerOpacity,
            fontSize: 14,
            color: C.dimmed,
            textTransform: "uppercase",
            letterSpacing: 4,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Just give it a target
        </div>

        {/* Terminal chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 20px",
            backgroundColor: "#1a1a1a",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f56" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#27c93f" }} />
          <div style={{ flex: 1 }} />
          <span style={{ color: C.dimmed, fontSize: 13 }}>Terminal</span>
          <div style={{ flex: 1 }} />
        </div>

        {/* Terminal body with multiple commands */}
        <div
          style={{
            backgroundColor: C.bg,
            padding: "24px 28px",
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            border: `1px solid ${C.border}`,
            borderTop: "none",
            fontSize: 17,
            lineHeight: 2.2,
            whiteSpace: "pre",
          }}
        >
          {COMMANDS.map((cmd, i) => {
            const timing = cmdTimings[i];
            const lineOpacity = interpolate(sec, [timing.start, timing.start + 0.15], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const typeDur = timing.typeEnd - timing.start;
            const typeProgress = Math.min(1, Math.max(0, (sec - timing.start) / typeDur));
            const charsVisible = Math.floor(typeProgress * cmd.text.length);
            const showCursor = sec >= timing.start && typeProgress < 1 && Math.floor(frame / 8) % 2 === 0;

            return (
              <div key={i} style={{ opacity: lineOpacity, display: "flex", alignItems: "center" }}>
                <span style={{ color: C.green }}>{">"}</span>{" "}
                <span style={{ color: C.white }}>{cmd.text.slice(0, charsVisible)}</span>
                {showCursor && (
                  <span style={{ backgroundColor: C.crimson, color: C.bg, padding: "0 2px" }}>{" "}</span>
                )}
                {typeProgress >= 1 && (() => {
                  const labelAge = sec - timing.typeEnd;
                  const labelOpacity = interpolate(labelAge, [0, 0.25], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  const labelSlide = interpolate(labelAge, [0, 0.25], [8, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.cubic),
                  });
                  const labelScale = interpolate(labelAge, [0, 0.2], [0.85, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  return (
                    <span
                      style={{
                        marginLeft: 16,
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.crimson,
                        backgroundColor: "rgba(220, 38, 38, 0.12)",
                        border: `1px solid ${C.crimson}30`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        opacity: labelOpacity,
                        transform: `translateX(${labelSlide}px) scale(${labelScale})`,
                        display: "inline-block",
                      }}
                    >
                      {cmd.label}
                    </span>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 3: AGENTS AT WORK ──
type AgentLane = {
  name: string;
  icon: string;
  color: string;
  activateAt: number; // seconds into scene
  items: { text: string; isVuln?: boolean; isFalsePositive?: boolean; delay: number }[];
};

const lanes: AgentLane[] = [
  {
    name: "DISCOVER",
    icon: "01",
    color: C.blue,
    activateAt: 0.3,
    items: [
      { text: "Probing target...", delay: 0.5 },
      { text: "Extracting system prompt...", delay: 1.0 },
      { text: "Mapping API surface...", delay: 1.8 },
    ],
  },
  {
    name: "ATTACK",
    icon: "02",
    color: C.crimson,
    activateAt: 1.5,
    items: [
      { text: "Reading source code...", delay: 1.8 },
      { text: "Crafting payload...", delay: 2.4, isVuln: true },
      { text: "Analyzing response...", delay: 3.0, isVuln: true },
      { text: "Adapting strategy...", delay: 3.6, isVuln: true },
    ],
  },
  {
    name: "VERIFY",
    icon: "03",
    color: C.green,
    activateAt: 3.0,
    items: [
      { text: "Re-exploiting finding...", delay: 3.3 },
      { text: "Reproducing independently...", delay: 3.8 },
      { text: "Confirmed: exploitable", delay: 4.3, isVuln: true },
    ],
  },
  {
    name: "REPORT",
    icon: "04",
    color: C.orange,
    activateAt: 4.5,
    items: [
      { text: "Generating SARIF...", delay: 4.7 },
      { text: "Building evidence chain...", delay: 5.1 },
    ],
  },
];

const AgentsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // Fade in
  const fadeIn = interpolate(sec, [0, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out
  const fadeOut = interpolate(sec, [5.2, 6.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: fadeIn * fadeOut,
        display: "flex",
        flexDirection: "column",
        padding: "40px 50px",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 14,
          color: C.dimmed,
          textTransform: "uppercase",
          letterSpacing: 4,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        Agents at work
      </div>

      {/* 4 Lanes with flow arrows */}
      <div
        style={{
          display: "flex",
          gap: 0,
          flex: 1,
          alignItems: "stretch",
        }}
      >
        {lanes.map((lane, idx) => (
          <div key={lane.name} style={{ display: "flex", flex: 1, alignItems: "stretch" }}>
            <div style={{ flex: 1 }}>
              <LaneColumn lane={lane} sec={sec} fps={fps} frame={frame} index={idx} />
            </div>
            {idx < lanes.length - 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  flexShrink: 0,
                }}
              >
                <FlowArrow
                  sec={sec}
                  activateAt={lanes[idx + 1].activateAt}
                  color={lanes[idx + 1].color}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const LaneColumn = ({
  lane,
  sec,
  fps,
  frame,
  index,
}: {
  lane: AgentLane;
  sec: number;
  fps: number;
  frame: number;
  index: number;
}) => {
  const isActive = sec >= lane.activateAt;

  // Lane header glow when active
  const headerGlow = isActive
    ? interpolate(
        sec,
        [lane.activateAt, lane.activateAt + 0.5],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  // Pulse effect on activation
  const pulseOpacity = isActive
    ? interpolate(
        sec,
        [lane.activateAt, lane.activateAt + 0.3, lane.activateAt + 0.6],
        [0, 0.15, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 0;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: isActive ? C.laneActive : "transparent",
        border: `1px solid ${isActive ? lane.color + "40" : C.border}`,
        borderRadius: 10,
        padding: 16,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s",
      }}
    >
      {/* Activation flash */}
      {pulseOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: lane.color,
            opacity: pulseOpacity,
            borderRadius: 10,
          }}
        />
      )}

      {/* Lane Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="12" fill="none" stroke={isActive ? lane.color : C.dimmed} strokeWidth="1.5" opacity={0.4 + headerGlow * 0.6} />
            <text x="14" y="18" textAnchor="middle" fill={isActive ? lane.color : C.dimmed} fontSize="11" fontFamily={spaceMono} fontWeight="700" opacity={0.4 + headerGlow * 0.6}>{lane.icon}</text>
          </svg>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isActive ? lane.color : C.dimmed,
            letterSpacing: 2,
            opacity: 0.4 + headerGlow * 0.6,
          }}
        >
          {lane.name}
        </div>
      </div>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lane.items.map((item, i) => {
          const visible = sec >= item.delay;
          if (!visible) return null;

          const itemAge = sec - item.delay;
          const itemOpacity = Math.min(1, itemAge / 0.2);
          const itemSlide = interpolate(itemAge, [0, 0.2], [10, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Red flash for vulns
          const vulnFlash =
            item.isVuln && itemAge < 0.4
              ? interpolate(itemAge, [0, 0.15, 0.4], [0.3, 0.5, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;

          return (
            <div
              key={i}
              style={{
                opacity: itemOpacity,
                transform: `translateY(${itemSlide}px)`,
                fontSize: 11,
                padding: "5px 8px",
                borderRadius: 5,
                backgroundColor: item.isVuln
                  ? "rgba(220, 38, 38, 0.15)"
                  : item.isFalsePositive
                    ? "rgba(107, 114, 128, 0.1)"
                    : "rgba(255, 255, 255, 0.04)",
                color: item.isVuln
                  ? C.crimson
                  : item.isFalsePositive
                    ? C.dimmed
                    : C.white,
                textDecoration: item.isFalsePositive ? "line-through" : "none",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Flash overlay */}
              {vulnFlash > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: C.crimson,
                    opacity: vulnFlash,
                    borderRadius: 5,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>
                {item.isVuln ? "\u{26A0} " : item.isFalsePositive ? "\u{2717} " : ""}
                {item.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Activity indicator */}
      {isActive && sec < lane.activateAt + 5 && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
          }}
        >
          <ActivityBar color={lane.color} sec={sec} startAt={lane.activateAt} />
        </div>
      )}
    </div>
  );
};

const ActivityBar = ({
  color,
  sec,
  startAt,
}: {
  color: string;
  sec: number;
  startAt: number;
}) => {
  const elapsed = sec - startAt;
  const progress = Math.min(1, elapsed / 4);

  return (
    <div
      style={{
        height: 3,
        backgroundColor: color + "20",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          backgroundColor: color,
          borderRadius: 2,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
};

const FlowArrow = ({
  sec,
  activateAt,
  color,
}: {
  sec: number;
  activateAt: number;
  color: string;
}) => {
  const opacity = interpolate(sec, [activateAt - 0.2, activateAt + 0.3], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const slideX = interpolate(sec, [activateAt - 0.2, activateAt + 0.3], [-4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${slideX}px)`,
        color,
        fontSize: 16,
        fontWeight: 700,
        textShadow: `0 0 6px ${color}`,
      }}
    >
      {"\u203A"}
    </div>
  );
};

// ── Scene 4: RESULTS ──
const ResultsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // Terminal slides up
  const slideUp = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.7 },
    durationInFrames: 30,
  });

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(sec, [3.2, 4.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Staggered badge entries
  const badge1 = Math.min(1, Math.max(0, (sec - 0.6) / 0.3));
  const badge2 = Math.min(1, Math.max(0, (sec - 0.9) / 0.3));
  const badge3 = Math.min(1, Math.max(0, (sec - 1.2) / 0.3));
  const statsOpacity = Math.min(1, Math.max(0, (sec - 1.8) / 0.4));

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      <div
        style={{
          width: 700,
          transform: `translateY(${(1 - slideUp) * 40}px)`,
        }}
      >
        {/* Terminal chrome */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 20px",
            backgroundColor: "#1a1a1a",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f56" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#ffbd2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#27c93f" }} />
          <div style={{ flex: 1 }} />
          <span style={{ color: C.dimmed, fontSize: 13 }}>Scan Results</span>
          <div style={{ flex: 1 }} />
        </div>

        {/* Results body */}
        <div
          style={{
            backgroundColor: C.bg,
            padding: "32px 40px",
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            border: `1px solid ${C.border}`,
            borderTop: "none",
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: 13,
              color: C.dimmed,
              textTransform: "uppercase",
              letterSpacing: 3,
              marginBottom: 28,
            }}
          >
            Scan Complete
          </div>

          {/* Severity badges */}
          <div
            style={{
              display: "flex",
              gap: 20,
              marginBottom: 32,
            }}
          >
            <SeverityBadge
              count={3}
              label="Critical"
              color={C.crimson}
              bgColor="rgba(220, 38, 38, 0.15)"
              opacity={badge1}
            />
            <SeverityBadge
              count={1}
              label="High"
              color={C.orange}
              bgColor="rgba(249, 115, 22, 0.15)"
              opacity={badge2}
            />
            <SeverityBadge
              count={1}
              label="Medium"
              color={C.yellow}
              bgColor="rgba(234, 179, 8, 0.15)"
              opacity={badge3}
            />
          </div>

          {/* Stats line */}
          <div
            style={{
              opacity: statsOpacity,
              fontSize: 16,
              color: C.dimmed,
              borderTop: `1px solid ${C.border}`,
              paddingTop: 20,
              display: "flex",
              gap: 24,
            }}
          >
            <span>
              <span style={{ color: C.white, fontWeight: 700 }}>5</span> findings
            </span>
            <span style={{ color: C.border }}>|</span>
            <span>
              <span style={{ color: C.green, fontWeight: 700 }}>5</span> blind-verified
            </span>
            <span style={{ color: C.border }}>|</span>
            <span>
              <span style={{ color: C.crimson, fontWeight: 700 }}>0</span> false positives
            </span>
            <span style={{ color: C.border }}>|</span>
            <span>
              <span style={{ color: C.white, fontWeight: 700 }}>12.4s</span>
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SeverityBadge = ({
  count,
  label,
  color,
  bgColor,
  opacity,
}: {
  count: number;
  label: string;
  color: string;
  bgColor: string;
  opacity: number;
}) => {
  const scale = interpolate(opacity, [0, 0.5, 1], [0.8, 1.05, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        backgroundColor: bgColor,
        border: `1px solid ${color}40`,
        borderRadius: 10,
        padding: "14px 24px",
      }}
    >
      <span style={{ fontSize: 32, fontWeight: 700, color }}>{count}</span>
      <span style={{ fontSize: 14, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
    </div>
  );
};

// ── Scene 5: BENCHMARK ──
const benchmarkCategories = [
  { name: "Direct Prompt Injection", difficulty: "easy" },
  { name: "System Prompt Extraction", difficulty: "easy" },
  { name: "PII Data Leakage", difficulty: "easy" },
  { name: "Base64 Encoding Bypass", difficulty: "medium" },
  { name: "DAN Jailbreak", difficulty: "medium" },
  { name: "SSRF via MCP Tool", difficulty: "medium" },
  { name: "Multi-Turn Escalation", difficulty: "hard" },
  { name: "CORS Misconfiguration", difficulty: "easy" },
  { name: "Sensitive Path Exposure", difficulty: "easy" },
  { name: "Indirect Prompt Injection", difficulty: "hard" },
];

const BenchmarkScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(sec, [3.2, 4.0], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Big "100%" counter animation
  const countProgress = interpolate(sec, [0.3, 1.5], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const headerOpacity = interpolate(sec, [0.2, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Staggered checkmarks for each category
  const checkStartTime = 0.8;
  const checkInterval = 0.15;

  // "0 false positives" callout
  const fpOpacity = interpolate(sec, [2.4, 2.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fpScale = interpolate(sec, [2.4, 2.7], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
        {/* Left: Big stat */}
        <div style={{ textAlign: "center", minWidth: 280 }}>
          <div
            style={{
              opacity: headerOpacity,
              fontSize: 14,
              color: C.dimmed,
              textTransform: "uppercase",
              letterSpacing: 4,
              marginBottom: 12,
            }}
          >
            AI/LLM Benchmark
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: C.green,
              lineHeight: 1,
              fontFamily: spaceMono,
            }}
          >
            {Math.round(countProgress)}%
          </div>
          <div
            style={{
              fontSize: 18,
              color: C.dimmed,
              marginTop: 8,
            }}
          >
            <span style={{ color: C.white, fontWeight: 700 }}>10</span>/10 detection &bull;{" "}
            <span style={{ color: C.white, fontWeight: 700 }}>10</span>/10 flag extraction
          </div>

          {/* Zero false positives badge */}
          <div
            style={{
              opacity: fpOpacity,
              transform: `scale(${fpScale})`,
              marginTop: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: `1px solid ${C.green}40`,
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 15,
              fontWeight: 700,
              color: C.green,
            }}
          >
            0 false positives
          </div>
        </div>

        {/* Right: Category checklist with PASS badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {benchmarkCategories.map((cat, i) => {
            const checkTime = checkStartTime + i * checkInterval;
            const checkOpacity = interpolate(sec, [checkTime, checkTime + 0.1], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const checkSlide = interpolate(sec, [checkTime, checkTime + 0.15], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const diffColor =
              cat.difficulty === "hard" ? C.crimson : cat.difficulty === "medium" ? C.orange : C.dimmed;

            return (
              <div
                key={i}
                style={{
                  opacity: checkOpacity,
                  transform: `translateX(${checkSlide}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 15,
                  padding: "3px 0",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.green,
                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                    border: `1px solid ${C.green}40`,
                    borderRadius: 3,
                    padding: "1px 6px",
                    letterSpacing: 1,
                    fontFamily: spaceMono,
                  }}
                >
                  PASS
                </span>
                <span style={{ color: C.white }}>{cat.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: diffColor,
                    opacity: 0.8,
                    backgroundColor: `${diffColor}15`,
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  {cat.difficulty}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 6: CTA ──
const CTAScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.8 },
    durationInFrames: 30,
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cmdOpacity = interpolate(sec, [0.6, 1.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cmdY = interpolate(sec, [0.6, 1.0], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const urlOpacity = interpolate(sec, [1.2, 1.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeOpacity = interpolate(sec, [1.6, 2.0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow pulse
  const glowIntensity = interpolate(
    Math.sin(sec * 2.5),
    [-1, 1],
    [0.2, 0.5],
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      {/* Animated Logo with glow */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          marginBottom: 16,
          width: 120,
          height: 120,
          position: "relative",
        }}
      >
        {/* Glow behind logo */}
        <div
          style={{
            position: "absolute",
            inset: -40,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.crimsonGlow} 0%, transparent 70%)`,
            opacity: glowIntensity,
          }}
        />
        <PwnkitIcon />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: cmdOpacity,
          transform: `translateY(${cmdY}px)`,
          fontSize: 16,
          color: C.dimmed,
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        Fully autonomous agentic pentesting framework
      </div>

      {/* Command */}
      <div
        style={{
          opacity: cmdOpacity,
          fontSize: 20,
          padding: "14px 32px",
          backgroundColor: "rgba(220, 38, 38, 0.1)",
          border: `1px solid ${C.crimson}40`,
          borderRadius: 10,
          color: C.white,
        }}
      >
        <span style={{ color: C.green }}>{">"}</span>{" "}
        npx pwnkit-cli{" "}
        <span style={{ color: C.crimson }}>{"<target>"}</span>
      </div>

      {/* URLs */}
      <div
        style={{
          opacity: urlOpacity,
          display: "flex",
          gap: 24,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 28, fontWeight: 700, color: C.crimson }}>
          pwnkit.com
        </span>
        <span style={{ color: C.border }}>|</span>
        <span style={{ fontSize: 18, color: C.dimmed }}>
          docs.pwnkit.com
        </span>
      </div>

      {/* Action badges */}
      <div
        style={{
          opacity: badgeOpacity,
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#1a1a1a",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
          }}
        >
          <span style={{ color: C.green, fontFamily: spaceMono, fontWeight: 700 }}>npm i</span>
          <span style={{ color: C.white }}>pwnkit-cli</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#1a1a1a",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 14,
          }}
        >
          <span style={{ color: C.yellow }}>{"★"}</span>
          <span style={{ color: C.white, fontWeight: 700 }}>Star on GitHub</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

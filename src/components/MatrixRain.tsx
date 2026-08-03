import { useMemo } from "react";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFZ";

function column(seed: number, length: number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += GLYPHS[(seed * 7 + i * 13 + (i % 5) * 31) % GLYPHS.length];
  }
  return out;
}

/**
 * Very faint, slow digital rain. Pure CSS transforms, no canvas loop.
 */
export function MatrixRain() {
  const columns = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i / 26) * 100 + (i % 3) * 0.4,
        duration: 26 + ((i * 7) % 22),
        delay: -((i * 5) % 30),
        text: column(i + 3, 34),
      })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {columns.map((c, i) => (
        <div
          key={i}
          className="terminal absolute top-0 text-[11px] leading-[1.25] text-primary"
          style={{
            left: `${c.left}%`,
            opacity: 0.055,
            writingMode: "vertical-rl",
            animation: `rain-fall ${c.duration}s linear ${c.delay}s infinite`,
          }}
        >
          {c.text}
        </div>
      ))}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.22) 3px)",
          opacity: 0.35,
        }}
      />
    </div>
  );
}

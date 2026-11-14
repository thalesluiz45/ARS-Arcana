export function ArcaneCircle({ className }: { className?: string }) {
  // Coordinates are rounded because server and client engines can serialize
  // floating point trig results differently, which breaks hydration.
  const dots = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 12 - Math.PI / 2;
    return {
      cx: Math.round((160 + Math.cos(angle) * 146) * 100) / 100,
      cy: Math.round((160 + Math.sin(angle) * 146) * 100) / 100,
      r: index % 3 === 0 ? 2.6 : 1.6,
    };
  });

  return (
    <svg
      viewBox="0 0 320 320"
      role="presentation"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle cx="160" cy="160" r="156" stroke="currentColor" strokeOpacity="0.16" />
      <circle cx="160" cy="160" r="148" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.8" />
      <circle
        cx="160"
        cy="160"
        r="128"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.8"
        strokeDasharray="2 6"
      />
      <circle cx="160" cy="160" r="92" stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.8" />
      <circle cx="160" cy="160" r="84" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.7" />
      {dots.map((dot, index) => (
        <circle key={index} cx={dot.cx} cy={dot.cy} r={dot.r} fill="currentColor" fillOpacity="0.7" />
      ))}

      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M160 132c-9-6-21-9-33-9-5 0-10 0.6-14 1.8v47.4c4-1.2 9-1.8 14-1.8 12 0 24 3 33 9V132Z" />
        <path d="M160 132c9-6 21-9 33-9 5 0 10 0.6 14 1.8v47.4c-4-1.2-9-1.8-14-1.8-12 0-24 3-33 9V132Z" />
        <path d="M160 132v47.4" />
        <path d="M137 141c4-0.5 8-0.3 12 0.7M137 150c4-0.5 8-0.3 12 0.7M137 159c4-0.5 8-0.3 12 0.7" strokeOpacity="0.6" strokeWidth="0.9" />
        <path d="M183 141c-4-0.5-8-0.3-12 0.7M183 150c-4-0.5-8-0.3-12 0.7M183 159c-4-0.5-8-0.3-12 0.7" strokeOpacity="0.6" strokeWidth="0.9" />
      </g>

      <g stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.8">
        <path d="M160 8v10M160 302v10M8 160h10M302 160h10" />
        <path d="M53 53l7 7M260 260l7 7M53 267l7-7M260 60l7-7" strokeOpacity="0.35" />
      </g>

      <text
        x="160"
        y="238"
        textAnchor="middle"
        fill="currentColor"
        fillOpacity="0.8"
        fontFamily="var(--font-serif), Georgia, serif"
        fontSize="10"
        letterSpacing="3.6"
      >
        ARS ARCANA
      </text>
    </svg>
  );
}

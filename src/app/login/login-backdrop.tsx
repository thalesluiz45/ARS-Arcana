function CastleSilhouette() {
  return (
    <svg
      viewBox="0 0 900 420"
      preserveAspectRatio="xMinYMax slice"
      aria-hidden="true"
      className="absolute bottom-0 left-0 h-[44%] w-[92%] text-[#081f19] sm:h-[48%] lg:left-[30%] lg:h-[42%] lg:w-[64%]"
    >
      <path
        fill="currentColor"
        d="M0 420V338c54-20 88-10 132-36 46-28 74-14 120-44 38-25 76-18 116-42 44-27 78-15 124-38 42-21 78-15 124-33 40-16 86-10 126-28 36-16 78-11 118-21V420Z"
      />
      <g fill="#0a241d">
        <path d="M292 320V220h42v100z" />
        <path d="M284 220l29-50 29 50z" />
        <path d="M350 320V185h58v135z" />
        <path d="M340 185l39-67 39 67z" />
        <path d="M430 320V150h120v170z" />
        <path d="M418 150l72-78 72 78z" />
        <path d="M572 320V175h64v145z" />
        <path d="M560 175l44-71 44 71z" />
        <path d="M660 320V215h46v105z" />
        <path d="M652 215l31-50 31 50z" />
        <path d="M390 320v-65h250v65z" />
      </g>
      <g fill="#0a241d">
        <path d="M404 255h12v18h-12zM424 255h12v18h-12zM444 255h12v18h-12zM584 255h12v18h-12zM604 255h12v18h-12z" />
        <path d="M365 230h10v16h-10zM383 230h10v16h-10z" />
        <path d="M590 220h10v16h-10zM610 220h10v16h-10z" />
        <path d="M306 260h9v14h-9z" />
        <path d="M676 258h9v14h-9z" />
      </g>
      <g fill="#c8a35a" fillOpacity="0.55">
        <path d="M444 190h10v18h-10zM470 178h10v18h-10zM498 190h10v18h-10z" />
        <path d="M456 224h12v16h-12zM492 224h12v16h-12z" />
        <path d="M367 205h8v14h-8zM385 219h8v14h-8z" />
        <path d="M590 198h8v14h-8zM608 212h8v14h-8z" />
        <path d="M308 246h7v12h-7z" />
        <path d="M678 244h7v12h-7z" />
      </g>
      <path fill="#0a241d" d="M418 320v-18c0-16 13-29 29-29h58c16 0 29 13 29 29v18z" />
      <path fill="#071c17" d="M452 320v-22c0-13 10-24 24-24s24 11 24 24v22z" />
      <g fill="#081f19">
        <path d="M170 340c18-46 36-46 54 0zM204 348c14-36 28-36 42 0z" />
        <path d="M740 336c18-46 36-46 54 0zM774 344c14-36 28-36 42 0z" />
        <path d="M236 352c12-30 24-30 36 0zM690 350c12-30 24-30 36 0z" />
      </g>
      <path fill="#071c17" d="M0 420v-52c68-12 120 12 188-2 66-14 126 10 192-2 70-13 128 9 198-4 66-13 124 8 190-2 48-8 92-2 132 4V420Z" />
    </svg>
  );
}

export function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,#1d4b3e_0%,#12362d_42%,#0a251f_100%)]" />

      <svg
        viewBox="0 0 600 600"
        fill="none"
        className="absolute -left-44 -top-52 size-[560px] text-gold/35 sm:-left-36 sm:-top-44 sm:size-[640px]"
      >
        <circle cx="300" cy="300" r="292" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.55" />
        <circle
          cx="300"
          cy="300"
          r="248"
          stroke="currentColor"
          strokeWidth="0.7"
          strokeOpacity="0.35"
          strokeDasharray="2 8"
        />
        <circle cx="300" cy="300" r="194" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.22" />
        <path d="M300 8v18M300 574v18M8 300h18M574 300h18" stroke="currentColor" strokeOpacity="0.5" />
      </svg>

      <svg
        viewBox="0 0 700 700"
        fill="none"
        className="absolute -right-56 -top-64 size-[640px] text-gold/25 sm:-right-48 sm:-top-56 sm:size-[760px]"
      >
        <circle cx="350" cy="350" r="340" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="350" cy="350" r="296" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1 9" />
        <circle cx="350" cy="350" r="236" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.5" />
      </svg>

      <svg
        viewBox="0 0 640 640"
        fill="none"
        className="absolute -bottom-72 -left-60 size-[600px] text-gold/20 sm:size-[680px]"
      >
        <circle cx="320" cy="320" r="310" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="320" cy="320" r="268" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2 10" />
      </svg>

      <span className="absolute left-[7%] top-[12%] size-1.5 rotate-45 bg-gold/70" />
      <span className="absolute left-[17%] top-[7%] size-1 rotate-45 bg-gold/45" />
      <span className="absolute right-[8%] top-[9%] size-1.5 rotate-45 bg-gold/60" />
      <span className="absolute right-[20%] top-[19%] size-1 rotate-45 bg-gold/40" />
      <span className="absolute bottom-[16%] left-[9%] size-1.5 rotate-45 bg-gold/50" />
      <span className="absolute bottom-[8%] left-[22%] size-1 rotate-45 bg-gold/35" />

      <CastleSilhouette />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(4_18_14/0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#071c17] to-transparent" />
    </div>
  );
}

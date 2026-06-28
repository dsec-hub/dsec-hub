// Minimal inline icon set (no dependency). 1.5px stroke, currentColor, 18px.

type IconProps = { className?: string };

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icons = {
  overview: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  events: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  people: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.5a3.2 3.2 0 0 1 0 6.4M18 20c0-2.5-1-4.3-2.5-5.4" />
    </svg>
  ),
  sponsors: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 17l-4.9 1.2.9-5.5-4-3.9 5.5-.8z" />
    </svg>
  ),
  finance: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9 9.5 12 10s5 1.3 5 3.5-2.2 3.5-5 3.5-5-1.1-5-3" />
    </svg>
  ),
  partners: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="8.5" cy="12" r="6" />
      <circle cx="15.5" cy="12" r="6" />
    </svg>
  ),
  admin: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z" />
      <path d="M9.5 12l1.8 1.8 3.2-3.6" />
    </svg>
  ),
  menu: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  collapse: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  chevron: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  clock: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  signout: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 12H3m0 0l3-3m-3 3l3 3" />
    </svg>
  ),
  dashboard: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M3 13a9 9 0 0 1 18 0" />
      <path d="M12 13l4-3" />
      <circle cx="12" cy="13" r="1.4" />
    </svg>
  ),
  tasks: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  ),
  projects: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 12l9 4 9-4M3 17l9 4 9-4" />
    </svg>
  ),
  members: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-6.4 7-6.4s7 2.8 7 6.4" />
    </svg>
  ),
  meetings: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  ),
  documents: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 13h6M9 17h6" />
    </svg>
  ),
  settings: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  copy: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  ),
  camera: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M3 9a2 2 0 0 1 2-2h1.5l1-2h5l1 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  ),
  link: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.5l1.3-1.3a3.5 3.5 0 0 1 5 5L16 11.5" />
      <path d="M13 17.5l-1.3 1.3a3.5 3.5 0 0 1-5-5L8 12.5" />
    </svg>
  ),
  arrowRight: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  grip: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  ),
  eye: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  eyeOff: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-3.2 4.2M6.6 6.6A18.4 18.4 0 0 0 2 12s3.5 7 10 7a10.5 10.5 0 0 0 4.1-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  ),
  trash: (p: IconProps) => (
    <svg {...base} className={p.className} aria-hidden>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
};

export type IconName = keyof typeof Icons;

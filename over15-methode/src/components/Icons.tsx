import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconHome = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);

export const IconTarget = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const IconTrophy = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
    <path d="M12 14v3.5M8.5 20.5h7M9.5 17.5h5" />
  </svg>
);

export const IconList = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </svg>
);

export const IconGear = ({ size = 24, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

export const IconCheck = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2.6, ...p })}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconX = ({ size = 18, ...p }: P) => (
  <svg {...base(size, { strokeWidth: 2.6, ...p })}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconAlert = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3.5 2.5 20h19L12 3.5Z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.3" r=".6" fill="currentColor" />
  </svg>
);

export const IconInfo = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r=".6" fill="currentColor" />
  </svg>
);

export const IconStop = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3Z" />
    <path d="M8 12h8" />
  </svg>
);

export const IconChevronLeft = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const IconChevronRight = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconPlus = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconExternal = ({ size = 16, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const IconRefresh = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M20 11a8 8 0 0 0-14.7-4.3L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 13a8 8 0 0 0 14.7 4.3l1.3-1.8" />
    <path d="M20 20v-4.5h-4.5" />
  </svg>
);

export const IconTrash = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const IconUpload = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const IconDownload = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);

export const IconBolt = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const IconFlask = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" />
    <path d="M7 15h10" />
  </svg>
);

export const IconWallet = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7a2 2 0 0 1 2-2h11v4" />
    <path d="M4 7v11a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Z" />
    <circle cx="16" cy="14.5" r="1.2" fill="currentColor" />
  </svg>
);

export const IconShield = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconCloud = ({ size = 18, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18H7Z" />
  </svg>
);

export const IconCopy = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="8" y="8" width="12" height="13" rx="2" />
    <path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" />
  </svg>
);

export const IconPaste = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 11h6M9 15h4" />
  </svg>
);

export const IconPlay = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconBook = ({ size = 22, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </svg>
);

export const IconSpark = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
  </svg>
);

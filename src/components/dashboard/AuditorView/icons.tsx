/**
 * icons.tsx
 *
 * A small, self-contained stroke-icon set for the Auditor Portal. Matches the
 * geometric, currentColor-stroke style already used in PdfViewer.tsx's own
 * inline icons, so the auditor experience feels visually continuous with the
 * rest of the Regnix document workspace. No external icon library dependency.
 *
 * Usage: <IconCheck size={14} />  — size defaults to 16, stroke to currentColor.
 */

import type { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function base(size: number | undefined, props: SVGProps<SVGSVGElement>) {
  return {
    width: size ?? 16,
    height: size ?? 16,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

export const IconScale = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 3v18M7 21h10M5 7l-3 6a3 3 0 006 0l-3-6zM19 7l-3 6a3 3 0 006 0l-3-6zM5 7h14M12 3l-2 4h4l-2-4z" />
  </svg>
);

export const IconHome = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </svg>
);

export const IconInbox = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M3 12h4.5l1.5 3h6l1.5-3H21" />
    <path d="M5.5 5h13l2.5 7v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l2.5-7z" />
  </svg>
);

export const IconEye = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconCheckCircle = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.3 2.3L16 10" />
  </svg>
);

export const IconUndo = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M4 10h10a5 5 0 0 1 0 10h-2" />
    <path d="M8 5 4 10l4 5" />
  </svg>
);

export const IconXCircle = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9.5 9.5 5 5m0-5-5 5" />
  </svg>
);

export const IconFolder = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6.5z" />
  </svg>
);

export const IconFileText = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </svg>
);

export const IconAlertTriangle = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 3.5 22 20H2L12 3.5z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconShieldCheck = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M12 3 4.5 6v6c0 4.6 3.2 7.9 7.5 9 4.3-1.1 7.5-4.4 7.5-9V6L12 3z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const IconSearch = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.35-4.35" />
  </svg>
);

export const IconChevronDown = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronRight = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconBell = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
);

export const IconLogOut = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M15 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" />
    <path d="M10 12h11m0 0-3.5-3.5M21 12l-3.5 3.5" />
  </svg>
);

export const IconArrowLeft = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
  </svg>
);

export const IconBuilding = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <rect x="4" y="3" width="12" height="18" rx="1" />
    <path d="M20 21V9l-4-2" />
    <path d="M7.5 7h1M11.5 7h1M7.5 11h1M11.5 11h1M7.5 15h1M11.5 15h1" />
  </svg>
);

export const IconUsers = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 8.5a3 3 0 1 1 0 6" />
    <path d="M15.5 13.3c2 .4 3.5 1.7 4 3.9" />
  </svg>
);

export const IconClock = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

export const IconFlag = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M5 3v18" />
    <path d="M5 4h11l-2.2 3.5L16 11H5" />
  </svg>
);

export const IconLayers = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3z" />
    <path d="m3 12 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </svg>
);

export const IconPenLine = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M4 20.5h4L18.5 10a2.1 2.1 0 0 0-3-3L5 17.5v3z" />
    <path d="M13 5.5 18.5 11" />
  </svg>
);

export const IconExternalLink = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M10 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
  </svg>
);

export const IconTable = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15" />
  </svg>
);

export const IconSpinner = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)} style={{ animation: 'ar-spin 0.8s linear infinite' }}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const IconEmptyBox = ({ size, ...p }: IconProps) => (
  <svg {...base(size, p)}>
    <path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4z" />
    <path d="M3.5 8v8L12 20l8.5-4V8" />
    <path d="M12 12v8" />
  </svg>
);

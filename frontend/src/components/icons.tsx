import type { SVGProps } from "react";

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const LogoutIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M15 12H4" />
    <path d="M8 8l-4 4 4 4" />
    <path d="M11 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6" />
  </svg>
);

export const SendIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M5 12l15-7-7 15-2-6-6-2z" />
  </svg>
);

export const SparkleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" />
    <path d="M19 14l.7 1.8L21.5 16.5 19.7 17.2 19 19l-.7-1.8L16.5 16.5 18.3 15.8 19 14z" />
  </svg>
);

export const EditIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const BoardIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </svg>
);

export const UsersIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" />
    <path d="M16 4.5a3 3 0 0 1 0 6M20 20c0-2.5-1.5-4.3-3.5-4.8" />
  </svg>
);

export const HistoryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3" />
    <path d="M12 8v4l3 2" />
  </svg>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const FilterIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...baseProps} {...props}>
    <path d="M4 5h16l-6 8v5l-4 2v-7L4 5z" />
  </svg>
);

import type { CSSProperties } from 'react';

const paths = {
  leaf: 'M20 4C10 3 3 7 5 15c8 3 14-2 15-11ZM4 21 15 10M9 16l-1-5m5 1 5 1',
  book: 'M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z',
  walk: 'M14 3a1.5 1.5 0 1 0 0 .1M10 22l2-7 3 3 1 4M7 13l2-5 4-1 3 5 4 1M13 7l-1 8M5 22l2-6',
  people:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3',
  plus: 'M12 5v14M5 12h14',
  search: 'M20 20l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z',
  arrow: 'M19 12H5m6-6-6 6 6 6',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5Zm7 4v2',
  check: 'm5 12 4 4L20 5',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-4-4L5 15ZM4 20h15',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  close: 'm6 6 12 12M6 18 18 6',
  info: 'M12 11v6m0-10v1M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  calendar: 'M4 5h16v16H4ZM4 10h16M8 2v6m8-6v6',
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}

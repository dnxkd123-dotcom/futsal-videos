/** 사이트 컨셉(굵은 검정 윤곽선)에 맞춘 단색 선 아이콘 — 글자 색(currentColor)을 따라간다 */
const SHAPES = {
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.2 1-3.6 2.3-4.8.2 1.6.9 2.6 2 3 0-3-.8-5.2.7-8.7z" />,
  // 하이라이트 종류
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8l3.5 2.5-1.3 4.1H9.8l-1.3-4.1z" />
      <path d="M12 8V3M15.5 10.5 20 9M14.2 14.6l2.8 3.9M9.8 14.6 7 18.5M8.5 10.5 4 9" />
    </>
  ),
  net: (
    <>
      <path d="M3 19V8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v11" />
      <path d="M8 7v12M12 7v12M16 7v12M3 13h18" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />,
  pass: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  card: <rect x="7" y="4" width="10" height="16" rx="2" />,
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-10a6 6 0 1 1 12 0c0 4.5-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  )
};

export default function Icon({ name, size = 16, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[name] ?? SHAPES.pin}
    </svg>
  );
}

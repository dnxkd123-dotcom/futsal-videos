/** 할로윈 시즌 장식 — 목록 맨 위의 밤하늘 배너 (달 · 박쥐 · 거미 · 호박등) */

// 박쥐 실루엣 하나. 날개만 따로 펄럭이도록 몸통과 날개를 나눴다
function Bat({ className }) {
  return (
    <svg className={`bat ${className}`} viewBox="0 0 64 32" aria-hidden="true">
      <g className="bat__wing bat__wing--l">
        <path d="M30 12C26 7 16 4 3 8c7 1 9 4 9 9 4-3 8-2 10 2 2-3 5-3 7 0z" />
      </g>
      <g className="bat__wing bat__wing--r">
        <path d="M34 12c4-5 14-8 27-4-7 1-9 4-9 9-4-3-8-2-10 2-2-3-5-3-7 0z" />
      </g>
      <path d="M32 9c-1-3-3-4-4-4 1 2 1 4 0 5 1 4 2 7 4 8 2-1 3-4 4-8-1-1-1-3 0-5-1 0-3 1-4 4z" />
    </svg>
  );
}

function Pumpkin() {
  return (
    <svg className="pumpkin" viewBox="0 0 120 104" aria-hidden="true">
      <defs>
        <radialGradient id="pk-body" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#ffa149" />
          <stop offset="0.6" stopColor="#f2731c" />
          <stop offset="1" stopColor="#b8480b" />
        </radialGradient>
        <radialGradient id="pk-light" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#ffb52e" />
        </radialGradient>
      </defs>
      <path d="M57 26c0-9 3-15 10-19l4 4c-5 3-7 8-7 15z" fill="#4d6b2a" />
      <ellipse cx="36" cy="64" rx="27" ry="34" fill="url(#pk-body)" />
      <ellipse cx="84" cy="64" rx="27" ry="34" fill="url(#pk-body)" />
      <ellipse cx="60" cy="64" rx="28" ry="37" fill="url(#pk-body)" />
      <path d="M60 28c-6 10-6 62 0 72M60 28c6 10 6 62 0 72" fill="none" stroke="#a8420a" strokeOpacity="0.45" strokeWidth="1.5" />
      <g className="pumpkin__face" fill="url(#pk-light)">
        <path d="M33 58h15l-7-12z" />
        <path d="M72 58h15l-7-12z" />
        <path d="M56 67h8l-4-6z" />
        <path d="M30 74c9 14 51 14 60 0l-7 2-3-5-5 6-5-5-5 6-5-6-5 5-5-6-3 5z" />
      </g>
    </svg>
  );
}

// 가는 선 거미줄 — 배너 왼쪽 위 모서리
function Web() {
  return (
    <svg className="web" viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        <path d="M0 0L120 8M0 0L100 60M0 0L60 104M0 0L8 120" />
        <path d="M24 2Q20 14 22 22Q14 22 2 24" />
        <path d="M48 4Q40 26 44 44Q26 42 4 48" />
        <path d="M74 5Q62 40 66 66Q40 62 5 74" />
        <path d="M100 7Q84 54 88 88Q54 84 7 100" />
      </g>
    </svg>
  );
}

function Spider() {
  return (
    <div className="spider" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M16 18L6 10L2 14M16 21L4 20L1 25M17 24L7 30L5 36M24 18L34 10L38 14M24 21L36 20L39 25M23 24L33 30L35 36" />
        </g>
        <ellipse cx="20" cy="17" rx="4" ry="4" fill="currentColor" />
        <ellipse cx="20" cy="25" rx="6" ry="7" fill="currentColor" />
        <circle cx="18.4" cy="16.4" r="0.9" fill="#ff7a2e" />
        <circle cx="21.6" cy="16.4" r="0.9" fill="#ff7a2e" />
      </svg>
    </div>
  );
}

export default function NightHero({ videoCount, goalCount, dayCount }) {
  return (
    <section className="night" aria-label="할로윈 배너">
      <Web />
      <div className="night__moon" aria-hidden="true" />
      <Bat className="bat--1" />
      <Bat className="bat--2" />
      <Bat className="bat--3" />
      <Spider />
      <Pumpkin />
      <div className="night__fog" aria-hidden="true" />

      <div className="night__text">
        <p className="night__eyebrow">Halloween Night · 2026</p>
        <h1 className="night__title">
          Trick <em>or</em> Shoot
        </h1>
        <p className="night__sub">
          {dayCount}일 동안 찍은 영상 {videoCount}개, 그 안에서 터진 골 {goalCount}개
        </p>
      </div>
    </section>
  );
}

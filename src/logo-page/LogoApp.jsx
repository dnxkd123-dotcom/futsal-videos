import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groups, total } from './logos.js';
import { setLike, subscribeLikes } from './likes.js';

const SIZES = [
  { id: 'l', label: '크게' },
  { id: 'm', label: '보통' },
  { id: 's', label: '작게' }
];
const TOP = 'top';
const TOP_SIZE = 20;
const allLogos = groups.flatMap((group) => group.items);

/** 좋아요 실시간 구독 + 누르기/취소. 누르는 중인 로고는 pending 에 넣어 두 번 눌리지 않게 한다. */
function useLikes() {
  const [state, setState] = useState({ counts: {}, mine: new Set(), ready: false, failed: false });
  const [pending, setPending] = useState(() => new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    subscribeLikes(
      (data) => setState({ ...data, ready: true, failed: false }),
      () => setState((prev) => ({ ...prev, ready: true, failed: true }))
    )
      .then((stop) => (cancelled ? stop() : (unsubscribe = stop)))
      .catch(() => setState((prev) => ({ ...prev, ready: true, failed: true })));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const toggle = useCallback(
    async (name) => {
      if (pending.has(name)) return;
      const on = !state.mine.has(name);
      setPending((prev) => new Set(prev).add(name));
      setError('');
      try {
        await setLike(name, on);
      } catch {
        setError('좋아요를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [pending, state.mine]
  );

  return { ...state, pending, error, toggle };
}

export default function LogoApp() {
  const [filter, setFilter] = useState('all'); // 'all' · 'top' · 스타일 key
  const [size, setSize] = useState('m');
  const [open, setOpen] = useState(null); // { no, from: 'top' | 'grid' }
  const likes = useLikes();

  // 인기 TOP 20 — 좋아요 많은 순, 같으면 번호 순. 좋아요 0개는 넣지 않는다
  const top = useMemo(
    () =>
      allLogos
        .filter((logo) => likes.counts[logo.name] > 0)
        .sort((a, b) => likes.counts[b.name] - likes.counts[a.name] || a.no - b.no)
        .slice(0, TOP_SIZE),
    [likes.counts]
  );
  const showTop = filter === 'all' || filter === TOP;
  const shown = useMemo(() => (filter === 'all' ? groups : groups.filter((group) => group.key === filter)), [filter]);

  // 크게 보기에서 ← → 로 넘기는 순서 — 인기 섹션에서 열면 인기 순서, 아니면 화면의 묶음 순서
  const list = useMemo(() => (open?.from === TOP ? top : shown.flatMap((group) => group.items)), [open?.from, top, shown]);
  const index = open ? list.findIndex((logo) => logo.no === open.no) : -1;

  const pick = (key) => {
    setFilter(key);
    window.scrollTo({ top: 0 });
  };

  const card = (logo, from, caption) => (
    <li key={`${from}-${logo.no}`}>
      <button type="button" className="lg-card" onClick={() => setOpen({ no: logo.no, from })}>
        <img src={logo.url} alt={`${logo.no}번 로고`} width="1024" height="1024" loading="lazy" decoding="async" />
        <span className="lg-card__no">{logo.no}</span>
        {size !== 's' && <span className="lg-card__caption">{caption ?? logo.caption}</span>}
      </button>
      <LikeButton logo={logo} likes={likes} className="lg-like--card" />
    </li>
  );

  return (
    <div className="lg">
      <header className="lg-head">
        <div>
          <h1>로고 후보</h1>
          <p className="lg-muted">{total}개 · 마음에 드는 시안에 ♥를 눌러 주세요 · 누르면 크게 보여요</p>
        </div>
        <div className="lg-seg" role="group" aria-label="크기">
          {SIZES.map((item) => (
            <button key={item.id} type="button" aria-pressed={size === item.id} onClick={() => setSize(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <nav className="lg-filters" aria-label="스타일">
        <button type="button" className="lg-chip" aria-pressed={filter === 'all'} onClick={() => pick('all')}>
          전체 <span>{total}</span>
        </button>
        <button type="button" className="lg-chip lg-chip--top" aria-pressed={filter === TOP} onClick={() => pick(TOP)}>
          ♥ 인기 TOP {TOP_SIZE} <span>{top.length}</span>
        </button>
        {groups.map((group) => (
          <button key={group.key} type="button" className="lg-chip" aria-pressed={filter === group.key} onClick={() => pick(group.key)}>
            {group.label} <span>{group.items.length}</span>
          </button>
        ))}
      </nav>

      {likes.error && (
        <p className="lg-error" role="alert">
          {likes.error}
        </p>
      )}

      {showTop && (
        <section className="lg-group lg-group--top" aria-labelledby="lg-top">
          <h2 id="lg-top">
            ♥ 인기 TOP {TOP_SIZE} <span>{top.length}</span>
          </h2>
          {likes.failed ? (
            <p className="lg-muted lg-empty">좋아요를 불러오지 못했어요. 새로고침해 주세요.</p>
          ) : !likes.ready ? (
            <p className="lg-muted lg-empty">불러오는 중…</p>
          ) : top.length === 0 ? (
            <p className="lg-muted lg-empty">아직 좋아요가 없어요. 마음에 드는 시안에 ♥를 눌러 주세요.</p>
          ) : (
            <ul className={`lg-grid lg-grid--${size}`}>
              {top.map((logo, rank) => card(logo, TOP, `${rank + 1}위 · ${logo.caption}`))}
            </ul>
          )}
        </section>
      )}

      {filter !== TOP &&
        shown.map((group) => (
          <section key={group.key} className="lg-group" aria-labelledby={`lg-${group.key}`}>
            <h2 id={`lg-${group.key}`}>
              {group.label} <span>{group.items.length}</span>
            </h2>
            <ul className={`lg-grid lg-grid--${size}`}>{group.items.map((logo) => card(logo, 'grid'))}</ul>
          </section>
        ))}

      {index !== -1 && (
        <Viewer
          logo={list[index]}
          position={index + 1}
          count={list.length}
          likes={likes}
          onMove={(step) => setOpen((prev) => ({ ...prev, no: list[(index + step + list.length) % list.length].no }))}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Heart({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.3 4.5 6.9 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.7 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LikeButton({ logo, likes, className = '' }) {
  const liked = likes.mine.has(logo.name);
  const count = likes.counts[logo.name] ?? 0;
  if (likes.failed) return null;
  return (
    <button
      type="button"
      className={`lg-like ${liked ? 'lg-like--on' : ''} ${className}`}
      aria-pressed={liked}
      aria-label={`${logo.no}번 ${liked ? '좋아요 취소' : '좋아요'} (지금 ${count}개)`}
      disabled={!likes.ready || likes.pending.has(logo.name)}
      onClick={() => likes.toggle(logo.name)}
    >
      <Heart filled={liked} />
      <span>{count}</span>
    </button>
  );
}

/** 크게 보기 — Esc 닫기, ← → 넘기기, 폰에서는 옆으로 밀어서 넘기기 */
function Viewer({ logo, position, count, likes, onMove, onClose }) {
  const closeRef = useRef(null);
  const touchX = useRef(null);

  const onKey = useCallback(
    (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') onMove(-1);
      else if (event.key === 'ArrowRight') onMove(1);
    },
    [onClose, onMove]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // 열려 있는 동안 뒤 화면이 스크롤되지 않게, 닫으면 원래 자리로
  useEffect(() => {
    const before = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  return (
    <div
      className="lg-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${logo.no}번 로고`}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      onTouchStart={(event) => (touchX.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const dx = event.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1);
      }}
    >
      <div className="lg-viewer__bar">
        <p>
          <strong>{logo.no}번</strong>
          <span>{logo.styleLabel}</span>
          <span className="lg-viewer__pos">
            {position} / {count}
          </span>
        </p>
        <div className="lg-viewer__tools">
          <LikeButton logo={logo} likes={likes} className="lg-like--viewer" />
          <button ref={closeRef} type="button" className="lg-viewer__close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      <div className="lg-viewer__stage" onClick={(event) => event.target === event.currentTarget && onClose()}>
        <button type="button" className="lg-viewer__nav lg-viewer__nav--prev" aria-label="이전 로고" onClick={() => onMove(-1)}>
          ‹
        </button>
        <img key={logo.no} src={logo.url} alt={`${logo.no}번 로고`} width="1024" height="1024" />
        <button type="button" className="lg-viewer__nav lg-viewer__nav--next" aria-label="다음 로고" onClick={() => onMove(1)}>
          ›
        </button>
      </div>

      <div className="lg-viewer__foot">
        <p>{logo.caption}</p>
        <a href={logo.url} target="_blank" rel="noreferrer">
          원본 열기
        </a>
      </div>
    </div>
  );
}

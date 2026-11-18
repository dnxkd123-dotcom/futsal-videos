import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groups, total } from './logos.js';

const SIZES = [
  { id: 'l', label: '크게' },
  { id: 'm', label: '보통' },
  { id: 's', label: '작게' }
];

export default function LogoApp() {
  const [filter, setFilter] = useState('all'); // 'all' 또는 스타일 key
  const [size, setSize] = useState('m');
  const [openNo, setOpenNo] = useState(null); // 크게 보는 로고 번호

  const shown = useMemo(() => (filter === 'all' ? groups : groups.filter((group) => group.key === filter)), [filter]);
  // 크게 보기에서 ← → 로 넘기는 순서 = 지금 화면에 보이는 순서
  const list = useMemo(() => shown.flatMap((group) => group.items), [shown]);
  const index = list.findIndex((logo) => logo.no === openNo);

  const pick = (key) => {
    setFilter(key);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="lg">
      <header className="lg-head">
        <div>
          <h1>로고 후보</h1>
          <p className="lg-muted">
            {total}개 · 마음에 드는 건 번호로 알려 주세요 · 누르면 크게 보여요
          </p>
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
        {groups.map((group) => (
          <button key={group.key} type="button" className="lg-chip" aria-pressed={filter === group.key} onClick={() => pick(group.key)}>
            {group.label} <span>{group.items.length}</span>
          </button>
        ))}
      </nav>

      {shown.map((group) => (
        <section key={group.key} className="lg-group" aria-labelledby={`lg-${group.key}`}>
          <h2 id={`lg-${group.key}`}>
            {group.label} <span>{group.items.length}</span>
          </h2>
          <ul className={`lg-grid lg-grid--${size}`}>
            {group.items.map((logo) => (
              <li key={logo.no}>
                <button type="button" className="lg-card" onClick={() => setOpenNo(logo.no)}>
                  <img src={logo.url} alt={`${logo.no}번 로고`} width="1024" height="1024" loading="lazy" decoding="async" />
                  <span className="lg-card__no">{logo.no}</span>
                  {size !== 's' && <span className="lg-card__caption">{logo.caption}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {index !== -1 && (
        <Viewer
          logo={list[index]}
          position={index + 1}
          count={list.length}
          onMove={(step) => setOpenNo(list[(index + step + list.length) % list.length].no)}
          onClose={() => setOpenNo(null)}
        />
      )}
    </div>
  );
}

/** 크게 보기 — Esc 닫기, ← → 넘기기, 폰에서는 옆으로 밀어서 넘기기 */
function Viewer({ logo, position, count, onMove, onClose }) {
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
        <button ref={closeRef} type="button" className="lg-viewer__close" aria-label="닫기" onClick={onClose}>
          ×
        </button>
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

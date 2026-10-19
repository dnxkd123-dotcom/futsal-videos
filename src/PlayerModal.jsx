import { useEffect, useRef, useState } from 'react';
import analysis from './analysis.json';
import Comments from './Comments.jsx';
import { clock, displayTitle, formatDate } from './dates.js';

const TYPE_ICON = { goal: '⚽', shot: '🥅', save: '🧤', play: '👟', foul: '🟨', other: '📌' };

let apiPromise;
/** 유튜브 IFrame API 를 한 번만 불러온다 (영상이 끝난 걸 알아야 다음 영상으로 넘길 수 있다) */
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** 가운데 팝업 — 왼쪽 플레이어, 오른쪽 재생목록. 끝나면 다음 영상을 이어서 튼다 */
export default function PlayerModal({ playlist, currentId, startAt = 0, onSelect, onClose }) {
  const index = playlist.findIndex((video) => video.id === currentId);
  const current = playlist[index];
  const prev = playlist[index - 1];
  const next = playlist[index + 1];

  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const listRef = useRef(null);
  const latest = useRef({});
  latest.current = { next, onSelect, currentId, startAt };
  const [copiedT, setCopiedT] = useState(null);
  const [listOpen, setListOpen] = useState(false); // 모바일에서만 여닫는다 (데스크톱은 항상 펼침)

  // 플레이어는 한 번만 만들고, 영상이 바뀌면 loadVideoById 로 갈아 끼운다
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        videoId: latest.current.currentId,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: latest.current.startAt },
        events: {
          onReady: (event) => event.target.playVideo(),
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED && latest.current.next) {
              latest.current.onSelect(latest.current.next.id);
            }
          }
        }
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    playerRef.current?.loadVideoById?.(currentId);
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentId, listOpen]);

  // Esc 닫기, → 다음 영상, 뒤쪽 화면 스크롤 잠금
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight' && latest.current.next) latest.current.onSelect(latest.current.next.id);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  if (!current) return null;
  const name = displayTitle(current.title);
  const info = analysis[current.id];

  // 하이라이트 시각으로 이동 — 장면 직전부터 보이도록 2초 앞에서 시작
  const seek = (t, lead = 2) => {
    playerRef.current?.seekTo?.(Math.max(0, t - lead), true);
    playerRef.current?.playVideo?.();
  };

  // 이 시각으로 바로 열리는 링크를 복사 (?v=영상ID&t=시작초). key 는 어떤 버튼이 눌렸는지 표시용
  const copyLink = async (start, key) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('v', current.id);
    url.searchParams.set('t', String(Math.max(0, Math.floor(start))));
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('링크를 복사하세요', url.toString());
    }
    setCopiedT(key);
    setTimeout(() => setCopiedT((now) => (now === key ? null : now)), 1500);
  };

  const copyNow = () => copyLink(playerRef.current?.getCurrentTime?.() ?? 0, 'now');

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`${name} 재생`} onClick={onClose}>
      <div className="modal__box" onClick={(event) => event.stopPropagation()}>
        <div className="modal__main">
          <div className="modal__video" ref={hostRef} />
          <div className="modal__info">
            <div className="modal__now">
              <strong>{name}</strong>
              <span>{formatDate(current.date).long}</span>
            </div>
            <div className="modal__nav">
              <button type="button" className="seg__item modal__btn" onClick={copyNow} title="지금 보고 있는 시각부터 열리는 링크를 복사해요">
                {copiedT === 'now' ? '✓ 복사됨' : '🔗 지금 시각 링크'}
              </button>
              <button type="button" className="seg__item modal__btn" disabled={!prev} onClick={() => onSelect(prev.id)}>
                ← 이전
              </button>
              <button type="button" className="seg__item modal__btn" disabled={!next} onClick={() => onSelect(next.id)}>
                다음 →
              </button>
            </div>
            <p className="modal__hint">
              <b>🔗 지금 시각 링크</b>를 누르면 지금 보고 있는 장면부터 열리는 주소가 복사돼요. 친구에게 보내 보세요!
            </p>
          </div>

          {info && (
            <section className="hl">
              <p className="hl__hint">
                장면을 누르면 그 시각으로 이동하고, <b>🔗 링크 복사</b>를 누르면 그 장면이 바로 열리는 주소가 복사돼요.
              </p>
              {info.highlights.length > 0 && (
                <ul className="hl__list">
                  {info.highlights.map((item) => (
                    <li key={item.t} className="hl__row">
                      <button type="button" className={`hl__item hl__item--${item.type}`} onClick={() => seek(item.t)}>
                        <span aria-hidden="true">{TYPE_ICON[item.type] ?? TYPE_ICON.other}</span>
                        <b>{clock(item.t)}</b>
                        {item.label}
                      </button>
                      <button
                        type="button"
                        className="hl__copy"
                        onClick={() => copyLink(item.t - 2, item.t)}
                        aria-label={`${clock(item.t)} 장면 링크 복사`}
                        title="이 장면 링크 복사"
                      >
                        {copiedT === item.t ? '✓ 복사됨' : '🔗 링크 복사'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <small className="hl__note">AI가 자동으로 찾은 장면이라 시각이 조금 틀릴 수 있어요</small>
            </section>
          )}

          <Comments
            videoId={current.id}
            getTime={() => playerRef.current?.getCurrentTime?.() ?? 0}
            onSeek={(t) => seek(t, 0)}
          />
        </div>

        <aside className={`modal__side ${listOpen ? 'modal__side--open' : ''}`}>
          <h2 className="modal__head">
            <button type="button" className="modal__toggle" aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
              <span className="modal__label modal__label--d">재생목록</span>
              <span className="modal__label modal__label--m">다른 영상 보기</span>
              <span className="modal__count">{index + 1} / {playlist.length}</span>
              <span className="modal__chev" aria-hidden="true">{listOpen ? '▲' : '▼'}</span>
            </button>
          </h2>
          <ol className="modal__list" ref={listRef}>
            {playlist.map((video) => {
              const active = video.id === currentId;
              return (
                <li key={video.id}>
                  <button
                    type="button"
                    className={`modal__item ${active ? 'modal__item--on' : ''}`}
                    aria-current={active}
                    onClick={() => {
                      onSelect(video.id);
                      setListOpen(false);
                    }}
                  >
                    <img src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`} alt="" loading="lazy" />
                    <span>
                      <b>{displayTitle(video.title)}</b>
                      <small>{formatDate(video.date).short}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
    </div>
  );
}

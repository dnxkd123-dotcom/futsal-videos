import { useEffect, useRef } from 'react';
import { displayTitle, formatDate } from './dates.js';

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
export default function PlayerModal({ playlist, currentId, onSelect, onClose }) {
  const index = playlist.findIndex((video) => video.id === currentId);
  const current = playlist[index];
  const prev = playlist[index - 1];
  const next = playlist[index + 1];

  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const listRef = useRef(null);
  const latest = useRef({});
  latest.current = { next, onSelect, currentId };

  // 플레이어는 한 번만 만들고, 영상이 바뀌면 loadVideoById 로 갈아 끼운다
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.appendChild(mount);
      playerRef.current = new YT.Player(mount, {
        videoId: latest.current.currentId,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
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
  }, [currentId]);

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
              <button type="button" className="seg__item modal__btn" disabled={!prev} onClick={() => onSelect(prev.id)}>
                ← 이전
              </button>
              <button type="button" className="seg__item modal__btn" disabled={!next} onClick={() => onSelect(next.id)}>
                다음 →
              </button>
            </div>
          </div>
        </div>

        <aside className="modal__side">
          <h2 className="modal__head">
            재생목록 <span>{index + 1} / {playlist.length}</span>
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
                    onClick={() => onSelect(video.id)}
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

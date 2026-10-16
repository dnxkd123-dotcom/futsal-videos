import { displayTitle } from './dates.js';

/** 썸네일 카드 — 누르면 팝업 플레이어가 열린다 */
export default function VideoCard({ video, index, onPlay }) {
  const { id, title } = video;
  const name = displayTitle(title);

  return (
    <article className="card">
      <div className="card__media">
        <button type="button" className="card__thumb" onClick={onPlay} aria-label={`${name} 재생`}>
          <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="card__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </button>
      </div>
      <div className="card__body">
        <h3 className="card__title">{name}</h3>
        <span className="card__no">#{String(index).padStart(2, '0')}</span>
      </div>
    </article>
  );
}

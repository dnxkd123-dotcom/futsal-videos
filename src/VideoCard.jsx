import { displayTitle } from './dates.js';

/** 썸네일만 보여주다가 누르면 그 자리에서 유튜브 플레이어로 바뀐다 */
export default function VideoCard({ video, index, isPlaying, onPlay }) {
  const { id, title } = video;
  const name = displayTitle(title);

  return (
    <article className="card">
      <div className="card__media">
        {isPlaying ? (
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
            title={name}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" className="card__thumb" onClick={onPlay} aria-label={`${name} 재생`}>
            <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="card__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <div className="card__body">
        <h3 className="card__title">{name}</h3>
        <span className="card__no">#{String(index).padStart(2, '0')}</span>
      </div>
    </article>
  );
}

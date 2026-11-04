import { clock, displayTitle, shortTitle } from './dates.js';
import Icon from './icons.jsx';

const MAX_GOAL_TIMES = 3; // 카드 폭에 한 줄로 들어가는 만큼만, 나머지는 +N

/** 썸네일 카드 — 썸네일을 누르면 처음부터, 골 시각을 누르면 그 장면부터 팝업 플레이어로 연다 */
export default function VideoCard({ video, commentCount, goalTimes, highlightCount, onPlay }) {
  const { id, title } = video;
  const name = displayTitle(title);

  return (
    <article className="card">
      <button type="button" className="card__thumb" onClick={() => onPlay(0)} aria-label={`${name} 재생`}>
        <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
        <span className="card__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>
      </button>
      <div className="card__body">
        <div className="card__top">
          <h3 className="card__title">{shortTitle(title)}</h3>
          <span className="card__meta">
            {highlightCount > 0 && <span>장면 {highlightCount}</span>}
            {commentCount > 0 && (
              <span title={`댓글 ${commentCount}개`}>
                <Icon name="chat" size={12} />
                {commentCount}
              </span>
            )}
          </span>
        </div>
        <div className="card__goals">
          {goalTimes === null ? (
            <span className="card__none">분석 전</span>
          ) : goalTimes.length === 0 ? (
            <span className="card__none">골 0</span>
          ) : (
            <>
              <span className="card__goal-count">골 {goalTimes.length}</span>
              {goalTimes.slice(0, MAX_GOAL_TIMES).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="card__t"
                  onClick={() => onPlay(t)}
                  aria-label={`${name} ${clock(t)} 골 장면부터 재생`}
                >
                  {clock(t)}
                </button>
              ))}
              {goalTimes.length > MAX_GOAL_TIMES && (
                <span className="card__none">+{goalTimes.length - MAX_GOAL_TIMES}</span>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

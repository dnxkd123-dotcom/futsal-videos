import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import videos from './videos.json';
import VideoCard from './VideoCard.jsx';
import PlayerModal from './PlayerModal.jsx';
import { getCommentCount } from './firebase.js';
import { formatDate, groupByDate } from './dates.js';
import { useInfiniteLimit, useMediaQuery } from './hooks.js';

const groups = groupByDate(videos);

// 모바일은 처음 6개만 그리고, 아래로 내리면 6개씩 더 불러온다
const MOBILE_QUERY = '(max-width: 760px)';
const PAGE_SIZE = 6;

/** 앞에서부터 limit 개까지만 남기고 날짜 묶음은 그대로 유지 */
function takeFirst(list, limit) {
  let left = limit;
  const result = [];
  for (const group of list) {
    if (left <= 0) break;
    result.push({ ...group, items: group.items.slice(0, left) });
    left -= group.items.length;
  }
  return result;
}

const SORTS = [
  { id: 'new', label: '최신순' },
  { id: 'old', label: '오래된순' }
];

export default function App() {
  // 팝업으로 재생 중인 영상 (없으면 null)
  // 공유 링크(/v/영상ID/?t=초, 예전 ?v=영상ID&t=초 도 지원)로 들어오면 그 장면으로 바로 연다
  const [initial] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const id = /\/v\/([\w-]{11})\/?$/.exec(window.location.pathname)?.[1] ?? params.get('v');
    const t = Number(params.get('t'));
    if (!videos.some((video) => video.id === id)) return { id: null, t: 0 };
    return { id, t: Number.isFinite(t) && t > 0 ? Math.floor(t) : 0 };
  });
  const [playingId, setPlayingId] = useState(initial.id);
  const [startAt, setStartAt] = useState(initial.t);
  const selectVideo = useCallback((id) => {
    setPlayingId(id);
    setStartAt(0);
  }, []);
  const [selected, setSelected] = useState('all');
  const [sort, setSort] = useState('new');

  const shown = useMemo(() => {
    const list = selected === 'all' ? groups : groups.filter((group) => group.date === selected);
    return sort === 'new' ? list : [...list].reverse();
  }, [selected, sort]);
  // 팝업 재생목록 = 지금 화면에 보이는 순서 그대로
  const playlist = useMemo(() => shown.flatMap((group) => group.items), [shown]);
  // 팝업을 닫을 때마다 값이 올라가서, 그동안 달린 댓글 개수를 다시 센다
  const [countsVersion, setCountsVersion] = useState(0);
  const closePlayer = useCallback(() => {
    setPlayingId(null);
    setCountsVersion((n) => n + 1);
  }, []);
  const shownCount = shown.reduce((sum, group) => sum + group.items.length, 0);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { limit, hasMore, sentinelRef } = useInfiniteLimit({
    total: shownCount,
    pageSize: PAGE_SIZE,
    enabled: isMobile,
    resetKey: `${selected}|${sort}`
  });
  const visible = isMobile ? takeFirst(shown, limit) : shown;

  // 카드에 보여줄 댓글 개수 — 화면에 있는 영상만, 버전이 바뀐 것만 새로 센다
  const [counts, setCounts] = useState({});
  const fetchedAt = useRef({});
  const visibleIds = visible.flatMap((group) => group.items.map((video) => video.id)).join(',');
  useEffect(() => {
    let cancelled = false;
    for (const id of visibleIds.split(',').filter(Boolean)) {
      if (fetchedAt.current[id] === countsVersion) continue;
      fetchedAt.current[id] = countsVersion;
      getCommentCount(id)
        .then((count) => !cancelled && setCounts((prev) => ({ ...prev, [id]: count })))
        .catch(() => {
          fetchedAt.current[id] = undefined; // 실패하면 다음에 다시 시도, 개수는 그냥 숨긴다
        });
    }
    return () => {
      cancelled = true;
    };
  }, [visibleIds, countsVersion]);

  return (
    <div className="app">
      <aside className="side">
        <div className="side__brand">
          <img className="side__logo" src="./favicon.png" alt="" width="26" height="26" />
          <strong>우탕 풋살 영상</strong>
        </div>

        <nav className="side__nav" aria-label="날짜 선택">
          <h2 className="side__label">날짜</h2>
          <SideItem
            active={selected === 'all'}
            onClick={() => setSelected('all')}
            desc={`영상 ${videos.length}개 · ${groups.length}일`}
          >
            전체
          </SideItem>
          {groups.map((group) => (
            <SideItem
              key={group.date}
              active={selected === group.date}
              onClick={() => setSelected(group.date)}
              desc={`영상 ${group.items.length}개`}
            >
              {formatDate(group.date).short}
            </SideItem>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="bar">
          <div className="bar__path">
            <span>videos</span>
            <span>/</span>
            <strong>{selected === 'all' ? 'all' : selected}</strong>
          </div>
          <div className="seg" role="group" aria-label="정렬">
            {SORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="seg__item"
                aria-pressed={sort === item.id}
                onClick={() => setSort(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="content">
          {visible.map((group) => {
            const when = formatDate(group.date);
            return (
              <section key={group.date} className="day">
                <h2 className="day__head">
                  {when.title} <span>{when.weekday} · {group.items.length}개</span>
                </h2>
                <ul className="grid">
                  {group.items.map((video, index) => (
                    <li key={video.id}>
                      <VideoCard
                        video={video}
                        index={index + 1}
                        commentCount={counts[video.id]}
                        onPlay={() => selectVideo(video.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {isMobile &&
            (hasMore ? (
              <p ref={sentinelRef} className="more" role="status">
                <span className="more__ball" aria-hidden="true" />
                불러오는 중…
              </p>
            ) : (
              <p className="more more--end">
                <img src="./favicon.png" alt="" width="28" height="28" />
                마지막 영상이에요! 총 {shownCount}개
              </p>
            ))}
        </main>

        <footer className="status">
          <span>{shownCount}개 영상</span>
          <span>썸네일을 누르면 재생돼요</span>
        </footer>

        {playingId && (
          <PlayerModal
            playlist={playlist}
            currentId={playingId}
            startAt={startAt}
            onSelect={selectVideo}
            onClose={closePlayer}
          />
        )}
      </div>
    </div>
  );
}

function SideItem({ active, onClick, desc, children }) {
  return (
    <button
      type="button"
      className={`side__item ${active ? 'side__item--on' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="side__name">{children}</span>
      <span className="side__desc">{desc}</span>
    </button>
  );
}

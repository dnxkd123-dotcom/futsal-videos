import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import videos from './videos.json';
import VideoCard from './VideoCard.jsx';
import PlayerModal from './PlayerModal.jsx';
import analysis from './analysis.json';
import { getCommentCount } from './firebase.js';
import Icon from './icons.jsx';
import { formatDate, formatMonth, groupByDate, groupByMonth } from './dates.js';
import { useInfiniteLimit, useMediaQuery } from './hooks.js';

const groups = groupByDate(videos);
const months = groupByMonth(groups);

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

/** 골 시각 목록 — 아직 분석하지 않은 영상은 null */
function goalTimesOf(id) {
  return analysis[id]?.highlights.filter((item) => item.type === 'goal').map((item) => item.t) ?? null;
}

function countGoals(items) {
  return items.reduce((sum, video) => sum + (goalTimesOf(video.id)?.length ?? 0), 0);
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
  // 카드의 골 시각에서 열 때는 장면 직전(2초 앞)부터
  const playAt = (id, t) => {
    setPlayingId(id);
    setStartAt(t > 0 ? Math.max(0, t - 2) : 0);
  };
  // 'all' · 월('2026-10') · 하루('2026-10-22')
  const [selected, setSelected] = useState('all');
  const [openMonth, setOpenMonth] = useState(months[0]?.key ?? null); // 일자 목록이 펼쳐진 달
  const pickMonth = (key) => {
    // 이미 보고 있는 달을 다시 누르면 접기만 한다
    setOpenMonth((now) => (now === key && selected === key ? null : key));
    setSelected(key);
  };
  // 폰 · 태블릿의 날짜 선택 상자 — 고른 날의 달을 사이드바에서도 펼쳐 둔다
  const pickScope = (value) => {
    if (value !== 'all') setOpenMonth(value.slice(0, 7));
    setSelected(value);
  };
  const [sort, setSort] = useState('new');

  const shown = useMemo(() => {
    const list =
      selected === 'all'
        ? groups
        : groups.filter((group) => group.date === selected || group.date.startsWith(`${selected}-`));
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
  const shownGoals = shown.reduce((sum, group) => sum + countGoals(group.items), 0);
  const isDay = selected.length === 10;
  const title = selected === 'all' ? '전체 영상' : isDay ? formatDate(selected).long : formatMonth(selected).long;
  const summary = [!isDay && `경기일 ${shown.length}일`, `영상 ${shownCount}개`, `골 ${shownGoals}개`]
    .filter(Boolean)
    .join(' · ');

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
          <img className="side__logo" src="./favicon.png" alt="" width="24" height="24" />
          <strong>우탕 풋살 영상</strong>
        </div>

        <nav className="side__nav" aria-label="날짜 선택">
          <h2 className="side__label">날짜</h2>
          <SideItem active={selected === 'all'} onClick={() => setSelected('all')} count={videos.length}>
            전체
          </SideItem>
          {months.map((month) => {
            const open = openMonth === month.key;
            return (
              <div key={month.key} className="side__month">
                <SideItem
                  active={selected === month.key}
                  onClick={() => pickMonth(month.key)}
                  count={month.count}
                  expanded={open}
                >
                  {formatMonth(month.key).short}
                </SideItem>
                {open && (
                  <div className="side__days">
                    {month.groups.map((group) => (
                      <SideItem
                        key={group.date}
                        active={selected === group.date}
                        onClick={() => setSelected(group.date)}
                        count={group.items.length}
                      >
                        {formatDate(group.date).dayShort}
                      </SideItem>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="main">
        <main className="content">
          <header className="head">
            <div>
              <h1 className="head__title">{title}</h1>
              <p className="head__sub">{summary}</p>
            </div>
            <div className="head__tools">
              {/* 폰 · 태블릿에서는 사이드바 대신 이 선택 상자로 날짜를 고른다 */}
              <select className="scope" value={selected} onChange={(event) => pickScope(event.target.value)} aria-label="날짜 선택">
                <option value="all">전체 · {videos.length}개</option>
                {months.map((month) => (
                  <optgroup key={month.key} label={formatMonth(month.key).long}>
                    <option value={month.key}>
                      {formatMonth(month.key).short} 전체 · {month.count}개
                    </option>
                    {month.groups.map((group) => (
                      <option key={group.date} value={group.date}>
                        {formatDate(group.date).dayShort} · {group.items.length}개
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
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
            </div>
          </header>

          {visible.map((group) => {
            const when = formatDate(group.date);
            return (
              <section key={group.date} className="day" aria-label={when.long}>
                {/* 하루만 고르면 화면 제목이 곧 그날이라 날짜 제목을 또 달지 않는다 */}
                {!isDay && (
                  <div className="day__head">
                    <h2 aria-label={`${when.title} ${when.weekdayLong}`}>
                      <span className="day__date">{when.md}</span>
                      <span className="day__week">{when.weekdayLong}</span>
                    </h2>
                    <span>
                      영상 {group.items.length}개 · 골 {countGoals(group.items)}개
                    </span>
                  </div>
                )}
                <ul className="grid">
                  {group.items.map((video) => (
                    <li key={video.id}>
                      <VideoCard
                        video={video}
                        commentCount={counts[video.id]}
                        goalTimes={goalTimesOf(video.id)}
                        highlightCount={analysis[video.id]?.highlights.length ?? 0}
                        onPlay={(t) => playAt(video.id, t)}
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
                불러오는 중…
              </p>
            ) : (
              <p className="more">영상 {shownCount}개를 모두 봤어요</p>
            ))}
        </main>

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

function SideItem({ active, onClick, count, expanded, children }) {
  return (
    <button
      type="button"
      className={`side__item ${active ? 'side__item--on' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className="side__name">
        {children}
        {expanded !== undefined && <Icon name="chevron" size={14} className="side__chev" />}
      </span>
      <span className="side__count" aria-label={`영상 ${count}개`}>
        {count}
      </span>
    </button>
  );
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** '2026-10-15' → { short: '10.15 (목)', long: '2026년 10월 15일 목요일' } (시간대 영향 없게 숫자로 만든다) */
export function formatDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return {
    short: `${m}.${d} (${WEEKDAYS[day]})`,
    dayShort: `${d}일 (${WEEKDAYS[day]})`,
    md: `${m}.${String(d).padStart(2, '0')}`,
    title: `${m}월 ${d}일`,
    day: String(d).padStart(2, '0'),
    month: MONTHS_EN[m - 1],
    year: String(y),
    weekday: WEEKDAYS_EN[day],
    long: `${y}년 ${m}월 ${d}일 ${WEEKDAYS[day]}요일`
  };
}

/** 날짜별로 묶는다. 최근 날짜가 위, 같은 날은 제목(촬영 순서) 오름차순 */
export function groupByDate(videos) {
  const map = new Map();
  for (const video of videos) {
    if (!map.has(video.date)) map.set(video.date, []);
    map.get(video.date).push(video);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => a.title.localeCompare(b.title))
    }));
}

/** '2026-10' → { short: '10월', long: '2026년 10월' } */
export function formatMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return { short: `${m}월`, long: `${y}년 ${m}월` };
}

/** 날짜 묶음(groupByDate 결과, 최신순)을 다시 달별로 묶는다 */
export function groupByMonth(groups) {
  const months = [];
  for (const group of groups) {
    const key = group.date.slice(0, 7);
    let month = months.at(-1);
    if (month?.key !== key) months.push((month = { key, groups: [], count: 0 }));
    month.groups.push(group);
    month.count += group.items.length;
  }
  return months;
}

/** 제목이 YYYYMMDDNN 이면 'N번째 영상'으로, 아니면 제목 그대로 */
export function displayTitle(title) {
  const match = /^\d{8}(\d{2})$/.exec(title);
  return match ? `${Number(match[1])}번째 영상` : title;
}

/** 90 → '1:30' */
export function clock(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

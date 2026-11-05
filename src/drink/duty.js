/**
 * 음료수 당번 정하기 — 오늘 온 사람 중에서 마지막으로 사 온 지 가장 오래된 사람.
 *   1. 마지막 구매일이 오래된 순 (한 번도 안 산 사람이 맨 앞)
 *   2. 같으면 산 횟수가 적은 순
 *   3. 그래도 같으면 멤버 목록 순서
 */
export function rankDuty(members, history, present) {
  const stats = new Map(members.map((name, order) => [name, { name, order, last: null, count: 0 }]));
  for (const record of history) {
    const stat = stats.get(record.name);
    if (!stat) continue;
    stat.count += 1;
    if (!stat.last || record.date > stat.last) stat.last = record.date;
  }
  return [...stats.values()]
    .filter((stat) => present.has(stat.name))
    .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? '') || a.count - b.count || a.order - b.order);
}

/** 이 기기의 시간대 기준 오늘 'YYYY-MM-DD' */
export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 두 날짜('YYYY-MM-DD') 사이 일수 */
export function daysBetween(from, to) {
  const toUtc = (date) => {
    const [y, m, d] = date.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

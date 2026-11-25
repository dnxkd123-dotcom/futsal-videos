import { staffFirestore } from '../drink/store.js';

/**
 * 멤버 · 월별 부상 / 불참 기록 — 문서 하나(roster/state)에 모두 담는다. 음료수 당번과 같은 운영진 계정으로만 읽고 쓴다.
 *   members: [{ id, name }]                                  (순서 = 화면 순서)
 *   months:  { 'YYYY-MM': { 멤버id: { status, reason } } }  status: injury · absent · etc (정상이면 기록 없음)
 */
const EMPTY = { members: [], months: {} };

function normalize(data) {
  return {
    members: Array.isArray(data?.members) ? data.members : [],
    months: data?.months && typeof data.months === 'object' ? data.months : {}
  };
}

/** 실시간으로 받아 본다 — 다른 운영진이 고치면 바로 바뀐다. 구독 해제 함수를 준다. */
export async function subscribeRoster(onData, onError) {
  const { fs, db } = await staffFirestore();
  return fs.onSnapshot(
    fs.doc(db, 'roster', 'state'),
    (snap) => onData(snap.exists() ? normalize(snap.data()) : EMPTY),
    onError
  );
}

/** 지금 저장된 값을 읽어 change 로 바꾼 뒤 저장 — 두 사람이 동시에 고쳐도 한쪽이 사라지지 않게 트랜잭션으로 */
export async function updateRoster(change) {
  const { fs, db } = await staffFirestore();
  const ref = fs.doc(db, 'roster', 'state');
  await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = change(snap.exists() ? normalize(snap.data()) : EMPTY);
    tx.set(ref, { members: next.members, months: next.months, updatedAt: fs.serverTimestamp() });
  });
}

export function newId() {
  return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 이 기기 시간대 기준 이번 달 'YYYY-MM' */
export function thisMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' 에서 step 달 이동 */
export function shiftMonth(month, step) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + step, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 엑셀에서 복사한 칸(탭 · 줄바꿈) 이나 쉼표로 이어 쓴 이름들 → 이름 목록 (빈칸 · 중복 제거) */
export function parseNames(text) {
  const names = String(text)
    .split(/[\t\n\r,]+/)
    .map((name) => name.trim())
    .filter((name) => name && name.length <= 20);
  return [...new Set(names)];
}

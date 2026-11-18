import { loadFirebase } from '../firebase.js';

/**
 * 로고 좋아요 — logoLikes/<uid>__<로고 이름> 문서 하나가 "이 사람이 이 로고를 좋아한다".
 * 로고 이름은 파일 이름(확장자 뺀 것)이라 번호가 다시 매겨져도 좋아요가 따라간다.
 * 익명 로그인 uid 기준이라 한 브라우저에서 로고 하나에 한 번만 누를 수 있다.
 */

/** 좋아요 전체를 실시간으로 받아 { counts: {로고: 개수}, mine: Set(내가 누른 로고) } 로 넘긴다. 구독 해제 함수를 준다. */
export async function subscribeLikes(onData, onError) {
  const { fs, db, uid } = await loadFirebase();
  return fs.onSnapshot(
    fs.collection(db, 'logoLikes'),
    (snap) => {
      const counts = {};
      const mine = new Set();
      snap.forEach((doc) => {
        const { logo, uid: who } = doc.data();
        counts[logo] = (counts[logo] ?? 0) + 1;
        if (who === uid) mine.add(logo);
      });
      onData({ counts, mine });
    },
    onError
  );
}

/** on 이면 좋아요, 아니면 취소 */
export async function setLike(logo, on) {
  const { fs, db, uid } = await loadFirebase();
  const ref = fs.doc(db, 'logoLikes', `${uid}__${logo}`);
  if (on) await fs.setDoc(ref, { logo, uid });
  else await fs.deleteDoc(ref);
}

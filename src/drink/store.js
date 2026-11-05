import { config } from '../firebase.js';

/**
 * 음료수 당번 페이지 전용 Firebase 연결.
 *
 * 비밀번호 = Firebase Authentication 의 이메일 계정 하나(DRINK_EMAIL)의 비밀번호.
 * 비밀번호는 소스에 없고 Firebase 서버가 확인한다 (틀리게 여러 번 넣으면 Firebase 가 막는다).
 * 비밀번호를 바꾸려면 Firebase 콘솔 → Authentication → 이 계정 → 비밀번호 재설정 (앞에 PASSWORD_PREFIX 를 붙여서).
 *
 * 'drink' 라는 이름의 앱을 따로 만든다 — 영상 페이지의 익명 로그인(댓글 삭제용 uid)과 로그인 상태가 섞이지 않게.
 */
export const DRINK_EMAIL = 'drink@wootang.kro.kr';
// Firebase 비밀번호는 6자 이상이어야 해서, 화면에서 넣은 비밀번호 앞에 이 말을 붙여 보낸다.
// 예) 화면에서 1122 → 계정 비밀번호는 wootang-1122
const PASSWORD_PREFIX = 'wootang-';

let ready;
function load() {
  ready ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore')
    ]);
    const app = initializeApp(config, 'drink');
    const authApp = auth.getAuth(app);
    await authApp.authStateReady();
    return { auth, authApp, fs, db: fs.getFirestore(app) };
  })().catch((err) => {
    ready = undefined; // 다음에 다시 시도할 수 있게
    throw err;
  });
  return ready;
}

/** 이 기기에서 이미 들어와 있는지 (한 번 들어오면 잠그기 전까지 유지된다) */
export async function isSignedIn() {
  const { authApp } = await load();
  return authApp.currentUser?.email === DRINK_EMAIL;
}

/** 'ok' · 'wrong'(비밀번호 틀림) · 'blocked'(너무 많이 틀려서 잠시 막힘) */
export async function signIn(password) {
  const { auth, authApp } = await load();
  try {
    await auth.signInWithEmailAndPassword(authApp, DRINK_EMAIL, PASSWORD_PREFIX + password);
    return 'ok';
  } catch (err) {
    if (err?.code === 'auth/too-many-requests') return 'blocked';
    if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(err?.code)) return 'wrong';
    throw err;
  }
}

export async function signOut() {
  const { auth, authApp } = await load();
  await auth.signOut(authApp);
}

/**
 * 기록은 문서 하나에 모두 담는다 — drink/state
 *   members: ['이름', …]                       (순서 = 동률일 때 우선순위)
 *   history: [{ id, date: 'YYYY-MM-DD', name }]  (누가 언제 사 왔는지)
 */
const EMPTY = { members: [], history: [] };

function normalize(data) {
  return {
    members: Array.isArray(data?.members) ? data.members : [],
    history: Array.isArray(data?.history) ? data.history : []
  };
}

async function stateRef() {
  const { fs, db } = await load();
  return { fs, db, ref: fs.doc(db, 'drink', 'state') };
}

/** 실시간으로 받아 본다 — 다른 사람이 기록하면 바로 바뀐다. 구독 해제 함수를 준다. */
export async function subscribeState(onData, onError) {
  const { fs, ref } = await stateRef();
  return fs.onSnapshot(ref, (snap) => onData(snap.exists() ? normalize(snap.data()) : EMPTY), onError);
}

/** 지금 저장된 값을 읽어 change 로 바꾼 뒤 저장 — 두 사람이 동시에 눌러도 한쪽 기록이 사라지지 않게 트랜잭션으로 */
export async function updateState(change) {
  const { fs, db, ref } = await stateRef();
  await fs.runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = change(snap.exists() ? normalize(snap.data()) : EMPTY);
    tx.set(ref, { members: next.members, history: next.history, updatedAt: fs.serverTimestamp() });
  });
}

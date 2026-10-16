// 웹 앱용 Firebase 설정값은 공개돼도 괜찮다 — 보안은 firestore.rules 가 책임진다
const config = {
  apiKey: 'AIzaSyDhazUp4y8JP3tiRh_S0td7gbQ88QZ3Si0',
  authDomain: 'wootang-76088.firebaseapp.com',
  projectId: 'wootang-76088',
  storageBucket: 'wootang-76088.firebasestorage.app',
  messagingSenderId: '644693105317',
  appId: '1:644693105317:web:b0be6099422d8215cfcb4c'
};

let ready;

/**
 * 댓글을 열 때 처음 한 번만 불러온다 (firebase 는 용량이 커서 첫 화면에 안 들어가게 지연 로드).
 * 익명 로그인으로 uid 를 받아 둔다 — 내 댓글 삭제를 가려내는 데 쓴다.
 */
export function loadFirebase() {
  ready ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore')
    ]);
    const app = initializeApp(config);
    const authApp = auth.getAuth(app);
    await authApp.authStateReady();
    if (!authApp.currentUser) await auth.signInAnonymously(authApp);
    return { fs, db: fs.getFirestore(app), uid: authApp.currentUser.uid };
  })().catch((err) => {
    ready = undefined; // 다음에 다시 시도할 수 있게
    throw err;
  });
  return ready;
}

import { useEffect, useState } from 'react';
import { loadFirebase } from './firebase.js';
import { clock } from './dates.js';
import Icon from './icons.jsx';

const NICK_KEY = 'futsal-nickname';
const MAX_NICK = 20;
const MAX_TEXT = 500;

function readNick() {
  try {
    return localStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveNick(value) {
  try {
    localStorage.setItem(NICK_KEY, value);
  } catch {
    /* 저장 안 돼도 댓글 작성에는 문제없다 */
  }
}

/** 공개 IP — 못 가져오면 null (댓글 작성은 막지 않는다) */
async function fetchIp() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    const { ip } = await res.json();
    return typeof ip === 'string' ? ip.slice(0, 64) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function formatWhen(date) {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getMonth() + 1}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 영상별 익명 댓글. 댓글에 영상 시각을 붙이면 누를 때 그 장면으로 이동한다 */
export default function Comments({ videoId, getTime, onSeek }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ok | error
  const [me, setMe] = useState(null);

  const [nickname, setNickname] = useState(readNick);
  const [text, setText] = useState('');
  const [attached, setAttached] = useState(null); // 붙인 시각(초) 또는 null
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false); // 모바일에서만 여닫는다 (데스크톱은 항상 펼침)
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    setStatus('loading');
    setItems([]);
    setAttached(null);

    loadFirebase()
      .then(({ fs, db, uid }) => {
        if (cancelled) return;
        setMe(uid);
        const q = fs.query(
          fs.collection(db, 'videos', videoId, 'comments'),
          fs.orderBy('createdAt', 'desc'),
          fs.limit(100)
        );
        unsubscribe = fs.onSnapshot(
          q,
          (snap) => {
            setItems(
              snap.docs.map((doc) => {
                const data = doc.data({ serverTimestamps: 'estimate' });
                return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() ?? null };
              })
            );
            setStatus('ok');
          },
          () => setStatus('error')
        );
      })
      .catch(() => !cancelled && setStatus('error'));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [videoId]);

  const submit = async (event) => {
    event.preventDefault();
    const nick = nickname.trim();
    const body = text.trim();
    if (!nick) return setFormError('닉네임을 입력해 주세요');
    if (!body) return setFormError('내용을 입력해 주세요');

    setSending(true);
    setFormError('');
    try {
      const [{ fs, db, uid }, ip] = await Promise.all([loadFirebase(), fetchIp()]);
      const ref = fs.doc(fs.collection(db, 'videos', videoId, 'comments'));
      const batch = fs.writeBatch(db);
      // 공개 댓글
      batch.set(ref, {
        nickname: nick,
        text: body,
        t: attached,
        uid,
        createdAt: fs.serverTimestamp()
      });
      // 비공개 기록 — 규칙상 누구도 읽을 수 없고, 관리자가 Firebase 콘솔에서만 볼 수 있다
      batch.set(fs.doc(db, 'commentMeta', ref.id), {
        videoId,
        uid,
        ip,
        userAgent: navigator.userAgent.slice(0, 300),
        platform: String(navigator.platform ?? '').slice(0, 60),
        language: String(navigator.language ?? '').slice(0, 20),
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
        createdAt: fs.serverTimestamp()
      });
      await batch.commit();
      saveNick(nick);
      setText('');
      setAttached(null);
      setOpen(true);
    } catch {
      setFormError('댓글을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요');
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('내 댓글을 삭제할까요?')) return;
    try {
      const { fs, db } = await loadFirebase();
      await fs.deleteDoc(fs.doc(db, 'videos', videoId, 'comments', id));
    } catch {
      setFormError('삭제하지 못했어요');
    }
  };

  const toggleTime = () => setAttached((now) => (now === null ? Math.floor(getTime()) : null));

  return (
    <section className={`cm ${open ? 'cm--open' : ''}`} aria-label="댓글">
      <h3 className="cm__head">
        <button type="button" className="cm__toggle" aria-expanded={open} onClick={() => setOpen((now) => !now)}>
          <Icon name="chat" size={18} />
          <span>댓글</span>
          {status === 'ok' && <span className="cm__count">{items.length}</span>}
          <Icon name="chevron" size={16} className="cm__chev" />
        </button>
      </h3>

      <div className="cm__body">

      <form className="cm__form" onSubmit={submit}>
        <input
          className="cm__nick"
          value={nickname}
          maxLength={MAX_NICK}
          placeholder="닉네임"
          aria-label="닉네임"
          onChange={(event) => setNickname(event.target.value)}
        />
        <textarea
          className="cm__text"
          value={text}
          maxLength={MAX_TEXT}
          rows={2}
          placeholder="댓글을 남겨보세요"
          aria-label="댓글 내용"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="cm__actions">
          <button type="button" className="seg__item modal__btn" aria-pressed={attached !== null} onClick={toggleTime}>
            <Icon name="clock" />
            {attached === null ? '현재 시각 붙이기' : `${clock(attached)} 붙음 (취소)`}
          </button>
          <button type="submit" className="seg__item modal__btn cm__send" disabled={sending}>
            {sending ? '등록 중…' : '등록'}
          </button>
        </div>
        {formError && <p className="cm__error" role="alert">{formError}</p>}
        <small className="cm__notice">
          익명으로 올라가지만, 부적절한 글 관리를 위해 작성 시 IP와 기기 정보가 비공개로 저장돼요.
        </small>
      </form>

      {status === 'loading' && <p className="cm__empty">불러오는 중…</p>}
      {status === 'error' && <p className="cm__empty">댓글을 불러오지 못했어요</p>}
      {status === 'ok' && items.length === 0 && <p className="cm__empty">첫 댓글을 남겨보세요!</p>}

      <ul className="cm__list">
        {items.map((item) => (
          <li key={item.id} className="cm__item">
            <div className="cm__meta">
              <strong>{item.nickname}</strong>
              <span>{formatWhen(item.createdAt)}</span>
              {item.uid === me && (
                <button type="button" className="cm__del" onClick={() => remove(item.id)}>
                  삭제
                </button>
              )}
            </div>
            <p className="cm__text-body">
              {typeof item.t === 'number' && (
                <button type="button" className="cm__time" onClick={() => onSeek(item.t)} title="이 시각으로 이동">
                  <Icon name="clock" size={12} />
                  {clock(item.t)}
                </button>
              )}
              {item.text}
            </p>
          </li>
        ))}
      </ul>
      </div>
    </section>
  );
}

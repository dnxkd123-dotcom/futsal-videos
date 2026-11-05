import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '../dates.js';
import { isSignedIn, signIn, signOut, subscribeState, updateState } from './store.js';
import { daysBetween, newId, rankDuty, today } from './duty.js';

export default function DrinkApp() {
  // 'checking' → 'locked' | 'open'
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    isSignedIn()
      .then((yes) => setStatus(yes ? 'open' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  if (status === 'checking') {
    return (
      <div className="dk dk--lock">
        <p className="dk-muted" role="status">
          확인하는 중…
        </p>
      </div>
    );
  }
  if (status === 'locked') return <Lock onUnlock={() => setStatus('open')} />;
  return (
    <Board
      onLock={async () => {
        await signOut().catch(() => {});
        setStatus('locked');
      }}
    />
  );
}

const LOCK_MESSAGES = {
  wrong: '비밀번호가 맞지 않아요',
  blocked: '너무 여러 번 틀렸어요. 잠시 뒤 다시 해 주세요',
  error: '연결하지 못했어요. 잠시 뒤 다시 해 주세요'
};

function Lock({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const wrong = problem !== null;

  const submit = async (event) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const result = await signIn(password).catch(() => 'error');
    setBusy(false);
    if (result === 'ok') onUnlock();
    else {
      setProblem(result);
      setPassword('');
    }
  };

  return (
    <div className="dk dk--lock">
      <form className="dk-lock" onSubmit={submit}>
        <img src="../favicon.png" alt="" width="40" height="40" />
        <h1>음료수 당번</h1>
        <p className="dk-muted">비밀번호를 입력해 주세요</p>
        <input
          className="dk-input"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setProblem(null);
          }}
          aria-label="비밀번호"
          aria-invalid={wrong}
        />
        {wrong && (
          <p className="dk-error" role="alert">
            {LOCK_MESSAGES[problem]}
          </p>
        )}
        <button className="dk-btn dk-btn--primary" type="submit" disabled={!password || busy}>
          입장
        </button>
      </form>
    </div>
  );
}

/** 오늘 온 사람 — 이 기기에만 저장하고, 날짜가 바뀌면 비운다 */
const PRESENT_KEY = 'drink:present';
function loadPresent() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRESENT_KEY));
    if (saved?.date === today() && Array.isArray(saved.names)) return new Set(saved.names);
  } catch {
    /* 없거나 깨졌으면 빈 값 */
  }
  return new Set();
}
function savePresent(names) {
  try {
    localStorage.setItem(PRESENT_KEY, JSON.stringify({ date: today(), names: [...names] }));
  } catch {
    /* 무시 */
  }
}

function Board({ onLock }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [present, setPresent] = useState(loadPresent);
  const [date, setDate] = useState(today);
  const [lastRecord, setLastRecord] = useState(null); // 방금 남긴 기록 (되돌리기용)

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    subscribeState(
      (next) => {
        setData(next);
        setLoadError('');
      },
      () => setLoadError('기록을 불러오지 못했어요. 새로고침해 주세요.')
    )
      .then((stop) => (cancelled ? stop() : (unsubscribe = stop)))
      .catch(() => setLoadError('연결하지 못했어요. 새로고침해 주세요.'));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const save = async (change) => {
    setBusy(true);
    setSaveError('');
    try {
      await updateState(change);
      return true;
    } catch {
      setSaveError('저장하지 못했어요. 잠시 뒤 다시 해 주세요.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const members = data?.members ?? [];
  const history = data?.history ?? [];
  // 멤버에서 빠진 사람은 출석에서도 뺀다
  const attending = useMemo(() => new Set(members.filter((name) => present.has(name))), [members, present]);
  const pool = useMemo(() => (attending.size ? attending : new Set(members)), [attending, members]);
  const ranking = useMemo(() => rankDuty(members, history, pool), [members, history, pool]);
  const pick = attending.size ? ranking[0] : null;

  const togglePresent = (name) => {
    const next = new Set(attending);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPresent(next);
    savePresent(next);
  };
  const setAllPresent = (on) => {
    const next = new Set(on ? members : []);
    setPresent(next);
    savePresent(next);
  };

  const record = async (name) => {
    const entry = { id: newId(), date, name };
    if (await save((d) => ({ ...d, history: [...d.history, entry] }))) setLastRecord(entry);
  };
  const removeRecord = async (entry) => {
    if (await save((d) => ({ ...d, history: d.history.filter((item) => item.id !== entry.id) }))) {
      if (lastRecord?.id === entry.id) setLastRecord(null);
    }
  };

  if (loadError) {
    return (
      <div className="dk">
        <p className="dk-error">{loadError}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="dk">
        <p className="dk-muted" role="status">
          불러오는 중…
        </p>
      </div>
    );
  }

  const now = today();
  return (
    <div className="dk">
      <header className="dk-head">
        <div>
          <h1>음료수 당번</h1>
          <p className="dk-muted">{formatDate(now).long}</p>
        </div>
        <button className="dk-btn" type="button" onClick={onLock}>
          잠그기
        </button>
      </header>

      {saveError && (
        <p className="dk-error dk-banner" role="alert">
          {saveError}
        </p>
      )}

      {members.length === 0 ? (
        <section className="dk-card dk-empty">
          <p>먼저 아래 멤버 관리에서 멤버를 추가해 주세요.</p>
        </section>
      ) : (
        <>
          <section className="dk-card" aria-labelledby="dk-present">
            <div className="dk-row">
              <h2 id="dk-present">오늘 온 사람 · {attending.size}명</h2>
              <div className="dk-links">
                <button type="button" onClick={() => setAllPresent(true)}>
                  모두
                </button>
                <button type="button" onClick={() => setAllPresent(false)}>
                  비우기
                </button>
              </div>
            </div>
            <div className="dk-chips">
              {members.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="dk-chip"
                  aria-pressed={attending.has(name)}
                  onClick={() => togglePresent(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section className="dk-card dk-pick" aria-live="polite">
            {pick ? (
              <>
                <p className="dk-pick__label">오늘의 당번</p>
                <p className="dk-pick__name">{pick.name}</p>
                <p className="dk-muted">{describe(pick, now)}</p>
                <div className="dk-pick__actions">
                  <label className="dk-date">
                    <span>산 날</span>
                    <input type="date" value={date} max={now} onChange={(event) => setDate(event.target.value || now)} />
                  </label>
                  <button className="dk-btn dk-btn--primary" type="button" disabled={busy} onClick={() => record(pick.name)}>
                    {pick.name} 사 왔어요
                  </button>
                </div>
              </>
            ) : (
              <p className="dk-muted">오늘 온 사람을 고르면 당번을 정해 드려요.</p>
            )}
            {lastRecord && (
              <p className="dk-done">
                {formatDate(lastRecord.date).title} · {lastRecord.name} 기록했어요
                <button type="button" disabled={busy} onClick={() => removeRecord(lastRecord)}>
                  되돌리기
                </button>
              </p>
            )}
          </section>

          <section className="dk-card" aria-labelledby="dk-rank">
            <h2 id="dk-rank">{attending.size ? '오늘 온 사람 순서' : '전체 순서'}</h2>
            <ol className="dk-list">
              {ranking.map((stat, index) => (
                <li key={stat.name} className="dk-item">
                  <span className="dk-item__rank">{index + 1}</span>
                  <span className="dk-item__main">
                    <strong>{stat.name}</strong>
                    <span className="dk-muted">{describe(stat, now)}</span>
                  </span>
                  <button className="dk-btn dk-btn--small" type="button" disabled={busy} onClick={() => record(stat.name)}>
                    사 왔어요
                  </button>
                </li>
              ))}
            </ol>
            <p className="dk-note">
              사 온 지 오래된 사람이 먼저예요. 한 번도 안 산 사람이 맨 앞이고, 날짜가 같으면 산 횟수가 적은 사람, 그것도
              같으면 멤버 목록 순서예요.
            </p>
          </section>
        </>
      )}

      <History history={history} busy={busy} onRemove={removeRecord} />
      <Members members={members} busy={busy} save={save} />
    </div>
  );
}

function describe(stat, now) {
  if (!stat.last) return '아직 한 번도 안 샀어요';
  const days = daysBetween(stat.last, now);
  const ago = days <= 0 ? '오늘' : `${days}일 전`;
  return `마지막 ${formatDate(stat.last).title} (${ago}) · ${stat.count}번 샀어요`;
}

const HISTORY_PREVIEW = 10;

function History({ history, busy, onRemove }) {
  const [all, setAll] = useState(false);
  const sorted = useMemo(
    () => history.map((entry, index) => ({ entry, index })).sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index),
    [history]
  );
  const shown = all ? sorted : sorted.slice(0, HISTORY_PREVIEW);

  return (
    <section className="dk-card" aria-labelledby="dk-history">
      <h2 id="dk-history">기록 · {history.length}번</h2>
      {history.length === 0 ? (
        <p className="dk-muted">아직 기록이 없어요. 예전에 사 온 기록이 있으면 위에서 날짜를 바꿔서 남길 수 있어요.</p>
      ) : (
        <ul className="dk-list">
          {shown.map(({ entry }) => (
            <li key={entry.id} className="dk-item">
              <span className="dk-item__date">{formatDate(entry.date).md}</span>
              <span className="dk-item__main">
                <strong>{entry.name}</strong>
              </span>
              <button
                className="dk-btn dk-btn--small dk-btn--quiet"
                type="button"
                disabled={busy}
                onClick={() => window.confirm(`${formatDate(entry.date).title} ${entry.name} 기록을 지울까요?`) && onRemove(entry)}
              >
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
      {sorted.length > HISTORY_PREVIEW && (
        <button className="dk-more" type="button" onClick={() => setAll((v) => !v)}>
          {all ? '접기' : `${sorted.length - HISTORY_PREVIEW}개 더 보기`}
        </button>
      )}
    </section>
  );
}

function Members({ members, busy, save }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const duplicate = members.includes(trimmed);

  const add = async (event) => {
    event.preventDefault();
    if (!trimmed || duplicate) return;
    if (await save((d) => (d.members.includes(trimmed) ? d : { ...d, members: [...d.members, trimmed] }))) setName('');
  };
  const remove = (target) => {
    if (!window.confirm(`${target} 님을 멤버에서 뺄까요? (지난 기록은 남아요)`)) return;
    save((d) => ({ ...d, members: d.members.filter((item) => item !== target) }));
  };

  return (
    <section className="dk-card" aria-labelledby="dk-members">
      <h2 id="dk-members">멤버 관리 · {members.length}명</h2>
      <form className="dk-add" onSubmit={add}>
        <input
          className="dk-input"
          value={name}
          maxLength={20}
          placeholder="이름"
          aria-label="추가할 멤버 이름"
          onChange={(event) => setName(event.target.value)}
        />
        <button className="dk-btn" type="submit" disabled={!trimmed || duplicate || busy}>
          추가
        </button>
      </form>
      {duplicate && <p className="dk-error">이미 있는 이름이에요</p>}
      {members.length > 0 && (
        <div className="dk-chips">
          {members.map((member) => (
            <span key={member} className="dk-chip dk-chip--static">
              {member}
              <button type="button" disabled={busy} aria-label={`${member} 빼기`} onClick={() => remove(member)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

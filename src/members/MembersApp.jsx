import { useEffect, useMemo, useState } from 'react';
import { isSignedIn, signIn, signOut } from '../drink/store.js';
import { newId, parseNames, shiftMonth, subscribeRoster, thisMonth, updateRoster } from './store.js';

const STATUSES = [
  { id: 'ok', label: '정상' },
  { id: 'injury', label: '부상' },
  { id: 'absent', label: '불참' },
  { id: 'etc', label: '기타' }
];
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
const REASON_HINT = { injury: '사유 (예: 발목 염좌, 12월 복귀)', absent: '사유 (예: 출장, 개인 일정)', etc: '사유 (예: 휴식, 군 복무)' };

export default function MembersApp() {
  const [status, setStatus] = useState('checking'); // checking → locked | open
  useEffect(() => {
    isSignedIn()
      .then((yes) => setStatus(yes ? 'open' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  if (status === 'checking') {
    return (
      <div className="mb mb--center">
        <p className="mb-muted" role="status">
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
    <div className="mb mb--center">
      <form className="mb-lock" onSubmit={submit}>
        <img src="../favicon.png" alt="" width="40" height="40" />
        <h1>멤버 관리</h1>
        <p className="mb-muted">운영진 비밀번호를 입력해 주세요</p>
        <input
          className="mb-input"
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
          aria-invalid={problem !== null}
        />
        {problem && (
          <p className="mb-error" role="alert">
            {LOCK_MESSAGES[problem]}
          </p>
        )}
        <button className="mb-btn mb-btn--primary" type="submit" disabled={!password || busy}>
          입장
        </button>
      </form>
    </div>
  );
}

function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

function Board({ onLock }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [month, setMonth] = useState(thisMonth);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe;
    subscribeRoster(
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
    setSaveError('');
    try {
      await updateRoster(change);
      return true;
    } catch {
      setSaveError('저장하지 못했어요. 잠시 뒤 다시 해 주세요.');
      return false;
    }
  };

  const members = data?.members ?? [];
  const entries = data?.months?.[month] ?? {};
  const prevEntries = data?.months?.[shiftMonth(month, -1)] ?? {};
  const statusOf = (member) => entries[member.id]?.status ?? 'ok';

  const counts = useMemo(() => {
    const result = { all: members.length, ok: 0, injury: 0, absent: 0, etc: 0 };
    for (const member of members) result[entries[member.id]?.status ?? 'ok'] += 1;
    return result;
  }, [members, entries]);

  const shown = members.filter(
    (member) => (filter === 'all' || statusOf(member) === filter) && (!query.trim() || member.name.includes(query.trim()))
  );

  // 이번 달 기록 한 칸 바꾸기 — 정상이면 기록을 지운다
  const setEntry = (memberId, patch) =>
    save((d) => {
      const monthEntries = { ...(d.months[month] ?? {}) };
      const next = { status: 'etc', reason: '', ...monthEntries[memberId], ...patch };
      if (next.status === 'ok') delete monthEntries[memberId];
      else monthEntries[memberId] = { status: next.status, reason: String(next.reason).slice(0, 100) };
      return { ...d, months: { ...d.months, [month]: monthEntries } };
    });

  // 지난달 기록 중 이번 달에 아직 없는 것만 가져온다 (긴 부상 · 장기 불참용)
  const carryOver = () =>
    save((d) => {
      const prev = d.months[shiftMonth(month, -1)] ?? {};
      const current = { ...(d.months[month] ?? {}) };
      const ids = new Set(d.members.map((m) => m.id));
      for (const [id, entry] of Object.entries(prev)) if (ids.has(id) && !current[id]) current[id] = entry;
      return { ...d, months: { ...d.months, [month]: current } };
    });
  const carryable = members.filter((m) => prevEntries[m.id] && !entries[m.id]).length;

  // 카톡에 붙여넣을 이번 달 요약
  const copySummary = async () => {
    const lines = [`[${monthTitle(month)} 우탕 멤버 현황]`];
    for (const s of ['injury', 'absent', 'etc']) {
      const list = members.filter((m) => statusOf(m) === s);
      lines.push(`${LABEL[s]} ${list.length}명${list.length ? ': ' + list.map((m) => (entries[m.id].reason ? `${m.name}(${entries[m.id].reason})` : m.name)).join(', ') : ''}`);
    }
    lines.push(`정상 ${counts.ok}명 / 전체 ${counts.all}명`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('아래 내용을 복사해 주세요', lines.join('\n'));
    }
  };

  if (loadError) {
    return (
      <div className="mb mb--center">
        <p className="mb-error">{loadError}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mb mb--center">
        <p className="mb-muted" role="status">
          불러오는 중…
        </p>
      </div>
    );
  }

  return (
    <div className="mb">
      <header className="mb-head">
        <h1>멤버 관리</h1>
        <button className="mb-btn mb-btn--quiet" type="button" onClick={onLock}>
          잠그기
        </button>
      </header>

      {saveError && (
        <p className="mb-error mb-banner" role="alert">
          {saveError}
        </p>
      )}

      <section className="mb-card mb-month" aria-label="달 선택">
        <div className="mb-month__nav">
          <button className="mb-icon" type="button" aria-label="지난달" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            ‹
          </button>
          <h2>{monthTitle(month)}</h2>
          <button className="mb-icon" type="button" aria-label="다음 달" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            ›
          </button>
        </div>
        <div className="mb-stats">
          {['injury', 'absent', 'etc', 'ok'].map((s) => (
            <div key={s} className={`mb-stat mb-stat--${s}`}>
              <span>{LABEL[s]}</span>
              <strong>{counts[s]}</strong>
            </div>
          ))}
        </div>
        <div className="mb-month__actions">
          <button className="mb-btn" type="button" onClick={copySummary} disabled={!members.length}>
            {copied ? '복사했어요' : '카톡용 요약 복사'}
          </button>
          {carryable > 0 && (
            <button className="mb-btn" type="button" onClick={carryOver}>
              지난달 기록 {carryable}명 가져오기
            </button>
          )}
        </div>
      </section>

      <section className="mb-card" aria-label="멤버 상태">
        <div className="mb-tools">
          <div className="mb-tabs" role="group" aria-label="보기">
            {[{ id: 'all', label: '전체' }, ...STATUSES.slice(1), STATUSES[0]].map((s) => (
              <button key={s.id} type="button" aria-pressed={filter === s.id} onClick={() => setFilter(s.id)}>
                {s.label} <span>{counts[s.id]}</span>
              </button>
            ))}
          </div>
          <input
            className="mb-input mb-search"
            type="search"
            placeholder="이름 찾기"
            aria-label="이름 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {members.length === 0 ? (
          <p className="mb-muted mb-empty">아직 멤버가 없어요. 아래 멤버 관리에서 추가해 주세요.</p>
        ) : shown.length === 0 ? (
          <p className="mb-muted mb-empty">해당하는 멤버가 없어요.</p>
        ) : (
          <ul className="mb-list">
            {shown.map((member) => {
              const entry = entries[member.id];
              const current = entry?.status ?? 'ok';
              return (
                <li key={member.id} className={`mb-row mb-row--${current}`}>
                  <div className="mb-row__top">
                    <strong className="mb-name">{member.name}</strong>
                    <div className="mb-seg" role="group" aria-label={`${member.name} 상태`}>
                      {STATUSES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`mb-seg__${s.id}`}
                          aria-pressed={current === s.id}
                          onClick={() => current !== s.id && setEntry(member.id, { status: s.id })}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {current !== 'ok' && (
                    <input
                      key={`${member.id}-${month}-${entry?.reason ?? ''}`}
                      className="mb-input mb-reason"
                      defaultValue={entry?.reason ?? ''}
                      maxLength={100}
                      placeholder={REASON_HINT[current]}
                      aria-label={`${member.name} 사유`}
                      onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                      onBlur={(event) => {
                        const reason = event.target.value.trim();
                        if (reason !== (entry?.reason ?? '')) setEntry(member.id, { reason });
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Manage members={members} save={save} />
    </div>
  );
}

/** 멤버 추가 (한 명 또는 엑셀에서 복사한 여러 명) · 이름 수정 · 삭제 */
function Manage({ members, save }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const names = parseNames(text);
  const fresh = names.filter((name) => !members.some((m) => m.name === name));

  const add = async (event) => {
    event.preventDefault();
    if (!fresh.length) return;
    const ok = await save((d) => {
      const existing = new Set(d.members.map((m) => m.name));
      const added = parseNames(text).filter((name) => !existing.has(name)).map((name) => ({ id: newId(), name }));
      return { ...d, members: [...d.members, ...added] };
    });
    if (ok) {
      setMessage(`${fresh.length}명 추가했어요`);
      setText('');
    }
  };

  const rename = (member, name) => {
    const next = name.trim();
    if (!next || next === member.name) return;
    if (members.some((m) => m.name === next)) {
      setMessage(`이미 '${next}' 이(가) 있어요`);
      return;
    }
    save((d) => ({ ...d, members: d.members.map((m) => (m.id === member.id ? { ...m, name: next.slice(0, 20) } : m)) }));
  };

  const remove = (member) => {
    if (!window.confirm(`${member.name} 님을 멤버에서 뺄까요?\n지난 달 기록도 함께 지워져요.`)) return;
    save((d) => {
      const months = Object.fromEntries(
        Object.entries(d.months).map(([key, entries]) => {
          const copy = { ...entries };
          delete copy[member.id];
          return [key, copy];
        })
      );
      return { ...d, members: d.members.filter((m) => m.id !== member.id), months };
    });
  };

  return (
    <section className="mb-card" aria-labelledby="mb-manage">
      <button className="mb-fold" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} id="mb-manage">
        멤버 관리 · {members.length}명 <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <form className="mb-add" onSubmit={add}>
            <textarea
              className="mb-input"
              rows={3}
              value={text}
              placeholder={'이름 하나, 또는 엑셀에서 이름 칸을 복사해 붙여넣기\n(쉼표 · 줄바꿈으로 여러 명)'}
              aria-label="추가할 멤버 이름"
              onChange={(event) => {
                setText(event.target.value);
                setMessage('');
              }}
            />
            <button className="mb-btn mb-btn--primary" type="submit" disabled={!fresh.length}>
              {fresh.length ? `${fresh.length}명 추가` : '추가'}
            </button>
          </form>
          {names.length > fresh.length && <p className="mb-muted mb-note">이미 있는 이름 {names.length - fresh.length}명은 빼고 추가해요.</p>}
          {message && (
            <p className="mb-note" role="status">
              {message}
            </p>
          )}
          <ul className="mb-edit">
            {members.map((member) => (
              <li key={member.id}>
                <input
                  key={member.name}
                  className="mb-input"
                  defaultValue={member.name}
                  maxLength={20}
                  aria-label={`${member.name} 이름 수정`}
                  onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                  onBlur={(event) => rename(member, event.target.value)}
                />
                <button className="mb-btn mb-btn--quiet" type="button" onClick={() => remove(member)} aria-label={`${member.name} 삭제`}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

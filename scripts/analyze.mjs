/**
 * 영상 AI 분석 — 하이라이트 구간을 src/analysis.json 에 채운다.
 *
 *   npm run analyze              분석 안 된 영상만
 *   npm run analyze -- 영상ID     그 영상만 (이미 있어도 다시)
 *   npm run analyze -- --force   전부 다시
 *   npm run analyze -- 영상ID --dry   저장하지 않고 결과만 출력 (프롬프트 시험용)
 *   --no-verify                  2단계 골 검증을 건너뛴다 (빠르지만 덜 정확)
 *
 * 1단계: 영상 전체를 보고 하이라이트 후보를 뽑는다.
 * 2단계: 골 · 슈팅 · 선방 후보마다 앞뒤 20초 구간만 잘라 촘촘하게(초당 3장, 고해상도) 다시 보여주고
 *        진짜 골인지 판정한다. 골이 아닌데 골이라 하거나, 골인데 슈팅으로 적는 실수를 여기서 바로잡는다.
 *        클립은 최대 10개씩 묶어 한 번에 보낸다 — 영상 하나에 호출 2~3번 (무료 요금제는 하루 20번까지).
 *
 * 유튜브 링크를 구글 Gemini API 에 그대로 넘긴다 (공개 영상만 가능, 내려받지 않음).
 * 키는 .env 의 GEMINI_API_KEY — 사이트 코드에는 들어가지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const VIDEOS = new URL('../src/videos.json', import.meta.url);
const ANALYSIS = new URL('../src/analysis.json', import.meta.url);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// 검증용 모델 — 비워 두면 MODEL 과 같다. 검증만 더 정확한 모델로 돌리고 싶을 때
const VERIFY_MODEL = process.env.GEMINI_VERIFY_MODEL || MODEL;
const KEY = process.env.GEMINI_API_KEY;

const TYPES = ['goal', 'shot', 'save', 'play', 'foul', 'other'];
const CHECK_TYPES = ['goal', 'shot', 'save']; // 2단계에서 다시 볼 종류
const CLIP_BEFORE = 8; // 후보 시각 앞으로 몇 초부터
const CLIP_AFTER = 12; // 뒤로 몇 초까지 (골이면 직후 환호·재시작까지 보이도록 넉넉히)
const CLIP_FPS = 3; // 클립은 초당 3장 — 1단계(초당 1장)보다 촘촘하게
// 클립을 한 번에 몇 개씩 묶어 보낼지. 무료 요금제는 하루 호출 수가 적어서(모델당 20번) 묶어야 영상 여러 편을 돌릴 수 있다
const CLIPS_PER_CALL = 10;

const PROMPT = `이 영상은 아마추어 풋살 경기(또는 연습) 촬영본입니다. 한국어로 분석해 주세요.

영상 전체를 처음부터 끝까지 보고 하이라이트를 시간순으로 추출하세요. (개수 제한 없음)
   - time: 장면이 시작되는 시각. 영상이 1시간 미만이면 반드시 "MM:SS" ("1:14" 가 아니라 "01:14")
   - label: 15자 이내 설명 (예: "역습 후 슈팅", "골키퍼 선방")
   - type: ${TYPES.join(' | ')} 중 하나

type 판단 기준:
   - goal: 득점으로 보이는 장면. 공이 골문 안으로 들어간 것이 보이거나, 들어가는 순간이 정확히 안 보여도 직후 선수들이 환호·하이파이브를 하거나 공을 센터로 가져가 경기를 다시 시작하면 goal.  → 하나도 빠뜨리지 마세요.
   - save: 골키퍼나 수비수가 슈팅을 막아내는 장면.  → 하나도 빠뜨리지 마세요.
   - shot: 골문을 위협한 슈팅 중 득점이 아닌 것. 힘없이 빗맞거나 의미 없는 슛은 제외.
   - play: 상대 수비를 따돌리는 패스·드리블로 슈팅 기회를 만든 장면. 한 영상에 최대 3개.
   - foul: 파울, 경고, 거친 몸싸움.
   - other: 위에 없는 인상적인 장면. 한 영상에 최대 2개.

규칙:
   - 같은 공격 흐름에서 3초 안에 이어지는 장면은 하나로 합치세요.
   - 선수 이름이나 점수는 추측하지 말고, 화면에서 확인되는 것만 쓰세요.
   - 골인지 애매한 슈팅도 빠뜨리지 말고 shot 으로라도 넣어 주세요. (뒤에서 한 번 더 확인합니다)`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    highlights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          time: { type: 'STRING' },
          label: { type: 'STRING' },
          type: { type: 'STRING', enum: TYPES }
        },
        required: ['time', 'label', 'type']
      }
    }
  },
  required: ['highlights']
};

const VERIFY_PROMPT = `위의 클립들은 같은 아마추어 풋살 경기 영상에서 잘라낸 장면들(각 약 20초)입니다.
각 클립 바로 앞에 "장면 N" 이라고 번호를 붙여 두었고, 각 클립 가운데쯤에 슈팅이 있습니다.
장면마다 따로, 그 슈팅이 실제로 득점(골)이 됐는지만 엄격하게 판정하세요. 모든 장면 번호에 대해 결과를 하나씩 주세요.

골로 판정하려면 아래 중 하나가 화면에서 분명히 보여야 합니다.
   - 공이 골라인을 완전히 넘어 골문 안(그물 안쪽)에 들어간다
   - 그물 안쪽이 출렁이거나, 골문 안에 있는 공을 꺼낸다
   - 슈팅 직후 하프라인(센터)에서 킥오프로 경기를 다시 시작한다
선수들의 환호는 보조 증거일 뿐, 환호만으로 골이라고 하지 마세요.

골이 아닌 경우:
   - 골키퍼가 잡거나 쳐냄 → outcome "save"
   - 골대·크로스바를 맞고 나옴, 옆그물 바깥쪽을 맞음, 골문 옆·위로 나감 → outcome "miss"
   - 수비수 몸에 막힘 → outcome "blocked"
   - 클립 안에 슈팅이 없음 → outcome "none"

위 증거를 확인할 수 없으면 verdict 를 "unsure" 로 하세요. 추측하지 마세요.
evidence 는 판단 근거를 한 문장으로, label 은 판정 결과에 맞는 15자 이내 한국어 설명입니다 (예: "왼발 슈팅 골", "골키퍼 정면 선방").`;

const VERIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scene: { type: 'INTEGER' },
          verdict: { type: 'STRING', enum: ['goal', 'no_goal', 'unsure'] },
          outcome: { type: 'STRING', enum: ['goal', 'save', 'miss', 'blocked', 'none'] },
          evidence: { type: 'STRING' },
          label: { type: 'STRING' }
        },
        required: ['scene', 'verdict', 'outcome', 'evidence', 'label']
      }
    }
  },
  required: ['results']
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const youtube = (id) => ({ fileUri: `https://www.youtube.com/watch?v=${id}` });
const clock = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

/** Gemini 호출 → JSON. 서버가 바쁘다(429·503)고 하면 조금씩 더 기다렸다가 다시 시도한다 */
async function callGemini(model, parts, schema, extraConfig = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts }],
        // temperature 를 낮춰서 같은 영상을 다시 돌려도 결과가 덜 흔들리게 한다
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, ...extraConfig }
      })
    });
    const data = await res.json();
    if (!res.ok) {
      const message = data.error?.message || `API 오류 (${res.status})`;
      // 하루 한도가 끝난 거면 기다려도 소용없다 — 바로 멈춘다
      if (/per day|PerDay/i.test(message)) throw Object.assign(new Error(`하루 무료 한도를 다 썼어요. ${message.split('\n')[0]}`), { daily: true });
      if ((res.status === 429 || res.status === 503) && attempt < 5) {
        await sleep(attempt * 20000); // 분당 한도일 수 있으니 넉넉히 쉬었다가
        continue;
      }
      throw new Error(message);
    }
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    if (!text) throw new Error('응답이 비어 있어요 (영상이 비공개이거나 분석이 거부됐을 수 있어요)');
    return JSON.parse(text);
  }
}

/** "03:12" · "1:03:12" → 초. 형식이 이상하면 null */
function toSeconds(text) {
  const parts = String(text).trim().split(':').map(Number);
  if (!parts.length || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** 1단계 — 영상 전체에서 하이라이트 후보 */
async function findHighlights(id) {
  const parsed = await callGemini(MODEL, [{ fileData: youtube(id) }, { text: PROMPT }], SCHEMA);
  return (parsed.highlights ?? [])
    .map((item) => ({
      t: toSeconds(item.time),
      label: String(item.label ?? '').trim(),
      type: TYPES.includes(item.type) ? item.type : 'other'
    }))
    .filter((item) => item.t !== null && item.label)
    .sort((a, b) => a.t - b.t);
}

/** 2단계 — 후보 여러 개를 짧게 잘라 한 번에 보내고, 장면마다 골인지 판정. 결과는 items 순서대로 */
async function verifyShots(id, items) {
  const parts = items.flatMap((item, i) => [
    { text: `장면 ${i + 1}` },
    {
      fileData: youtube(id),
      videoMetadata: { startOffset: `${Math.max(0, item.t - CLIP_BEFORE)}s`, endOffset: `${item.t + CLIP_AFTER}s`, fps: CLIP_FPS }
    }
  ]);
  const parsed = await callGemini(VERIFY_MODEL, [...parts, { text: VERIFY_PROMPT }], VERIFY_SCHEMA, {
    mediaResolution: 'MEDIA_RESOLUTION_HIGH'
  });
  const byScene = new Map((parsed.results ?? []).map((result) => [result.scene, result]));
  // 빠뜨린 장면은 '애매'로 본다 (1단계 결과를 그대로 둔다)
  return items.map((_, i) => byScene.get(i + 1) ?? { verdict: 'unsure', outcome: 'none', evidence: '응답에 이 장면이 없음' });
}

/** 판정 결과로 종류를 고친다. 애매하면(unsure) 1단계 결과를 그대로 두고, 슈팅이 없던 장면은 null(삭제) */
function applyVerdict(item, check) {
  if (check.verdict === 'unsure') return item;
  if (check.verdict !== 'goal' && check.outcome === 'none') return null;
  const type = check.verdict === 'goal' ? 'goal' : check.outcome === 'save' ? 'save' : 'shot';
  if (type === item.type) return item;
  return { ...item, type, label: String(check.label ?? '').trim() || item.label };
}

async function analyze(id, { verify, onCheck }) {
  const found = await findHighlights(id);
  const meta = { model: MODEL, analyzedAt: new Date().toISOString().slice(0, 10) };
  if (!verify) return { highlights: found, ...meta };

  const toCheck = found.filter((item) => CHECK_TYPES.includes(item.type));
  const checks = new Map();
  for (let i = 0; i < toCheck.length; i += CLIPS_PER_CALL) {
    const batch = toCheck.slice(i, i + CLIPS_PER_CALL);
    try {
      const results = await verifyShots(id, batch);
      batch.forEach((item, j) => checks.set(item, results[j]));
    } catch (err) {
      if (err.daily) throw err; // 하루 한도 — 이 영상은 저장하지 않고 다음에 다시
      // 다른 실패는 그 묶음만 1단계 결과로 남긴다
      batch.forEach((item) => checks.set(item, { verdict: 'error', evidence: err.message }));
    }
  }

  const highlights = [];
  for (const item of found) {
    const check = checks.get(item);
    if (!check) {
      highlights.push(item);
      continue;
    }
    const fixed = check.verdict === 'error' ? item : applyVerdict(item, check);
    onCheck?.(item, fixed, check);
    if (fixed) highlights.push(fixed);
  }

  // 같은 골이 두 번 잡힌 경우(10초 안에 골 두 개) 앞의 것만 남긴다
  const deduped = highlights.filter(
    (item, index) =>
      item.type !== 'goal' || !highlights.slice(0, index).some((prev) => prev.type === 'goal' && item.t - prev.t < 10)
  );

  return {
    highlights: deduped,
    ...meta,
    model: VERIFY_MODEL === MODEL ? MODEL : `${MODEL} + ${VERIFY_MODEL}`,
    // 검증 묶음이 하나라도 실패했으면 '검증됨'으로 치지 않는다
    verified: ![...checks.values()].some((check) => check.verdict === 'error')
  };
}

async function main() {
  if (!KEY) {
    console.error('GEMINI_API_KEY 가 없어요. .env.example 을 .env 로 복사해서 키를 넣어 주세요.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dry = args.includes('--dry');
  const verify = !args.includes('--no-verify');
  const onlyId = args.find((arg) => !arg.startsWith('--'));

  const videos = JSON.parse(readFileSync(VIDEOS, 'utf8'));
  const analysis = JSON.parse(readFileSync(ANALYSIS, 'utf8'));
  const targets = videos.filter((video) =>
    onlyId ? video.id === onlyId : force || !analysis[video.id]
  );
  if (onlyId && !targets.length) {
    console.error(`videos.json 에 없는 영상이에요: ${onlyId}`);
    process.exit(1);
  }
  if (!targets.length) {
    console.log('새로 분석할 영상이 없어요.');
    return;
  }

  // 검증에서 결과가 바뀐 장면만 보여준다
  const onCheck = (before, after, check) => {
    const result = check.verdict === 'error' ? '검증 실패' : !after ? '삭제 (슈팅 없음)' : after.type;
    if (after && after.type === before.type && check.verdict !== 'error') return;
    console.log(`\n   검증 ${clock(before.t)}  ${before.type} → ${result}  — ${check.evidence ?? ''}`);
  };

  let done = 0;
  for (const video of targets) {
    process.stdout.write(`[${done + 1}/${targets.length}] ${video.title} (${video.id}) … `);
    try {
      const result = await analyze(video.id, { verify, onCheck });
      const goals = result.highlights.filter((item) => item.type === 'goal').length;
      if (dry) {
        // 저장하지 않고 화면에만 보여준다 (프롬프트 시험용)
        console.log(`\n   하이라이트 ${result.highlights.length}개 · 골 ${goals}개 (저장 안 함)`);
        for (const item of result.highlights) {
          console.log(`   ${clock(item.t).padStart(5)}  ${item.type.padEnd(5)}  ${item.label}`);
        }
      } else {
        analysis[video.id] = result;
        // 하나 끝날 때마다 저장 — 중간에 멈춰도 앞의 것은 남는다
        writeFileSync(ANALYSIS, JSON.stringify(analysis, null, 2) + '\n');
        console.log(`하이라이트 ${result.highlights.length}개 · 골 ${goals}개`);
      }
      done += 1;
    } catch (err) {
      console.log(`실패: ${err.message}`);
      if (err.daily) break; // 남은 영상도 어차피 실패하니 여기서 멈춘다
    }
  }
  console.log(`끝 — ${done}/${targets.length}개 분석했어요.${dry ? ' (저장 안 함)' : ' 확인 후 커밋·푸시하세요.'}`);
}

main();

/**
 * 영상 AI 분석 — 요약 + 하이라이트 구간을 src/analysis.json 에 채운다.
 *
 *   npm run analyze              분석 안 된 영상만
 *   npm run analyze -- 영상ID     그 영상만 (이미 있어도 다시)
 *   npm run analyze -- --force   전부 다시
 *   npm run analyze -- 영상ID --dry   저장하지 않고 결과만 출력 (프롬프트 시험용)
 *
 * 유튜브 링크를 구글 Gemini API 에 그대로 넘긴다 (공개 영상만 가능, 내려받지 않음).
 * 키는 .env 의 GEMINI_API_KEY — 사이트 코드에는 들어가지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const VIDEOS = new URL('../src/videos.json', import.meta.url);
const ANALYSIS = new URL('../src/analysis.json', import.meta.url);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const KEY = process.env.GEMINI_API_KEY;

const TYPES = ['goal', 'shot', 'save', 'play', 'foul', 'other'];

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
   - 선수 이름이나 점수는 추측하지 말고, 화면에서 확인되는 것만 쓰세요.`;

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

/** "03:12" · "1:03:12" → 초. 형식이 이상하면 null */
function toSeconds(text) {
  const parts = String(text).trim().split(':').map(Number);
  if (!parts.length || parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

async function analyze(id) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { fileUri: `https://www.youtube.com/watch?v=${id}` } },
              { text: PROMPT }
            ]
          }
        ],
        // temperature 를 낮춰서 같은 영상을 다시 돌려도 결과가 덜 흔들리게 한다
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 }
      })
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `API 오류 (${res.status})`);

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('응답이 비어 있어요 (영상이 비공개이거나 분석이 거부됐을 수 있어요)');
  const parsed = JSON.parse(text);

  const highlights = (parsed.highlights ?? [])
    .map((item) => ({
      t: toSeconds(item.time),
      label: String(item.label ?? '').trim(),
      type: TYPES.includes(item.type) ? item.type : 'other'
    }))
    .filter((item) => item.t !== null && item.label)
    .sort((a, b) => a.t - b.t);

  return {
    highlights,
    model: MODEL,
    analyzedAt: new Date().toISOString().slice(0, 10)
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

  let done = 0;
  for (const video of targets) {
    process.stdout.write(`[${done + 1}/${targets.length}] ${video.title} (${video.id}) … `);
    try {
      const result = await analyze(video.id);
      if (dry) {
        // 저장하지 않고 화면에만 보여준다 (프롬프트 시험용)
        console.log(`하이라이트 ${result.highlights.length}개 (저장 안 함)`);
        for (const item of result.highlights) {
          const clock = `${Math.floor(item.t / 60)}:${String(item.t % 60).padStart(2, '0')}`;
          console.log(`   ${clock}  ${item.type.padEnd(5)}  ${item.label}`);
        }
      } else {
        analysis[video.id] = result;
        // 하나 끝날 때마다 저장 — 중간에 멈춰도 앞의 것은 남는다
        writeFileSync(ANALYSIS, JSON.stringify(analysis, null, 2) + '\n');
        console.log(`하이라이트 ${result.highlights.length}개`);
      }
      done += 1;
    } catch (err) {
      console.log(`실패: ${err.message}`);
    }
  }
  console.log(`끝 — ${done}/${targets.length}개 분석했어요.${dry ? ' (저장 안 함)' : ' 확인 후 커밋·푸시하세요.'}`);
}

main();

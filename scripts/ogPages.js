/**
 * 영상마다 카카오톡/SNS 미리보기용 페이지를 만든다 — 빌드 때 dist/v/<영상ID>/index.html
 *
 * 카카오톡은 자바스크립트를 실행하지 않고 HTML 의 og 태그만 읽는다. 그래서 주소(?v=…)만 다른
 * 한 페이지로는 영상별 미리보기를 못 만들고, 영상마다 og 태그가 다른 HTML 이 따로 있어야 한다.
 * 만든 페이지는 사이트와 똑같이 동작한다 (경로의 영상 ID 를 앱이 읽어서 팝업을 연다).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const SITE = 'https://dnxkd123-dotcom.github.io/futsal-videos/';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** <meta property|name="key" content="…"> 의 content 를 바꾼다 */
function setMeta(html, key, content) {
  const pattern = new RegExp(`(<meta (?:property|name)="${key}" content=")[^"]*(")`);
  return html.replace(pattern, `$1${escapeHtml(content)}$2`);
}

function displayTitle(title) {
  const match = /^\d{8}(\d{2})$/.exec(title);
  return match ? `${Number(match[1])}번째 영상` : title;
}

/** 큰 썸네일(maxres)이 없는 영상도 있어서, 있는지 확인하고 없으면 기본 썸네일을 쓴다 */
async function thumbnail(id) {
  const big = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  try {
    const res = await fetch(big, { method: 'HEAD' });
    if (res.ok) return { url: big, width: 1280, height: 720 };
  } catch {
    /* 네트워크가 안 되면 기본 썸네일 */
  }
  return { url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, width: 480, height: 360 };
}

export default function ogPages() {
  let outDir = 'dist';
  return {
    name: 'og-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const videos = JSON.parse(readFileSync(new URL('../src/videos.json', import.meta.url), 'utf8'));
      let analysis = {};
      try {
        analysis = JSON.parse(readFileSync(new URL('../src/analysis.json', import.meta.url), 'utf8'));
      } catch {
        /* 분석 파일이 없어도 페이지는 만든다 */
      }
      const template = readFileSync(`${outDir}/index.html`, 'utf8');

      await Promise.all(
        videos.map(async (video) => {
          const [y, m, d] = video.date.split('-').map(Number);
          const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
          const name = displayTitle(video.title);
          const title = `${m}월 ${d}일 ${name} | 우탕 풋살 영상`;
          const highlights = analysis[video.id]?.highlights ?? [];
          const goals = highlights.filter((item) => item.type === 'goal').length;
          const parts = [`${y}년 ${m}월 ${d}일 ${weekday}요일`];
          if (goals) parts.push(`⚽ 골 ${goals}`);
          if (highlights.length) parts.push(`하이라이트 ${highlights.length}장면`);
          const description = `${parts.join(' · ')} — 바로 보러가기`;
          const image = await thumbnail(video.id);
          const url = `${SITE}v/${video.id}/`;

          let html = template;
          // 한 단계 깊은 주소에서도 ./assets, ./favicon.png 가 사이트 맨 위를 가리키게 한다
          html = html.replace('<head>', '<head>\n    <base href="../../" />');
          html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
          html = setMeta(html, 'description', description);
          html = setMeta(html, 'og:title', title);
          html = setMeta(html, 'og:description', description);
          html = setMeta(html, 'og:url', url);
          html = setMeta(html, 'og:image', image.url);
          html = setMeta(html, 'og:image:width', String(image.width));
          html = setMeta(html, 'og:image:height', String(image.height));
          html = setMeta(html, 'twitter:image', image.url);

          const dir = `${outDir}/v/${video.id}`;
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/index.html`, html);
        })
      );
    }
  };
}

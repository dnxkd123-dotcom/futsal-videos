/**
 * src/logo/ 의 그림을 모두 모아 스타일별로 묶고 번호를 붙인다.
 * 그림을 넣거나 빼면 다음 빌드에 저절로 반영된다 (번호는 그때 다시 매겨진다).
 *
 * 파일 이름 앞부분(-- 앞)이 스타일이다. 예) futsal-team-emblem--black-shield-with-white-razor-.png
 */
const files = import.meta.glob('../logo/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });

// 스타일 이름표 — 여기 없는 스타일은 '기타'로 맨 뒤에
const STYLES = [
  ['woodang-tt-cute', 'WOODANG TT · 귀여운'],
  ['woodang-tt-cool', 'WOODANG TT · 멋진'],
  ['woodang-tt-trendy', 'WOODANG TT · 트렌디'],
  ['futsal-team-emblem', '기본 엠블럼'],
  ['cute-and-cool-futsal-team-emblem', '귀엽고 멋진'],
  ['modern-premium-football-club-crest', '모던 프리미엄'],
  ['cute-futsal-team-emblem', '귀여운'],
  ['football-club-style-futsal-team-crest', '축구 클럽'],
  ['professional-futsal-club-emblem', '프로 클럽'],
  ['tough-futsal-team-emblem', '터프'],
  ['minimal-futsal-team-logo', '미니멀'],
  ['futsal-team-emblem-in-8-bit-pixel-art-style', '픽셀 아트'],
  ['esports-style-futsal-team-emblem', 'e스포츠']
];
const OTHER = { key: 'other', label: '기타' };

// WOODANG TT 시안(woodang-tt-<분류>--<콘셉트>-<번호>)의 콘셉트 설명
const CONCEPTS = {
  'sparkle-ball': '반짝이는 공', 'rainbow-bounce': '무지개 궤적 공', 'tang-bubble': '"TANG TANG!" 말풍선', 'winged-ball': '날개 달린 공',
  'heart-net': '하트 튀는 골망', 'crown-ball': '왕관 쓴 공', 'candy-wall': '사탕색 벽 부수기', sneakers: '별 차올리는 운동화',
  'cloud-bounce': '구름 위 공', 'pots-pans': '냄비·프라이팬 우당탕', 'toy-drum': '장난감 북', 'smiley-ball': '웃는 공',
  'cherry-balls': '체리 공', 'planet-ball': '행성 공', 'dust-roll': '먼지 날리며 구르는 공', 'jelly-splash': '젤리 풍덩',
  'ball-rocket': '공 로켓', 'heart-crest': '하트 크레스트', 'rounded-shield': '둥근 방패', 'tumbling-ball': '데굴데굴 공 캐릭터',
  'ball-mascot-kick': '공 마스코트 · 날아차기', 'ball-mascot-flex': '공 마스코트 · 근육 자랑', 'ball-mascot-wink': '공 마스코트 · 윙크',
  'cracked-shield': '금 간 방패', 'cracked-shield-v1': '금 간 방패 (초안)', 'flame-ball': '불타는 공', 'bolt-w': '번개 W', meteor: '운석 공',
  monogram: 'W·TT 모노그램', 'crown-rays': '왕관과 빛', 'winged-boots': '날개 축구화', shockwave: '충격파', hammer: '망치',
  cymbals: '심벌즈', 'bomb-ball': '폭탄 공', 'net-rip': '골망 찢기', laurel: '월계관', 'speed-swoosh': '스피드 라인',
  'hex-geometry': '육각 기하 공', 'split-ball': '쪼개진 공', 'chain-ball': '쇠사슬 공', 'ring-badge': '두꺼운 링 배지',
  'ribbon-crest': '리본 크레스트', 'hexagon-badge': '육각 배지', 'chrome-flame': '크롬 불꽃 방패', 'ink-brush': '먹 붓 원',
  minimal: '미니멀 방패', 'w-tt-monogram': 'W·TT 골대 모노그램', 'impact-round-badge-tangtang': '충격 원형 배지 (TANGTANG)',
  blokecore: '블록코어 레트로 유니폼', 'y2k-chrome': 'Y2K 크롬', 'acid-graphic': '애시드 그래픽', 'street-label': '스트릿 라벨',
  'tattoo-flash': '올드스쿨 타투', 'chenille-varsity': '셔닐 바시티 패치', 'rave-smiley': '90년대 스마일', checkerboard: '체커보드',
  'drippy-chrome': '녹아내리는 크롬', bauhaus: '바우하우스', brutalist: '브루탈리즘 타이포', 'grainy-gradient': '노이즈 그라데이션',
  'inflatable-3d': '풍선 3D 글자', 'outline-echo': '아웃라인 반복 타이포', 'retro-future': '레트로 퓨처', 'kitsch-handdrawn': '손그림 키치',
  drumsticks: '레트로 북채', varsity: '바시티 방패', 'door-crash': '문 부수는 빈티지 패치'
};

/**
 * 'black-shield-with-white-razor-' → 'Black shield with white razor…'
 * 예전 파일은 이름이 50자에서 잘려 있어서 … 를 붙이고, WOODANG TT 시안은 한국어 설명을 쓴다.
 */
function describe(prefix, rest) {
  if (prefix.startsWith('woodang-tt-')) {
    const match = /^(.*)-(\d+)$/.exec(rest);
    const concept = match ? match[1] : rest;
    return `${CONCEPTS[concept] ?? concept.replace(/-+/g, ' ')}${match ? ` ${match[2]}` : ''}`;
  }
  const copy = /\s*\((\d+)\)$/.exec(rest);
  const text = rest
    .replace(/\s*\(\d+\)$/, '')
    .replace(/-+/g, ' ')
    .trim();
  if (!text) return '';
  const sentence = text[0].toUpperCase() + text.slice(1) + '…';
  return copy ? `${sentence} (${copy[1]})` : sentence;
}

function parse(path) {
  const name = path.split('/').pop().replace(/\.\w+$/, '');
  const split = name.indexOf('--');
  const prefix = split === -1 ? name : name.slice(0, split);
  const rest = split === -1 ? '' : name.slice(split + 2);
  const style = STYLES.find(([key]) => key === prefix);
  return { name, styleKey: style ? prefix : OTHER.key, caption: describe(prefix, rest) };
}

const parsed = Object.entries(files)
  .map(([path, url]) => ({ ...parse(path), url }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

/** 스타일 묶음 — 정해 둔 순서대로, 빈 묶음은 빼고 */
export const groups = [...STYLES.map(([key, label]) => ({ key, label })), OTHER]
  .map((style) => ({ ...style, items: parsed.filter((logo) => logo.styleKey === style.key) }))
  .filter((group) => group.items.length);

// 번호는 화면 순서대로 1번부터 — "37번 좋아요" 처럼 부르기 좋게
let n = 0;
for (const group of groups) {
  for (const logo of group.items) {
    n += 1;
    logo.no = n;
    logo.styleLabel = group.label;
  }
}

export const total = n;

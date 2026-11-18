/**
 * src/logo/ 의 그림을 모두 모아 스타일별로 묶고 번호를 붙인다.
 * 그림을 넣거나 빼면 다음 빌드에 저절로 반영된다 (번호는 그때 다시 매겨진다).
 *
 * 파일 이름 앞부분(-- 앞)이 스타일이다. 예) futsal-team-emblem--black-shield-with-white-razor-.png
 */
const files = import.meta.glob('../logo/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' });

// 스타일 이름표 — 여기 없는 스타일은 '기타'로 맨 뒤에
const STYLES = [
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

/** 'black-shield-with-white-razor-' → 'Black shield with white razor…' (파일 이름이 중간에 잘려 있어서 … 를 붙인다) */
function describe(rest) {
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
  return { name, styleKey: style ? prefix : OTHER.key, caption: describe(rest) };
}

const parsed = Object.entries(files)
  .map(([path, url]) => ({ ...parse(path), url }))
  .sort((a, b) => a.name.localeCompare(b.name));

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

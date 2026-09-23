// 職人名簿（100人）。固定のシードで作るので、どのゲームでも同じ顔ぶれになる
import { CRAFT } from './constants.js';
import { seeded, rint } from './util.js';

const NAMES = ['タツ', 'ハナ', 'ゲン', 'ミヨ', 'テツ', 'サチ', 'ウメ', 'マツ', 'タケ', 'キク',
  'ヨネ', 'トメ', 'シゲ', 'ハル', 'ナツ', 'アキ', 'フユ', 'カネ', 'ツル', 'カメ',
  'イネ', 'スエ', 'ミツ', 'トク', 'ヒデ', 'マサ', 'ヨシ', 'ケン', 'ジロウ', 'サブロウ',
  'ロク', 'シチ', 'ハチ', 'クマ', 'トラ', 'タマ', 'ミネ', 'ユキ', 'ツネ', 'フク',
  'ノブ', 'カツ', 'イサオ', 'セツ', 'チヨ', 'キヨ', 'ハツ', 'モモ', 'サト', 'リン',
  'ラン', 'ギン', 'キン', 'テル', 'ミチ', 'ヤス', 'トシ', 'タカ', 'ヒロ', 'コウ',
  'ショウ', 'ダイ', 'リュウ', 'ゴロウ', 'ソウ', 'ジン', 'ブン', 'キチ', 'エイ', 'セイ',
  'レイ', 'アイ', 'メイ', 'ケイ', 'ヨウ', 'シン', 'タイ', 'カイ', 'サク', 'トモ',
  'ナオ', 'マコ', 'ミキ', 'ユリ', 'サエ', 'アヤ', 'エミ', 'カヨ', 'シズ', 'フミ',
  'マキ', 'ユウ', 'ジュン', 'ノリ', 'カズ', 'ススム', 'イチ', 'ニコ', 'ヘイ', 'ゼン'];
const FROM = ['下町育ちの', '高崎から来た', '元・駄菓子屋の', '元・看板描きの', '寡黙な', '陽気な', '江戸っ子の', '親方の甥の',
  '美大出の', '元・大工の', '早起きの', '歌好きの', '猫好きの', '祭り好きの', '几帳面な', 'おおらかな'];

// うまさ・素早さから一言を決める
function title(skill, speed) {
  if (skill >= 5 && speed >= 5) return '伝説の名人';
  if (skill >= 5) return '絵付けの名手';
  if (speed >= 5) return '町一番の早業職人';
  if (skill >= 4 && speed >= 4) return '腕利きの職人';
  if (skill >= 4) return '丁寧な職人';
  if (speed >= 4) return '手の速い職人';
  if (skill <= 1 && speed <= 1) return '駆け出しの見習い';
  if (skill <= 1) return '筆の荒い新人';
  if (speed <= 1) return 'のんびり屋の職人';
  return '堅実な職人';
}

// ★1〜5。真ん中が出やすく、両端は少ない
const STAR_W = [12, 26, 30, 22, 10];
function star(rng) {
  let x = rng() * STAR_W.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) { if (x < STAR_W[i]) return i + 1; x -= STAR_W[i]; }
  return 3;
}

// 給料：うまさと素早さが高いほど高い。個人差 ±10%（掘り出し物もいる）
export function wageOf(skill, speed, luck = 1) {
  const w = CRAFT.wage;
  return Math.round((w.base + w.perSpeed * speed + w.perSkill * skill + w.both * speed * skill) * luck / 10000) * 10000;
}

const HAIR = ['#2a1a14', '#5a3a22', '#8a8a8a', '#3a2a20', '#fff6e6', '#6b4424'];
const CLOTH = ['#2f63d6', '#f0782a', '#3aae78', '#f7b7cf', '#8a5ab8', '#d8382a', '#2a2320', '#f5c742', '#5cc4d8'];
const APRON = ['#fff6e6', '#f0782a', '#f5c742', '#d8382a', '#9cc7ef'];

function build() {
  const rng = seeded(1003);
  return NAMES.map((name, id) => {
    const skill = star(rng), speed = star(rng), luck = 0.9 + rng() * 0.2;
    const wage = wageOf(skill, speed, luck);
    return {
      id, name, skill, speed, wage,
      fee: Math.round(wage * CRAFT.feeRatio / 10000) * 10000,
      desc: `${FROM[rint(0, FROM.length - 1, rng)]}${title(skill, speed)}`,
      look: { H: HAIR[rint(0, HAIR.length - 1, rng)], A: CLOTH[rint(0, CLOTH.length - 1, rng)], P: APRON[rint(0, APRON.length - 1, rng)] },
    };
  });
}
export const ROSTER = build();

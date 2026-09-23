// ドット絵データ。1文字＝1色（パレットで対応付け）、'.' は透明
import { INK, COLORS, GRAY } from './constants.js';

export const BIG = ["....KKKKKK....","..KKBBBBBBKK..",".KBHHBBBBBBBK.",".KBWWWWWWWWBK.","KBWKKWWWWKKWBK","KBWWKWWWWKWWBK","KBWWWWKKWWWWBK","KBBWKKWWKKWBBK","KBBBWWWWWWBBBK","KBBBBGGGGBBBBK","KBBBBGDDGBBBBK",".KBBBBGGBBBBK.","..KKDDDDDDKK..","....KKKKKK...."];
export const MINI = ["..KKKK..",".KBBBBK.","KBWWWWBK","KBKWWKBK","KBBWWBBK","KBBGGBBK",".KDDDDK.","..KKKK.."];
export const PERSON = ["...KKKK...","..KHHHHK..",".KRRRRRRK.",".KHSSSSHK.",".KSKSSKSK.",".KSSSSSSK.","..KSSSSK..",".KAAAAAAK.","KAAPPPPAAK","KSAPPPPASK",".KAPPPPAK.",".KAAAAAAK.",".KAK..KAK.",".KKK..KKK."];
export const BACK = ["...KKKK...","..KHHHHK..",".KHHHHHHK.",".KHHHHHHK.",".KHHHHHHK.",".KSHHHHSK.","..KSSSSK..",".KAAAAAAK.","KAAAAAAAAK","KSAAAAAASK",".KAAAAAAK.",".KAAAAAAK.",".KPK..KPK.",".KKK..KKK."];
export const ICONS = {
  cal:["KKKKKKKKK","KRRRRRRRK","KKKKKKKKK","KWWWWWWWK","KWKWKWKWK","KWWWWWWWK","KWKWKWKWK","KWWWWWWWK","KKKKKKKKK"],
  coin:["..KKKKK..",".KYYYYYK.","KYYOOOYYK","KYYYOYYYK","KYYYOYYYK","KYYYOYYYK","KYYOOOYYK",".KYYYYYK.","..KKKKK.."],
  bag:["...KKK...","..KLLLK..","...KBK...","..KLLLK..",".KLLLLLK.","KLLLYLLLK","KLLYLYLLK","KLLLLLLLK",".KKKKKKK."],
  sack:["..K...K..","...KKK...","...KBK...","..KLLLK..",".KLLLLLK.","KLLKKKLLK","KLLLLKLLK","KLLKKKLLK",".KKKKKKK."],
  box:["KKKKKKKKK","KLLLBLLLK","KLLLBLLLK","KKKKKKKKK","KLLLLLLLK","KLLBBBLLK","KLLLLLLLK","KLLLLLLLK","KKKKKKKKK"],
  rack:["B.......B","BBBBBBBBB","B.......B","B.......B","BBBBBBBBB","B.......B","B.......B","BBBBBBBBB","B.......B"],
  gear:["...KKK...",".K.KDK.K.","..KDDDK..","KKDDKDDKK","KDDK.KDDK","KKDDKDDKK","..KDDDK..",".K.KDK.K.","...KKK..."],
  chart:[".......KK",".......KK","....KK.KK","....KK.KK",".KK.KK.KK",".KK.KK.KK",".KK.KK.KK",".KK.KK.KK","KKKKKKKKK"],
  up:[".....RRR.","......RR.",".....R.R.","....KR.KK","KK.KR..KK","KKKR...KK","KKK.KK.KK","KKK.KK.KK","KKKKKKKKK"],
  sad:["..KKKKK..",".KSSSSSK.","KSSSSSSSK","KSKSSSKSK","KSSSSSSSK","KSSKKKSSK","KSKSSSKSK",".KSSSSSK.","..KKKKK.."],
  tv:[".K.....K.","..K...K..","KKKKKKKKK","KSSSSSKOK","KSDSDSKRK","KSSSSSKOK","KSDDDSKRK","KKKKKKKKK",".K.....K."],
  brush:[".......KK","......KRK",".....KRK.","....KRK..","...KBK...","..KBK....",".KKK.....","KKK......","KK......."],
};
export const IPAL = { K: INK, R: '#e2412f', O: '#f0782a', Y: '#f5c742', W: '#fff6e6', L: '#d9a860', B: '#8a5a2b', S: '#9cc7ef', D: '#6b6358' };

export function spr(map, pal, x, y, s, g) {
  for (let j = 0; j < map.length; j++) {
    const row = map[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = pal[ch];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x + i * s, y + j * s, s, s);
    }
  }
}
export function darPal(k) {
  const c = k === 'gray' ? GRAY : COLORS[k];
  return { K: INK, B: c.b, D: c.d, H: c.h, W: '#fff6e6', G: c.g };
}
// data-spr / data-ico 属性を持つ canvas にドット絵を描く
export function paintStatic(root) {
  root.querySelectorAll('canvas[data-spr]').forEach(c => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); spr(BIG, darPal(c.dataset.spr), 0, 0, 1, g); });
  root.querySelectorAll('canvas[data-ico]').forEach(c => { const g = c.getContext('2d'); g.clearRect(0, 0, 9, 9); spr(ICONS[c.dataset.ico], IPAL, 0, 0, 1, g); });
}

// ドット絵データ。1文字＝1色（パレットで対応付け）、'.' は透明
// ほとんどの絵は画像素材（src/art/）。ここには素材のないアイコン（投資の上矢印・売り逃しの顔）だけ残す
import { INK } from './constants.js';

export const ICONS = {
  up:[".....RRR.","......RR.",".....R.R.","....KR.KK","KK.KR..KK","KKKR...KK","KKK.KK.KK","KKK.KK.KK","KKKKKKKKK"],
  sad:["..KKKKK..",".KSSSSSK.","KSSSSSSSK","KSKSSSKSK","KSSSSSSSK","KSSKKKSSK","KSKSSSKSK",".KSSSSSK.","..KKKKK.."],
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

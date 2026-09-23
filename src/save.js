import { SAVE_KEY } from './constants.js';

// 形式は S をそのまま JSON 化したもの。構造を変えるときはキーを更新するか変換処理を追加すること
export function save(S) { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境では無視 */ } }
export function load() { try { const v = localStorage.getItem(SAVE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

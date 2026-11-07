#!/bin/sh
# いまの作業中の中身（コミットしていない変更も含む）を Vercel の pop-daruma にプレビューとして出す。
# 本番（main → deploy.yml）とは別の URL。ランキングにはつながない（試しに遊んだスコアが本番のランキングに混ざらないように）。
# プレビューの URL は Vercel にログインしている人だけが開ける。使い方: npm run preview（vercel CLI にログインしておく）
set -e
cd "$(dirname "$0")/.."
export VERCEL_ORG_ID=team_Yo8Yn7C7ZJsJqJk1L2YvSb8a VERCEL_PROJECT_ID=prj_lACUQCscYIzqMyhK9FWaKu9Qojk3 # Vercel の pop-daruma
OUT=.debug/vercel
rm -rf "$OUT" && mkdir -p "$OUT"
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vite build --outDir "$OUT" --emptyOutDir --logLevel warn
npx --yes vercel@latest deploy "$OUT" --yes

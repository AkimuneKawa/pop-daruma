-- ポップだるま堂 繁盛記：ランキング用のテーブル
-- Supabase のダッシュボード → SQL Editor にこのファイルの中身を貼り付けて Run する（1回だけでよい）

create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 12),
  score       bigint      not null check (score between 0 and 10000000000),       -- 3年後の総資産（円）
  best_year   bigint      not null check (best_year between 0 and 10000000000),   -- いちばん良かった年の年商（円）
  revenue     bigint      not null check (revenue between 0 and 30000000000),     -- 3年間の売上（円）
  title       text        not null check (title in ('見習い', '一人前', '名工', 'だるま大名')),
  version     text        not null check (char_length(version) <= 20),           -- ゲームのバランスの版（版ごとに順位を分ける）
  created_at  timestamptz not null default now()
);

create index if not exists scores_score_idx on public.scores (version, score desc);
create index if not exists scores_best_year_idx on public.scores (version, best_year desc);

-- 誰でも読めて、登録だけできる（書き換え・削除はできない）
alter table public.scores enable row level security;

drop policy if exists "scores are readable by everyone" on public.scores;
create policy "scores are readable by everyone" on public.scores
  for select to anon, authenticated using (true);

drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score" on public.scores
  for insert to anon, authenticated with check (true);

-- 追加要件A: NG曜日(0=日〜6=土)
-- Supabase の SQL Editor で実行してください。
alter table events add column if not exists ng_weekdays int[];

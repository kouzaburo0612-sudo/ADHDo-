-- メモ機能: 幹事が書き、回答ページで参加者に表示される
-- Supabase の SQL Editor で実行してください。
alter table events add column if not exists memo text;

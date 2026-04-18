-- SEN-222: rebuild age/tenure tables with year-by-year rows matching legacy
-- Views/PopulationAnalysis/AverageAgeTenure.cshtml and AverageAgeTenureBalance.cshtml
-- shapes. Previous schema had service-year buckets which is a different view
-- and doesn't include legacy's per-year progression + % change columns.

DROP TABLE IF EXISTS public.average_age_tenure_active CASCADE;
DROP TABLE IF EXISTS public.average_age_tenure_terminated CASCADE;

-- Active: one row per projection year + summary row
CREATE TABLE public.average_age_tenure_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  average_age NUMERIC NOT NULL DEFAULT 0,
  average_tenure NUMERIC NOT NULL DEFAULT 0,
  covered_compensation NUMERIC NOT NULL DEFAULT 0,
  compensation_pct_change NUMERIC NOT NULL DEFAULT 0,
  average_vested_balance NUMERIC NOT NULL DEFAULT 0,
  balance_pct_change NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_age_tenure_active_user_year ON public.average_age_tenure_active(user_id, year);
ALTER TABLE public.average_age_tenure_active ENABLE ROW LEVEL SECURITY;

CREATE POLICY age_tenure_active_select_own ON public.average_age_tenure_active
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY age_tenure_active_insert_own ON public.average_age_tenure_active
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY age_tenure_active_update_own ON public.average_age_tenure_active
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY age_tenure_active_delete_own ON public.average_age_tenure_active
  FOR DELETE USING (auth.uid() = user_id);

-- Terminated: one row per projection year with top-10/bottom-10/all splits
CREATE TABLE public.average_age_tenure_terminated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  avg_age_top_10pct NUMERIC NOT NULL DEFAULT 0,
  avg_balance_top_10pct NUMERIC NOT NULL DEFAULT 0,
  avg_age_bottom_10pct NUMERIC NOT NULL DEFAULT 0,
  avg_balance_bottom_10pct NUMERIC NOT NULL DEFAULT 0,
  avg_age_terminated NUMERIC NOT NULL DEFAULT 0,
  avg_tenure_terminated NUMERIC NOT NULL DEFAULT 0,
  avg_balance_terminated NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_age_tenure_terminated_user_year ON public.average_age_tenure_terminated(user_id, year);
ALTER TABLE public.average_age_tenure_terminated ENABLE ROW LEVEL SECURITY;

CREATE POLICY age_tenure_terminated_select_own ON public.average_age_tenure_terminated
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY age_tenure_terminated_insert_own ON public.average_age_tenure_terminated
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY age_tenure_terminated_update_own ON public.average_age_tenure_terminated
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY age_tenure_terminated_delete_own ON public.average_age_tenure_terminated
  FOR DELETE USING (auth.uid() = user_id);

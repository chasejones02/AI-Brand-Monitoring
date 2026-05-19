-- P6.1: switch position_score to numeric so the smooth log-decay curve
-- can store decimal values (e.g. pos 2 = 3.15, pos 3 = 2.50).
-- Existing integer values cast losslessly to numeric.

alter table public.scan_results
  alter column position_score type numeric(5, 2) using position_score::numeric(5, 2);

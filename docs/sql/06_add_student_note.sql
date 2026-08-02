-- ===========================================================================
-- 擴充球員資料表：解除同名限制，並新增備註欄位
-- ===========================================================================

-- 1. 移除原本的「同一球隊內不允許同名」限制
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_team_id_name_key;

-- 2. 新增「備註 (note)」欄位
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS note TEXT;

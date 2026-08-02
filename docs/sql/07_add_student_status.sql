-- ===========================================================================
-- 擴充球員資料表：新增「是否在隊 (is_active)」欄位
-- ===========================================================================

-- 新增 is_active 欄位，預設為 true (在隊)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ===========================================================================
-- 第四階段：帳務系統安全規則 (RLS)
-- ===========================================================================

ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1. billing_cycles 的權限設定
-- ---------------------------------------------------------------------------
-- 允許所屬球隊的管理員 (admin/superadmin) 讀取
DROP POLICY IF EXISTS "Admins can view their team billing cycles" ON public.billing_cycles;
CREATE POLICY "Admins can view their team billing cycles" ON public.billing_cycles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = billing_cycles.team_id AND role IN ('admin', 'superadmin'))
);

-- 允許所屬球隊的管理員新增帳單週期
DROP POLICY IF EXISTS "Admins can insert billing cycles" ON public.billing_cycles;
CREATE POLICY "Admins can insert billing cycles" ON public.billing_cycles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = billing_cycles.team_id AND role IN ('admin', 'superadmin'))
);

-- 允許所屬球隊的管理員修改帳單週期
DROP POLICY IF EXISTS "Admins can update billing cycles" ON public.billing_cycles;
CREATE POLICY "Admins can update billing cycles" ON public.billing_cycles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND team_id = billing_cycles.team_id AND role IN ('admin', 'superadmin'))
);

-- ---------------------------------------------------------------------------
-- 2. billing_records 的權限設定
-- 因為 records 沒有直接存 team_id，所以要透過 JOIN cycle 判斷
-- ---------------------------------------------------------------------------
-- 允許所屬球隊的管理員讀取帳款明細
DROP POLICY IF EXISTS "Admins can view their team billing records" ON public.billing_records;
CREATE POLICY "Admins can view their team billing records" ON public.billing_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.billing_cycles c 
    JOIN public.user_roles u ON c.team_id = u.team_id 
    WHERE c.id = billing_records.cycle_id AND u.user_id = auth.uid() AND u.role IN ('admin', 'superadmin')
  )
);

-- 允許所屬球隊的管理員新增帳款明細
DROP POLICY IF EXISTS "Admins can insert billing records" ON public.billing_records;
CREATE POLICY "Admins can insert billing records" ON public.billing_records FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.billing_cycles c 
    JOIN public.user_roles u ON c.team_id = u.team_id 
    WHERE c.id = cycle_id AND u.user_id = auth.uid() AND u.role IN ('admin', 'superadmin')
  )
);

-- 允許所屬球隊的管理員更新帳款明細
DROP POLICY IF EXISTS "Admins can update billing records" ON public.billing_records;
CREATE POLICY "Admins can update billing records" ON public.billing_records FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.billing_cycles c 
    JOIN public.user_roles u ON c.team_id = u.team_id 
    WHERE c.id = cycle_id AND u.user_id = auth.uid() AND u.role IN ('admin', 'superadmin')
  )
);

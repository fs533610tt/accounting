-- ===========================================================================
-- 階段三：資料表 RLS 安全策略 (在 03_phase3_schema.sql 之後執行)
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. students (學生名冊) 的 RLS 權限
-- ---------------------------------------------------------------------------
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 允許所有人(或登入者)讀取學生名單
CREATE POLICY "Enable read access for all users" ON public.students FOR SELECT USING (true);

-- 只有該球隊的管理員 (admin) 或是最高管理員 (superadmin) 可以新增/修改/刪除學生
CREATE POLICY "Admins can manage students" ON public.students 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'superadmin' OR (role = 'admin' AND team_id = public.students.team_id))
  )
);

-- ---------------------------------------------------------------------------
-- 2. billing_cycles (帳單週期表) 的 RLS 權限
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.billing_cycles FOR SELECT USING (true);

CREATE POLICY "Admins can manage billing_cycles" ON public.billing_cycles 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND (role = 'superadmin' OR (role = 'admin' AND team_id = public.billing_cycles.team_id))
  )
);

-- ---------------------------------------------------------------------------
-- 3. billing_records (個人帳單明細表) 的 RLS 權限
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.billing_records FOR SELECT USING (true);

CREATE POLICY "Admins can manage billing_records" ON public.billing_records 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.billing_cycles bc
    JOIN public.user_roles ur ON ur.team_id = bc.team_id
    WHERE bc.id = public.billing_records.cycle_id
    AND ur.user_id = auth.uid() 
    AND (ur.role = 'superadmin' OR ur.role = 'admin')
  )
);

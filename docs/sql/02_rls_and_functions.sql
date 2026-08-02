-- ===========================================================================
-- 福山國小桌球隊作帳系統 - RLS 安全策略與後端函數
-- 建議執行順序：在 01_schema.sql 之後執行此檔案
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. teams 資料表的 RLS 權限設定
-- ---------------------------------------------------------------------------
-- 確保 teams 資料表開啟 RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 允許所有人都能「讀取」球隊列表 (才能顯示在畫面上)
CREATE POLICY "Enable read access for all users" ON public.teams FOR SELECT USING (true);

-- 允許 Super Admin 可以「新增」球隊
CREATE POLICY "SuperAdmins can insert teams" ON public.teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);

-- 允許 Super Admin 可以「修改」球隊 (未來需要)
CREATE POLICY "SuperAdmins can update teams" ON public.teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
);

-- ---------------------------------------------------------------------------
-- 2. user_roles 資料表的 RLS 權限設定
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 新增規則：允許使用者讀取屬於自己的權限資料
CREATE POLICY "Allow users to read their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. 安全函數 (Security Definer Functions)
-- ---------------------------------------------------------------------------

-- 取得所有使用者的信箱清單 (專供 Super Admin 查詢下拉選單)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER -- 允許此函數突破 RLS 去讀取 auth.users
AS $$
BEGIN
  -- 安全檢查：只有 superadmin 可以取得所有信箱
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION '權限不足！只有最高管理員可以查看使用者名單。';
  END IF;
  
  RETURN QUERY SELECT au.id, au.email::TEXT FROM auth.users au;
END;
$$;


-- 透過 Email 指派球隊管理員 (供 Super Admin 設定管理員用)
CREATE OR REPLACE FUNCTION assign_team_admin(target_email TEXT, target_team_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  -- 1. 安全檢查：確認呼叫此函數的人真的是 superadmin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION '權限不足！只有最高管理員可以指派。';
  END IF;

  -- 2. 透過 Email 尋找使用者的 ID
  SELECT au.id INTO found_user_id FROM auth.users au WHERE au.email = target_email;
  
  IF found_user_id IS NULL THEN
    RAISE EXCEPTION '找不到該信箱！該使用者必須至少使用 Google 登入過本系統一次。';
  END IF;

  -- 3. 賦予 admin 權限
  INSERT INTO public.user_roles (user_id, team_id, role)
  VALUES (found_user_id, target_team_id, 'admin')
  ON CONFLICT (user_id, team_id) 
  DO UPDATE SET role = 'admin';

  RETURN true;
END;
$$;

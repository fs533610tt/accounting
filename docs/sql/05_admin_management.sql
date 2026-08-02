-- ===========================================================================
-- 附加功能：查詢與移除球隊管理員
-- ===========================================================================

-- 查詢特定球隊目前的管理員名單
CREATE OR REPLACE FUNCTION get_team_admins(target_team_id UUID)
RETURNS TABLE (email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 安全檢查：只有 superadmin 可以查詢
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION '權限不足！只有最高管理員可以查看管理員名單。';
  END IF;

  RETURN QUERY 
  SELECT au.email::TEXT 
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.team_id = target_team_id AND ur.role = 'admin';
END;
$$;


-- 移除特定球隊的管理員
CREATE OR REPLACE FUNCTION remove_team_admin(target_email TEXT, target_team_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  -- 1. 安全檢查：確認呼叫此函數的人真的是 superadmin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin') THEN
    RAISE EXCEPTION '權限不足！只有最高管理員可以移除管理員。';
  END IF;

  -- 2. 透過 Email 尋找使用者的 ID
  SELECT au.id INTO found_user_id FROM auth.users au WHERE au.email = target_email;
  
  IF found_user_id IS NULL THEN
    RAISE EXCEPTION '找不到該信箱！';
  END IF;

  -- 3. 移除權限
  DELETE FROM public.user_roles 
  WHERE user_id = found_user_id AND team_id = target_team_id AND role = 'admin';

  RETURN true;
END;
$$;

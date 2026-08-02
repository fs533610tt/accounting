-- ===========================================================================
-- 資料庫健康檢查 (Health Check)
-- 功能：列出所有核心資料表的欄位結構，方便管理員隨時核對與除錯。
-- 執行方式：將此段代碼貼至 Supabase SQL Editor 執行即可。
-- ===========================================================================

SELECT 
    table_name AS "資料表名稱", 
    column_name AS "欄位名稱", 
    data_type AS "資料型態", 
    column_default AS "預設值",
    is_nullable AS "允許為空"
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('teams', 'user_roles', 'students', 'billing_cycles', 'billing_records')
ORDER BY table_name, ordinal_position;

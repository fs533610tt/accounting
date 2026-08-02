-- ===========================================================================
-- 第四階段：重新建置帳務系統資料表結構
-- (由於之前有舊版結構殘留，我們先刪除舊版，再建立全新版)
-- ===========================================================================

-- 先刪除舊的資料表 (注意順序：先刪 records 再刪 cycles 因為有外鍵關聯)
DROP TABLE IF EXISTS public.billing_records CASCADE;
DROP TABLE IF EXISTS public.billing_cycles CASCADE;

-- 1. 建立帳單週期表 (billing_cycles)
CREATE TABLE public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 例如："2026年8月月費"
    default_amount DECIMAL NOT NULL DEFAULT 1000, -- 預設每人的公定價
    status TEXT NOT NULL DEFAULT 'active', -- 'active' (收費中), 'closed' (已結算)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 建立個人繳款明細表 (billing_records)
CREATE TABLE public.billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount_due DECIMAL NOT NULL, -- 應繳金額 (可個別手動修改)
    amount_paid DECIMAL NOT NULL DEFAULT 0, -- 已繳金額
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' (未繳), 'paid' (已繳清), 'partially_paid' (部分繳納)
    note TEXT, -- 對帳備註
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cycle_id, student_id) -- 確保同一個週期內，每個學生只會有一筆明細
);

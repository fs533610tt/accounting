-- ===========================================================================
-- 階段三：帳務系統資料表擴充 (在 01_schema.sql 之後執行)
-- ===========================================================================

-- 4. 建立帳單週期表 (billing_cycles)
CREATE TABLE public.billing_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    month VARCHAR(20) NOT NULL, -- 例如 '2026-08'
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(team_id, month)
);

-- 5. 建立個人帳單明細表 (billing_records)
CREATE TABLE public.billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID NOT NULL REFERENCES public.billing_cycles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount DECIMAL NOT NULL DEFAULT 0,
    details JSONB DEFAULT '[]'::jsonb, -- 收費明細 [{item: '月費', price: 1000}]
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cycle_id, student_id)
);

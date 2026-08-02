-- ===========================================================================
-- 福山國小桌球隊作帳系統 (Multi-tenant) - Supabase Database Schema
-- ===========================================================================

-- 1. 建立球隊表 (teams)
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'suspended'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 建立使用者角色權限表 (user_roles)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'accountant', 'coach')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, team_id)
);

-- 3. 建立隊員/小朋友名冊 (students)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade TEXT,
    class_name TEXT,
    is_officer BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 初始最高權限管理者 (Super Admin) 設定腳本
-- 請將以下信箱替換為您的主帳號信箱，這樣當您登入時就會擁有最高權限
-- ==========================================
-- (注意：必須等您在前端實際用 Google 登入過一次，auth.users 才會產生紀錄，才能執行這段 INSERT)

/*
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'superadmin'
FROM auth.users
WHERE email = 'fs533610tt@gmail.com';
*/

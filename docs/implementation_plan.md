# 桌球隊作帳系統 - 開發實作計畫

本計畫旨在建立一個獨立的球隊作帳系統，前端採用 React 並部署至 GitHub Pages，後端採用 Supabase 免費方案（包含身份驗證與 PostgreSQL 資料庫）。

> [!NOTE]
> 考量到此系統「可能會有多人使用」，我們在資料庫設計上會導入「多租戶 (Multi-tenant)」或「角色權限 (RBAC)」的概念，讓不同球隊或不同管理者可以各自登入，且資料互不干擾。

## User Review Required

> [!IMPORTANT]
> - **最高權限管理者 (Super Admin)**：根據您的要求，系統將強制綁定 `fs533610tt@gmail.com` 為系統的唯一最高權限管理者。所有其他球隊的建立與啟用，皆須經過此帳號的同意與開通，一般使用者無法隨意自行註冊並建立球隊使用本系統。
> - **專案目錄架構升級**：我們將導入您提供的 `loveteaClient` 專案成熟架構（包含 `components`, `pages`, `layouts`, `contexts`, `routes.jsx` 等），這會讓未來的維護與擴充更加專業且容易。

## Open Questions

> [!WARNING]
> **最高管理員審核流程**：當其他球隊想要使用這套系統時，您希望採用哪種流程？
> 1. 由他們自行用 Google 登入後「申請建立球隊」，然後狀態為「待審核」，等您登入 `fs533610tt@gmail.com` 核准後才能使用？
> 2. 完全不開放申請，只能由您（最高管理員）親自在後台手動幫他們建立好球隊與初始管理員帳號？

---

## Proposed Changes

### 1. 系統架構與業務流程更新

- **前端框架**：Vite + React (JavaScript/JSX)
- **部署環境**：GitHub Pages
- **後端與資料庫**：Supabase
- **登入機制**：整合 **Google 登入 (Google OAuth)**。

#### A. 專案結構重構 (參照 loveteaClient)
將 `src` 目錄重新規劃如下，以利大型專案維護：
- `assets/`：靜態資源 (圖片、SVG)
- `components/`：共用的 UI 元件
- `config/`：設定檔 (如 Supabase 初始化)
- `contexts/`：全域狀態管理 (如 AuthContext)
- `hooks/`：自訂 React Hooks
- `layouts/`：版面配置 (如登入版面、後台版面)
- `pages/`：各個頁面視圖
- `routes.jsx`：集中管理前端路由
- `services/`：Supabase 資料庫操作邏輯
- `style/`：樣式表與 CSS
- `utils/`：工具函式

#### B. 角色與權限分配 (RBAC) 升級
會登入系統的使用者分為以下四種角色：
0. **最高管理員 (Super Admin)**：限定為 `fs533610tt@gmail.com`。可管理所有球隊的開通狀態，只有經過 Super Admin 授權的球隊才能使用系統。
1. **球隊管理員 (Team Admin)**：單一球隊的最高權限，可管理該球隊的教練、會計與時薪設定。
2. **會計人員 (Accountant)**：負責確認學生繳費、結算並發放教練薪水、產生財務報表。
3. **教練 (Coach)**：只能登入填寫自己的上課時數，上傳存摺，以及查看自己的薪資單。

### 2. 資料庫結構 (Supabase Database Schema) 更新

為支援 Super Admin 審核機制，更新部分結構：

1. **`teams` (球隊表)**
   - `id`, `name`
   - `status` (狀態：pending, active, suspended) -> 只有 `fs533610tt@gmail.com` 可以修改此欄位。
2. **`user_roles` (管理者權限表)**
   - `role` (角色：superadmin, admin, accountant, coach)

*(其餘 `students`, `billing_records`, `coach_timesheets` 等資料表維持與原計畫相同。)*

### 3. 開發階段規劃

- **第一階段：專案重構與 Google 登入**
  - 依照 `loveteaClient` 架構重組資料夾 (`pages`, `routes.jsx`, `contexts` 等)。
  - 實作「Google 登入」機制與 `AuthContext` 狀態管理。
- **第二階段：Super Admin 審核與權限核心**
  - 實作 RBAC 核心，強制攔截 `fs533610tt@gmail.com` 賦予 `superadmin` 權限。
  - 實作「申請球隊/審核球隊」流程介面。
- **第三階段：小朋友名冊與帳務管理**
  - 實作球隊內部的名冊與自動產生帳單、學費袋套印功能。
- **第四階段：教練薪資與報表系統**
  - 實作教練專屬打卡介面、銀行帳號上傳。
  - 實作會計核算與收支月報表匯出功能。

---

## Verification Plan

### 自動化/手動驗證
- **Super Admin 驗證**：確保非 `fs533610tt@gmail.com` 的帳號登入後，無法看到「球隊審核/系統管理」的畫面。
- **未授權阻擋驗證**：剛註冊或所屬球隊尚未被核准的帳號，登入後只能看到「等待管理員審核中」的畫面，無法操作任何帳務。

# 🏓 桌球隊專屬管理與帳務系統 (Table Tennis Team Management SaaS)

這是一個專為「桌球隊」量身打造的**多租戶 (Multi-Tenant)** 雲端管理系統。
從球員名冊管理、升降級、到每個月最繁瑣的「收費、對帳、列印學費袋」，都能在這個系統中一站式自動化完成！

## ✨ 核心特色功能 (Key Features)

- 🏢 **多租戶架構 (Multi-Tenant SaaS)**
  - 支援無數個不同的國小桌球隊使用同一套系統。
  - 透過嚴格的資料庫列級安全策略 (RLS)，確保 A 球隊絕對看不到 B 球隊的帳本與個資。
  - 具備「超級管理員 (Super Admin)」與「球隊管理員 (Team Admin)」的權限分級。

- 📝 **智慧球員名冊 (Roster Management)**
  - 管理在隊與畢業球員（支援標記「幹部」與「停訓/畢業」狀態，保留歷史紀錄）。
  - **一鍵升年級與畢業**：每年暑假只要按一個按鈕，全隊自動升級，六年級自動轉為畢業狀態！

- 💰 **自動化帳務收費 (Billing & Accounting)**
  - **一鍵產生月費**：輸入公定價，系統自動抓取所有「在隊」球員，瞬間生成全隊帳單。
  - **個別微調與對帳**：支援幹部折扣、請假退費的金額修改，並具備「一鍵繳清」功能，對帳清楚明瞭。

- 🖨️ **學費袋精準套印 (Print Envelopes)**
  - 結合 CSS `@media print` 技術，直接將網頁上的帳單明細，精準套印到實體的「西式黃色信封袋」上。
  - 自動隱藏無關的網頁元素，並強制每印完一人自動換頁。

## 🛠️ 技術堆疊 (Tech Stack)

- **前端框架**：React + Vite (採用純粹、現代化的玻璃透視 Glassmorphism UI)
- **後端與資料庫**：Supabase (PostgreSQL)
- **身分驗證**：Supabase Auth (支援 Email 登入)
- **部署平台**：GitHub Pages (`gh-pages` 分支)

---

## 🚀 快速開始 (Getting Started)

### 1. 安裝環境
請確保您的電腦已安裝 [Node.js](https://nodejs.org/)。
```bash
# 複製專案
git clone https://github.com/fs533610tt/accounting.git

# 進入專案目錄
cd accounting

# 安裝依賴套件
npm install
```

### 2. 環境變數設定
複製專案中的環境變數範例檔：
```bash
cp .env.example .env
```
打開 `.env` 檔案，填入您專屬的 Supabase 網址與匿名金鑰 (Anon Key)。

### 3. 資料庫建置 (Supabase)
請進入 Supabase 的 **SQL Editor**，並「**依序**」執行本專案 `docs/sql/` 目錄下的所有 SQL 腳本：
- `01_schema.sql`：核心資料表結構
- `02_rls_and_functions.sql`：安全權限與觸發器
- `03_phase3_schema.sql`：多租戶架構
- `04_phase3_rls.sql`：多租戶權限
- `05_admin_management.sql`：管理員面板
- `06_add_student_note.sql` & `07_add_student_status.sql`：球員備註與狀態
- `08_billing_schema.sql`：帳務系統結構
- `09_billing_rls.sql`：帳務系統權限

> **💡 開發提示**：如果您想檢查資料庫結構是否正確建立，可以執行 `99_health_check.sql`。

### 4. 本地端開發測試
```bash
npm run dev
```
啟動後，打開瀏覽器造訪 `http://localhost:5173` 即可看到開發中的畫面。

### 5. 發布至線上 (Deploy to GitHub Pages)
我們使用了 `gh-pages` 套件，只要下達以下指令，系統就會自動編譯並推送到線上！
```bash
npm run deploy
```

---

## 📚 進階文件與未來擴充

如果您是未來的接手開發者，或是想將這套系統獨立部署給其他國小使用，請務必閱讀本專案內建的指南：
- [未來擴充與部署指南 (Expansion Guide)](./docs/expansion_guide.md)
- [開發鐵律與風格設定 (AI Agents Rules)](./.agents/AGENTS.md)
- [🔐 Google OAuth 與 Supabase 登入設定教學](./docs/google_oauth_setup.md)

---
*Developed with passion for Table Tennis Teams.* 🏓

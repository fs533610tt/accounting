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

- 📒 **球隊公積金記帳本 (Team Ledger)**
  - **收支明細管理**：紀錄球隊的各項支出與收入，並能透過「月份篩選器」快速查閱歷史帳目。
  - **收據圖片上傳**：結合 Supabase Storage 私有儲存桶，安全地保存實體收據照片，防外流且僅限管理員存取。
  - **代墊款核銷**：清楚標示並追蹤教練或家長的「待核銷代墊款」。

- 🖨️ **學費袋精準套印 (Print Envelopes)**
  - 結合 CSS `@media print` 技術，直接將網頁上的帳單明細，精準套印到實體的「西式黃色信封袋」上。
  - 自動隱藏無關的網頁元素，並強制每印完一人自動換頁。

- 📱 **完美的手機版體驗 (Mobile-First UX)**
  - 響應式卡片設計 (Card View) 取代傳統表格，並提供流暢的 SweetAlert2 彈跳視窗與滿版按鈕，讓教練在球場上用手機也能輕鬆操作。

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

### 3. 資料庫與儲存空間建置 (Supabase)
請進入 Supabase 的 **SQL Editor**，執行本專案 `docs/sql/` 目錄下的整合腳本：
- `00_master_init.sql`：這是一份已經打包好的完整腳本，包含了核心資料表、多租戶架構、安全性政策 (RLS)、帳務系統與記帳本功能。直接全部複製貼上並執行即可！

> **💡 建立私有儲存桶 (Storage)**：
> 執行完 SQL 後，請到 Supabase 後台的 **Storage** 頁面，點擊 **New Bucket**，建立一個名為 `receipts` 的儲存桶，並且 **絕對不要勾選 Public bucket**，以保護收據隱私。

### 4. 本地端開發測試
```bash
npm run dev
```
啟動後，打開瀏覽器造訪 `http://localhost:5173` 即可看到開發中的畫面。

### 5. 發布至線上 (Deployment)
我們已經設定好多重發布環境：

**發布到 GitHub Pages:**
使用 `gh-pages` 套件，只要下達以下指令，系統會自動使用 `/accounting/` 基礎路徑編譯並推送到線上！
```bash
npm run deploy
```

**發布到私人主機:**
如果您要放在自己的主機網域 (例如 `https://www.my-team.com`)，請直接打包：
```bash
npm run build
```
然後將產生的 `dist` 資料夾內容放到主機的網頁目錄下即可。
*(請記得前往 Supabase 後台更新 Authentication -> URL Configuration 的 Site URL 與 Redirect URLs)*

---

## 📚 進階文件與未來擴充

如果您是未來的接手開發者，或是想將這套系統獨立部署給其他國小使用，請務必閱讀本專案內建的指南：
- [未來擴充與部署指南 (Expansion Guide)](./docs/expansion_guide.md)
- [開發鐵律與風格設定 (AI Agents Rules)](./.agents/AGENTS.md)
- [🔐 Google OAuth 與 Supabase 登入設定教學](./docs/google_oauth_setup.md)

---
*Developed with passion for Table Tennis Teams.* 🏓

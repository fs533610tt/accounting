# 🔐 Google OAuth 與 Supabase 登入設定教學

本專案使用 **Google 帳號登入 (OAuth)** 作為唯一的身分驗證方式。
如果您是未來的接手開發者，或是需要將本系統部署到全新的 Supabase 專案中，請嚴格按照以下步驟進行設定，否則使用者將無法登入系統。

---

## 第一階段：設定 Google Cloud Console (取得金鑰)

1. **前往 Google Cloud Console**
   - 網址：[https://console.cloud.google.com/](https://console.cloud.google.com/)
   - 登入您的 Google 帳號，並在左上角點擊「選擇專案」>「新增專案 (New Project)」。
   - 專案名稱可以取為 `TableTennisAccounting`，點擊建立。

2. **設定 OAuth 同意畫面 (OAuth Consent Screen)**
   - 在左側選單找到 **「API 和服務」 > 「OAuth 同意畫面」**。
   - User Type 選擇 **「外部 (External)」**，點擊建立。
   - 填寫必填欄位：
     - 應用程式名稱：例如 `福山桌球隊作帳系統`
     - 使用者支援電子郵件：填寫您的 Email
     - 開發人員聯絡資訊：填寫您的 Email
   - 其餘欄位可先留空，一路點擊「儲存並繼續」到底。
   - **非常重要**：回到同意畫面首頁，點擊 **「發布應用程式 (Publish App)」**，這樣其他教練才能用他們的 Google 帳號登入！

3. **建立憑證 (Credentials)**
   - 在左側選單點擊 **「憑證 (Credentials)」**。
   - 點擊上方的 **「+ 建立憑證」 > 「OAuth 用戶端 ID」**。
   - 應用程式類型選擇 **「網頁應用程式 (Web Application)」**。
   - 名稱可以寫 `Web Client`。
   - **已授權的 JavaScript 來源 (Authorized JavaScript origins)**：
     - 填入您的網站網址（例如：`https://fs533610tt.github.io`）
     - 如果要在自己電腦開發，需加入 `http://localhost:5173`
   - **已授權的重新導向 URI (Authorized redirect URIs)**：
     - 這裡必須填入 Supabase 提供的專屬 Callback 網址。格式為：
       `https://<您的 Supabase 專案代碼>.supabase.co/auth/v1/callback`
       *(這個網址可以在第二階段的 Supabase 後台找到)*
   - 點擊建立後，您會得到一組 **用戶端編號 (Client ID)** 與 **用戶端密碼 (Client Secret)**。請先複製記下來！

---

## 第二階段：設定 Supabase 後台

1. **前往 Supabase Authentication 設定**
   - 進入您的 Supabase 專案後台。
   - 左側選單點擊 **Authentication (齒輪圖示旁邊的人像)** > **Providers**。

2. **啟用 Google 登入**
   - 找到 **Google**，點擊展開並開啟 Enable 開關。
   - 將剛剛在 Google Cloud Console 拿到的 **Client ID** 貼到 `Client ID` 欄位。
   - 將剛剛拿到的 **Client Secret** 貼到 `Client Secret` 欄位。
   - 點擊 Save 儲存。
   - *(注意：在這個畫面，您會看到一個 `Callback URL (for OAuth)`，這就是要在 Google Console 填入的重新導向 URI！)*

3. **設定允許的跳轉網址 (URL Configuration)**
   - 依然在 Supabase Authentication，左側點擊 **URL Configuration**。
   - **Site URL**：填入您的主要網站網址 (例如：`https://fs533610tt.github.io/accounting/`)。
   - **Redirect URLs**：請點擊 Add URL，加入所有可能跳轉的網址：
     - `https://fs533610tt.github.io/accounting/*`
     - `http://localhost:5173/*` (給本地開發用)

---

## 第三階段：檢查程式碼中的設定

請確認 `src/pages/Login.jsx` 中的 `redirectTo` 設定有與您的 GitHub Pages 網址相符：

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    // 這裡必須跟您的 GitHub Pages 儲存庫名稱一致
    redirectTo: `${window.location.origin}/accounting/`, 
  },
});
```

完成以上所有設定後，您的系統就擁有與 Google 相同等級的安全登入機制了！🎉

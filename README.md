# 全方位整合帳務與跨幣別資產管理系統 (MyMoney)

本專案已全面由原先單體 `index.html` (4,268 行) 重構為 **Laravel 11 + Vue 3 (Pinia MVVM) 現代化架構**，並完整支援 **Google Cloud Run (GCP) 容器化零成本自動縮容部署 (方案 A)**。

原先的 `index.html` 與 `Code.gs` 已完整保留作為業務邏輯參考與歷史備份。

---

## 🌟 MVVM 架構設計

```
[ View: Vue 3 SFC 元件 ]
  ├── HeaderNav.vue (頂部導航、隱藏金額切換、寬限期壓力測試、Google 登入)
  ├── OverviewCards.vue (總淨資產、每月淨現金流、四大資產配置條圖、水位安全警戒)
  ├── BankAssetsSection.vue (銀行現金存款、多幣別匯率換算、利息試算)
  ├── StockAssetsSection.vue (台股/美股持倉、現價市值、未實現損益)
  ├── CryptoAssetsSection.vue (加密貨幣持倉、即時 USDT 報價與 TWD 換算)
  ├── InsuranceSection.vue (儲蓄險保單資產、現金價值、年回饋金)
  ├── LoansSection.vue (貸款本金、寬限期內 vs 寬限期後攤還試算)
  └── CashflowSection.vue (每月固定薪資收支與生活費用)
          ↕ 雙向資料綁定 (v-model) 與事件觸發
[ ViewModel: Pinia 狀態管理 ]
  ├── stores/useFinancialStore.js (全響應式計算屬性 Computed、匯率換算、1.5秒防抖自動存檔)
  └── stores/useAuthStore.js (Google 帳號資訊、Session Key 工作階段)
          ↕ RESTful API (Axios /api/v1/...)
[ Model: Laravel 11 + Database ]
  ├── app/Models/FinancialState.php (帳務狀態 Eloquent 模型)
  ├── app/Models/User.php (使用者模型)
  ├── app/Http/Controllers/Api/FinancialDataController.php (資料讀取與防抖儲存)
  └── Database (預設 SQLite / 支援 Supabase 免費版 PostgreSQL)
```

---

## 🚀 本地開發與啟動方式 (二選一)

### 方式一：使用 Docker (推薦，無需安裝 PHP / Node)

若您本機已安裝 Docker Desktop，只需一行指令即可建置並啟動前後端：

```bash
docker compose up --build
```
啟動後打開瀏覽器訪問：`http://localhost:8080`

### 方式二：本機直接執行

若本機有 PHP 8.2+ 與 Node.js 18+：

```bash
# 1. 安裝後端相依
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate

# 2. 安裝前端相依與啟動編譯
npm install
npm run dev

# 3. 啟動 Laravel 開發伺服器 (另開終端機)
php artisan serve
```

---

## ☁️ Google Cloud Run 一鍵部署 (方案 A 零成本架構)

本專案已包含自動化部署腳本 [`deploy-gcp.sh`](file:///Users/admin/program/MyMoney/deploy-gcp.sh)，所有 Docker 映像檔建置皆直接在 Google Cloud Build 雲端進行，**無需在本機安裝繁雜的編譯環境**。

### 步驟 1：安裝並登入 gcloud CLI
若尚未安裝 Google Cloud SDK：
```bash
# 透過 Homebrew 安裝
brew install --cask google-cloud-sdk

# 登入您的 Google 帳號
gcloud auth login
```

### 步驟 2：執行一鍵部署腳本
在專案根目錄下執行：
```bash
./deploy-gcp.sh
```
腳本將會自動：
1. 詢問您的 GCP Project ID。
2. 啟用必要的 GCP API（Cloud Build, Cloud Run, Artifact Registry）。
3. 自動將專案原始碼上傳至 Cloud Build 進行 Node 20 前端打包與 PHP 8.3-FPM 容器構建。
4. 部署至 **台灣彰化機房 (`asia-east1`)**。
5. 設定 `--min-instances 0`：**無流量時自動縮容至 0 台，完全 0 費用**！
6. 終端機最後將直接印出專屬的 HTTPS 上線網址（例如：`https://mymoney-app-xxxx-de.a.run.app`）。

---

## 🗄️ 資料庫切換指引 (SQLite ⇄ Supabase PostgreSQL)

- **預設 (零設定 SQLite)**：資料庫為檔案型態，零成本、零維護。
- **長青雲端儲存 (Supabase 免費版 PostgreSQL)**：
  若希望將資料庫獨立於容器之外，前往 [Supabase](https://supabase.com) 註冊免費專案，並在 GCP Cloud Run 環境變數中修改：
  ```
  DB_CONNECTION=pgsql
  DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
  DB_PORT=5432
  DB_DATABASE=postgres
  DB_USERNAME=postgres.[YOUR-PROJECT-REF]
  DB_PASSWORD=[YOUR-PASSWORD]
  DB_SSLMODE=require
  ```


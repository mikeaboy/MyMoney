#!/usr/bin/env bash
set -e

# ==============================================================================
# MyMoney 資產管理系統 - GCP Cloud Run 自動化部署腳本 (方案 A 零成本架構)
# 目標專案：test-app-513707 (台灣彰化 asia-east1 機房)
# ==============================================================================

echo "=========================================================="
echo "   開始部署 MyMoney 至 Google Cloud Run (極致低成本方案)   "
echo "=========================================================="

# 1. 檢查 gcloud 指令 (若本機未安裝，自動切換至 Docker 官方容器版)
if ! command -v gcloud &> /dev/null; then
    echo "💡 偵測到本機未安裝原生 gcloud，自動無縫切換使用 Docker 官方 SDK 容器..."
    gcloud() {
        local tty_opt=""
        [ -t 0 ] && tty_opt="-t"
        local port_opt=""
        if [ "$1" = "auth" ] && [ "$2" = "login" ]; then
            port_opt="-p 8085:8085"
        fi
        docker run --rm -i $tty_opt $port_opt \
          -v "$HOME/.config/gcloud:/root/.config/gcloud" \
          -v "$PWD:/workspace" \
          -w /workspace \
          gcr.io/google.com/cloudsdktool/google-cloud-cli:alpine gcloud "$@"
    }
fi

# 2. 檢查是否已完成登入驗證
echo "🔑 檢查 Google Cloud 登入狀態..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || echo "")

if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "⚠️ 尚未登入 Google Cloud 帳戶，現在為您啟動登入授權流程..."
    echo "👉 請在終端機顯示網址後，在瀏覽器打開並授權登入"
    gcloud auth login --no-launch-browser
fi

# 3. 設定 GCP 專案 ID (預設 test-app-513707)
DEFAULT_PROJECT="test-app-513707"
if [ -t 0 ]; then
    read -p "請確認您的 GCP Project ID [預設: ${DEFAULT_PROJECT}]: " GCP_PROJECT
fi
GCP_PROJECT=${GCP_PROJECT:-$DEFAULT_PROJECT}

gcloud config set project "$GCP_PROJECT"

# 4. 設定服務名稱與地區 (預設 asia-east1 台灣彰化機房)
SERVICE_NAME="mymoney-app"
REGION="asia-east1"

echo "📍 目標專案: $GCP_PROJECT"
echo "📍 目標地區: $REGION (台灣彰化機房)"
echo "📍 服務名稱: $SERVICE_NAME"
echo "🔒 費用防線: 實例範圍限制 0 ~ 1 台 (100% 鎖定在免費配額內)"

# 5. 確保必備 API 已啟用 (Cloud Run, Cloud Build, Artifact Registry)
echo ""
echo "🔧 檢查並啟用 GCP 必備 API..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com

# 6. 建置映像檔並直接部署至 Cloud Run (鎖定免費額度)
echo "🚀 正在透過 Google Cloud Build 建置容器映像檔並部署至 Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --source . \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --min-instances 0 \
    --max-instances 1 \
    --memory 512Mi \
    --cpu 1 \
    --port 8080

# 7. 取得線上正式網址
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')

echo ""
echo "=========================================================="
echo "🎉 部署完成！您的資產帳務系統已在 Google Cloud Run 上線！"
echo "=========================================================="
echo "🌐 線上正式網址："
echo "$SERVICE_URL"
echo ""

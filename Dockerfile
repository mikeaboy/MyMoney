# ==========================================
# 第一階段：Node 20 前端 Vite 編譯
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json vite.config.js tailwind.config.js postcss.config.js ./
RUN npm install
COPY resources ./resources
COPY public ./public
RUN npm run build

# ==========================================
# 第二階段：PHP 8.3-FPM + Nginx 正式生產容器
# ==========================================
FROM php:8.3-fpm-alpine

# 安裝系統套件與 PHP 擴充套件 (支援 SQLite 與 PostgreSQL)
RUN apk update && apk add --no-cache \
    nginx \
    curl \
    libpq-dev \
    libzip-dev \
    sqlite-dev \
    oniguruma-dev \
    bash \
    && docker-php-ext-install pdo pdo_sqlite pdo_pgsql bcmath opcache mbstring zip

# 安裝 Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# 複製後端相依設定檔並安裝
COPY composer*.json ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

# 複製應用程式原始碼
COPY . .

# 複製第一階段編譯完成的前端靜態資源 (Vite)
COPY --from=frontend-builder /app/public/build ./public/build

# 複製 Nginx 設定
COPY nginx.conf /etc/nginx/http.d/default.conf

# 確保 SQLite 資料庫檔案與目錄權限
RUN mkdir -p database storage/framework/views storage/framework/sessions storage/framework/cache storage/logs bootstrap/cache \
    && [ -f database/database.sqlite ] || touch database/database.sqlite \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache database

# 複製啟動腳本 (確保資料庫遷移後權限正確賦予 www-data，徹底杜絕同步異常)
RUN printf '#!/bin/bash\n\
PORT=${PORT:-8080}\n\
sed -i "s/8080/$PORT/g" /etc/nginx/http.d/default.conf\n\
\n\
# 自動執行資料庫遷移\n\
php artisan migrate --force || true\n\
\n\
# 確保 database 與 storage 權限屬於 www-data，避免唯讀與同步異常\n\
chown -R www-data:www-data /var/www/html/database /var/www/html/storage\n\
chmod -R 775 /var/www/html/database /var/www/html/storage\n\
chmod 664 /var/www/html/database/database.sqlite 2>/dev/null || true\n\
\n\
# 啟動 PHP-FPM 與 Nginx\n\
php-fpm -D\n\
nginx -g "daemon off;"\n' > /entrypoint.sh \
    && chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]


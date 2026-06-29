#!/bin/bash
set -e

DOMAIN="goodhair.site"
EMAIL="aspirineqwe01@gmail.com"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

echo ">>> [1/4] Dùng HTTP-only config để lấy SSL cert..."
cp nginx/nginx.conf nginx/nginx.conf.bak
cp nginx/nginx-init.conf nginx/nginx.conf
$COMPOSE up -d nginx

echo ">>> [2/4] Đợi nginx khởi động..."
sleep 5

echo ">>> [3/4] Yêu cầu SSL cert từ Let's Encrypt..."
$COMPOSE run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "api.$DOMAIN"

echo ">>> [4/4] Khôi phục HTTPS config và reload nginx..."
cp nginx/nginx.conf.bak nginx/nginx.conf
$COMPOSE exec nginx nginx -s reload

echo ""
echo "SSL setup xong! Chạy lệnh sau để start toàn bộ app:"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"

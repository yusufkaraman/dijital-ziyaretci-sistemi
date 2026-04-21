@echo off
title Dijital Ziyaretci Sistemi
echo ==================================================
echo      Dijital Ziyaretci Sistemi Baslatiliyor...
echo ==================================================
echo.

echo [1/2] Veritabani (PostgreSQL Docker) baslatiliyor...
docker-compose up -d
echo.

echo [2/2] Node.js Sunucusu baslatiliyor...
echo.
npm start

pause

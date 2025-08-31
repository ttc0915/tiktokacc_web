@echo off
chcp 65001 >nul
title TikTok网站局域网启动器

echo.
echo ===============================================
echo 🌐 TikTok库存网站 - 局域网访问
echo ===============================================
echo.

echo 📍 正在获取局域网IP地址...
python 获取局域网地址.py

echo.
echo 🚀 正在启动网站...
cd /d "%~dp0可视化tiktok账号地球数据"

if not exist "node_modules" (
    echo 📦 首次运行，正在安装依赖...
    npm install
    echo ✅ 依赖安装完成
    echo.
)

echo ⚡ 启动中，请稍等...
npm run dev

pause 
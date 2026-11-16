<!DOCTYPE html>
<html lang="zh-Hant" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>資產帳務管理系統 (MyMoney)</title>

    <!-- PWA 標準設定與主題色 -->
    <meta name="theme-color" content="#090b0e">
    <meta name="background-color" content="#090b0e">
    <meta name="application-name" content="資產帳務">
    <meta name="mobile-web-app-capable" content="yes">

    <!-- iOS Safari 主畫面與獨立視窗設定 -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="資產帳務">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg">
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
    <link rel="manifest" href="/manifest.webmanifest">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-[#090b0e] text-zinc-100 min-h-screen selection:bg-indigo-500/30 selection:text-indigo-200">
    <div id="app"></div>
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn('ServiceWorker registration failed:', err);
          });
        });
      }
    </script>
</body>
</html>

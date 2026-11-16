<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MarketDataController;

Route::prefix('v1')->middleware('throttle:60,1')->group(function () {
    // 即時市場報價與模糊搜尋 (股票台股與美股，每分鐘單一 IP 限流 60 次防濫用)
    Route::get('/market/stocks', [MarketDataController::class, 'getStockQuotes']);
    Route::get('/market/stocks/search', [MarketDataController::class, 'searchStocks']);

    // 健康檢查
    Route::get('/ping', fn() => response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]));
});

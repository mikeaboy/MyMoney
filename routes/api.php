<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\FinancialDataController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MarketDataController;

Route::prefix('v1')->group(function () {
    // 認證與使用者身分
    Route::post('/auth/session', [AuthController::class, 'getOrCreateSession']);
    Route::post('/auth/google', [AuthController::class, 'handleGoogleAuth']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // 帳務資料 (支援訪客工作階段或 Google 登入帳號)
    Route::get('/financial-data', [FinancialDataController::class, 'getData']);
    Route::post('/financial-data', [FinancialDataController::class, 'saveData']);

    // 即時市場報價與模糊搜尋 (股票台股與美股)
    Route::get('/market/stocks', [MarketDataController::class, 'getStockQuotes']);
    Route::get('/market/stocks/search', [MarketDataController::class, 'searchStocks']);

    // 預設與健康檢查
    Route::get('/ping', fn() => response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]));
});


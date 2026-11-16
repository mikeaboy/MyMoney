<?php

use Illuminate\Support\Facades\Route;

// SPA 萬用導向：所有非 API 請求皆由 Vue 3 SPA 接管
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '^(?!api).*$');


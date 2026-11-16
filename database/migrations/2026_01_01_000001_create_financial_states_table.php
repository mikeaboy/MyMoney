<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('session_key', 64)->nullable()->index();
            $table->longText('payload'); // 儲存結構化帳務 JSON
            $table->unsignedBigInteger('version')->default(1);
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'session_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_states');
    }
};


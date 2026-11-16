<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinancialState extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_key',
        'payload',
        'version',
        'last_synced_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'last_synced_at' => 'datetime',
        'version' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}


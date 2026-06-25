package com.telefoninho.child

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme

class MainActivity : ComponentActivity() {
    private val requestAudioPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
        setContent {
            MaterialTheme {
                TelefoninhoApp()
            }
        }
    }
}

package com.telefoninho.child.voip

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.telefoninho.child.data.ConfigStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class VoipBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (
            intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val store = ConfigStore(context.applicationContext)
                if (store.isPaired.first() && store.alwaysOn.first()) {
                    VoipForegroundService.start(context.applicationContext)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}

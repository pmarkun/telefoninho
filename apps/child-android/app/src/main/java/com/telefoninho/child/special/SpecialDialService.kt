package com.telefoninho.child.special

import com.telefoninho.child.data.ContactInfo
import kotlinx.coroutines.CoroutineScope

interface SpecialDialService {
    val extension: String
    val displayName: String
    val avatarKey: String
    val colorKey: String

    fun contact(): ContactInfo = ContactInfo(
        memberId = "special-$extension",
        displayName = displayName,
        avatarKey = avatarKey,
        colorKey = colorKey,
        sipExtension = extension,
        enabled = true,
    )

    fun start(scope: CoroutineScope, onFinished: () -> Unit, onError: (String) -> Unit)
    fun stop()
}

class SpecialDialServiceRegistry(private val services: List<SpecialDialService>) {
    fun find(extension: String): SpecialDialService? {
        val normalized = extension.trim()
        return services.firstOrNull { it.extension == normalized }
    }
}

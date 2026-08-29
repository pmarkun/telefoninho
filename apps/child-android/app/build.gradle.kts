plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.telefoninho.child"
    compileSdk = 35

    val defaultApiBaseUrl = "https://api.telefoninho.com.br"
    val envFile = file("../../../.env")
    val apiBaseUrl = if (envFile.exists()) {
        envFile.readLines()
            .firstOrNull { it.startsWith("ANDROID_API_BASE_URL=") }
            ?.removePrefix("ANDROID_API_BASE_URL=")
            ?.trim()
            ?: defaultApiBaseUrl
    } else {
        defaultApiBaseUrl
    }
    val releaseStoreFile = providers.environmentVariable("TELEFONINHO_UPLOAD_STORE_FILE").orNull
    val releaseStorePassword = providers.environmentVariable("TELEFONINHO_UPLOAD_STORE_PASSWORD").orNull
    val releaseKeyAlias = providers.environmentVariable("TELEFONINHO_UPLOAD_KEY_ALIAS").orNull
    val releaseKeyPassword = providers.environmentVariable("TELEFONINHO_UPLOAD_KEY_PASSWORD").orNull
    val hasReleaseSigning = listOf(
        releaseStoreFile,
        releaseStorePassword,
        releaseKeyAlias,
        releaseKeyPassword,
    ).all { !it.isNullOrBlank() }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "com.telefoninho.child"
        minSdk = 26
        targetSdk = 35
        versionCode = 5
        versionName = "0.1.4"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

val linphoneVersion = "5.4.+"

dependencies {
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.compose.ui:ui:1.7.0")
    implementation("androidx.compose.material3:material3:1.3.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    implementation("androidx.camera:camera-view:1.4.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.1")
    implementation("org.linphone.no-video:linphone-sdk-android:$linphoneVersion")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("com.google.zxing:core:3.5.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}

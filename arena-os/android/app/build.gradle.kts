plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace="com.forgeatlas.arena"
    compileSdk=35

    defaultConfig {
        applicationId="com.forgeatlas.arena"
        minSdk=26
        targetSdk=35
        versionCode=11
        versionName="11.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
}

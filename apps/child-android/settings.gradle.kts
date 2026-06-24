pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven {
            name = "linphone.org"
            url = uri("https://download.linphone.org/maven_repository")
        }
    }
}

rootProject.name = "child-android"
include(":app")


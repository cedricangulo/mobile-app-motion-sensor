# Motion Dice — LAB3

Ionic + Angular + Capacitor app that rolls a dice (1-6) when you shake the phone
along the X axis.

- The number only changes on **major movement**, then **~800 ms after you stop
  moving**, so you can read the result while holding the phone.
- Minor movement / hand tremor is ignored.
- The accelerometer listener is removed in `ngOnDestroy`, so revisiting the page
  does not stack up listeners.

## Why there is a local plugin instead of `@capacitor/motion`

`@capacitor/motion` ships **no Android implementation**. Its published package
contains only `dist/` — no `android/` directory — unlike `@capacitor/geolocation`,
which ships Kotlin sources. It is a web-only plugin that forwards the browser
`devicemotion` event, and the Android WebView never fires that for the
accelerometer. Installing it and calling `Motion.addListener('accel', …)` succeeds,
returns a handle, and then silently never emits an event: the app runs, the dice
stays on 0, and nothing in the console explains why.

So the accelerometer is implemented locally instead:

| Layer | File | Role |
|---|---|---|
| Native | `android/app/src/main/java/io/ionic/motiondice/AccelerometerPlugin.java` | `@CapacitorPlugin(name = "Accelerometer")` over `SensorManager` / `TYPE_ACCELEROMETER` at `SENSOR_DELAY_GAME` |
| Bridge | `src/app/accelerometer/accelerometer.ts` | `registerPlugin<AccelerometerPlugin>('Accelerometer')` + the event types |
| Web fallback | `src/app/accelerometer/accelerometer.web.ts` | forwards `devicemotion` so `ng serve` and tests still work in a browser |

The plugin is compiled into the app module (no separate Gradle module), so it
needs no extra build wiring. Its payload deliberately matches `@capacitor/motion`
— `{ accelerationIncludingGravity: { x, y, z } }` in m/s² — so page code reads the
same either way, and swapping back would be a one-line import change.

`addListener` rejects immediately when no accelerometer exists, and
`handleOnDestroy` unregisters the sensor so it cannot outlive the WebView.

## Prerequisites

| Tool | Version |
|---|---|
| [Bun](https://bun.sh) | 1.4+ |
| Node.js | `^20.19.0 || ^22.12.0 || >=24` (Angular 22 requirement) |
| JDK | **21** — Capacitor forces `JavaVersion.VERSION_21`; JDK 17 or 8 will fail |
| Android SDK | cmdline-tools + `platforms;android-35` + `build-tools;35.0.0` |
| Device | Real Android phone. **An emulator has no accelerometer.** |

Android Studio is not required — the whole build runs from the command line.

## Setup

```bash
bun install
```

> If `android/local.properties` appears, delete it. It records a machine-specific
> `sdk.dir` and must never be committed; the build uses `ANDROID_HOME` instead.

## Build the web app, then the Android APK

```bash
# 1. Point the shell at JDK 21 and the SDK.
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
export ANDROID_HOME="/c/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# 2. Build the web bundle into www/
bun run build

# 3. Copy www/ and the plugins into the native project.
#    ./node_modules/.bin is used rather than npx/bunx because the npx wrapper
#    fails to resolve its executable on Windows under bun.
./node_modules/.bin/capacitor sync android

# 4. Assemble the debug APK.
cd android
./gradlew.bat assembleDebug        # Windows
# ./gradlew assembleDebug           # macOS / Linux
cd ..

# 5. Install it on the connected phone.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

The first Gradle run downloads the distribution (~100 MB) and the SDK components;
later builds take roughly 90 s.

### `capacitor sync` is not optional

`android/settings.gradle` unconditionally `include ':capacitor-cordova-android-plugins'`,
and that directory is **git-ignored** because `capacitor sync` generates it. Building
without syncing first fails during Gradle configuration. Always run step 3 before step 4.

## AGP version

The project is pinned to **AGP 8.7.2**, which is what Capacitor 7.4.3 ships. It must
agree in all three places:

| File | How it can drift |
|---|---|
| `android/build.gradle` | Never — committed at 8.7.2 |
| `node_modules/@capacitor/android/capacitor/build.gradle` | Every `bun install` |
| `android/capacitor-cordova-android-plugins/build.gradle` | Every `capacitor sync` |

Verify:

```bash
grep -rn "com.android.tools.build:gradle" \
  android/build.gradle \
  node_modules/@capacitor/android/capacitor/build.gradle \
  android/capacitor-cordova-android-plugins/build.gradle
```

All three should read `8.7.2`. If one reads `8.13.0`, Capacitor 8 was installed over
Capacitor 7 — which also demands `compileSdk 36` and will not resolve against an SDK
that only has `android-35`.

## Testing

- Shake the phone side to side along the X axis firmly. The number stays put while you
  move, then rolls ~0.8 s after you stop.
- Holding the phone still, or small tremors, will not change the number.
- An emulator has no accelerometer, so `addListener` rejects and the face stays at 0.
  `uses-feature android.hardware.sensor.accelerometer` is marked `required`, so the app
  will not install on one. Test on a real device:
  ```bash
  adb install -r android/app/build/outputs/apk/debug/app-debug.apk
  ```
- Threshold is `MAJOR_MOVE_THRESHOLD = 3` m/s² in `home.page.ts`. If it feels too stiff
  or too twitchy in your hand, that is the number to change.

## Project layout

```
src/app/accelerometer/         # Capacitor bridge to the native plugin
android/app/src/main/java/io/ionic/motiondice/AccelerometerPlugin.java
                               # native accelerometer (SensorManager)
src/app/home/home.page.ts      # shake threshold, 800 ms debounce, rollDice()
src/app/home/home.page.html    # centred square showing the dice number
android/                       # native Android project (Capacitor) — sync before building
```

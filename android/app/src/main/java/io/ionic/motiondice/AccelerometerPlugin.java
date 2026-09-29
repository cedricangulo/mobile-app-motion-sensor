package io.ionic.motiondice;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Streams accelerometer readings to the web layer.
 *
 * <p>Exists because {@code @capacitor/motion} ships no Android implementation — it is a
 * web-only plugin that listens for the browser {@code devicemotion} event, which the
 * Android WebView never fires for the accelerometer. The payload shape deliberately
 * matches that plugin ({@code accelerationIncludingGravity: {x, y, z}}) so page code
 * reads the same either way.
 *
 * <p>Readings are in m/s^2 and include gravity, matching
 * {@link SensorManager#TYPE_ACCELEROMETER}.
 *
 * <p><b>Two things are required for this plugin to be callable, and both fail silently:</b>
 * <ol>
 *   <li>It must be registered in {@code MainActivity} via
 *       {@code registerPlugin(AccelerometerPlugin.class)}, because the bridge only
 *       auto-registers npm plugins listed in {@code capacitor.plugins.json}.</li>
 *   <li>Every <em>overridden</em> {@code @PluginMethod} must be re-annotated.
 *       {@code PluginHandle.indexMethods()} reads
 *       {@code method.getAnnotation(PluginMethod.class)}, and Java does not inherit
 *       method annotations across an override — so an override without the annotation
 *       silently disappears from {@code PluginHeaders}, and the JS proxy then throws
 *       {@code "Accelerometer.addListener()" is not implemented on android}.</li>
 * </ol>
 */
@CapacitorPlugin(name = "Accelerometer")
public class AccelerometerPlugin extends Plugin implements SensorEventListener {

    /** Event name the TypeScript bridge subscribes to. */
    private static final String EVENT_ACCEL = "accel";

    /**
     * ~50 ms between samples. Game rate is the right trade-off for shake detection:
     * responsive enough to catch a shake, cheap enough not to drain the battery.
     */
    private static final int SENSOR_DELAY = SensorManager.SENSOR_DELAY_GAME;

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private boolean listening;

    /**
     * Resolves the sensor once, eagerly, so {@link #addListener} can reject immediately
     * on a device (or emulator) with no accelerometer rather than silently doing nothing.
     */
    @Override
    public void load() {
        Context context = getContext();
        if (context == null) {
            return;
        }
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        }
    }

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    @Override
    public void addListener(PluginCall call) {
        if (accelerometer == null) {
            call.reject("No accelerometer on this device");
            return;
        }

        // Registers the JS listener with the bridge and starts the sensor on the first
        // subscription. Re-adding is a no-op so duplicate calls cannot double-register.
        super.addListener(call);
        startListening();
    }

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    @Override
    public void removeListener(PluginCall call) {
        super.removeListener(call);
        // Stop as soon as the last listener goes away, so a torn-down page stops the
        // sensor instead of leaving it running in the background.
        if (!hasListeners(EVENT_ACCEL)) {
            stopListening();
        }
    }

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    @Override
    public void removeAllListeners(PluginCall call) {
        super.removeAllListeners(call);
        stopListening();
    }

    /**
     * Unregisters the sensor when the bridge is destroyed. Without this the listener
     * outlives the WebView and keeps the sensor awake.
     */
    @Override
    protected void handleOnDestroy() {
        stopListening();
    }

    private void startListening() {
        if (listening || sensorManager == null || accelerometer == null) {
            return;
        }
        listening = sensorManager.registerListener(this, accelerometer, SENSOR_DELAY);
    }

    private void stopListening() {
        if (!listening || sensorManager == null) {
            return;
        }
        sensorManager.unregisterListener(this);
        listening = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_ACCELEROMETER || event.values.length < 3) {
            return;
        }

        float x = event.values[0];
        float y = event.values[1];
        float z = event.values[2];

        JSObject acceleration = new JSObject();
        acceleration.put("x", x);
        acceleration.put("y", y);
        acceleration.put("z", z);

        // Mirrors @capacitor/motion: the reading that includes gravity sits under
        // `accelerationIncludingGravity`, with `acceleration` kept as the alias.
        JSObject payload = new JSObject();
        payload.put("accelerationIncludingGravity", acceleration);
        payload.put("acceleration", acceleration);

        notifyListeners(EVENT_ACCEL, payload);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Accuracy changes are not surfaced; the readings are good enough to detect
        // deliberate shaking regardless.
    }
}

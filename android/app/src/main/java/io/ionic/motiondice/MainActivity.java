package io.ionic.motiondice;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Registers the app-local {@link AccelerometerPlugin} with the Capacitor bridge.
 *
 * <p>This line is required. The bridge only auto-registers npm-installed plugins, via
 * the {@code capacitor.plugins.json} that `capacitor sync` generates. A plugin compiled
 * into the app module is invisible to that mechanism, so without this call every
 * {@code Accelerometer.addListener(...)} fails with
 * {@code "unable to find plugin : Accelerometer"} and the dice never responds to a
 * shake. Registration must happen before {@code super.onCreate}.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AccelerometerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

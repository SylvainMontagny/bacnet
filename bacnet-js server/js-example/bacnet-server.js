/**
 * BACnet/IP server example (plain JavaScript, ESM).
 *
 * Starts a BACnet device that:
 *  - Announces itself on the network (WhoIs → IAm, automatic)
 *  - Answers ReadProperty requests for all registered objects (automatic)
 *  - Serves live sensor values updated on a timer (BDSingletProperty.setValue)
 *  - Serves on-demand computed values evaluated at read time (BDPolledSingletProperty)
 *
 * Prerequisites:
 *   npm install          (inside this js-example/ folder)
 *
 * Run:
 *   node bacnet-server.js
 *   # or: npm start
 */

import {
  BDDevice,
  BDAnalogValue,
  BDAnalogInput,
  BDBinaryValue,
  BDObject,
  BDPolledSingletProperty,
} from '@bacnet-js/device';
import { EngineeringUnits, ApplicationTag, PropertyIdentifier, ObjectType } from '@bacnet-js/client';

// -------------------------------------------------------------------
// 1. Create the device
//    The instance number (1234) must be unique on the BACnet network.
//    Valid range: 0 – 4 194 303
// -------------------------------------------------------------------
const device = new BDDevice(1234, {
  port: 47808,                          // Standard BACnet/IP UDP port
  interface: '0.0.0.0',                // Bind to all network interfaces
  broadcastAddress: '255.255.255.255', // Used for WhoIs broadcast responses
  name: 'My BACnet Server',
  vendorName: 'My Company',
  modelName: 'Node.js BACnet Device',
});

// -------------------------------------------------------------------
// 2a. Static-then-updated object
//     Present_Value is stored in a BDSingletProperty.
//     BDDevice answers any ReadProperty request for it automatically.
//     We update the value on a timer to simulate a live sensor.
// -------------------------------------------------------------------
const zoneTemp = device.addObject(new BDAnalogValue({
  name: 'Zone Temperature',
  unit: EngineeringUnits.DEGREES_CELSIUS,
  presentValue: 21.5,
}));

// Simulate a sensor: update the stored value every 5 seconds.
// The next ReadProperty from any client will return the fresh value.
setInterval(async () => {
  const newTemp = 20 + Math.random() * 5;           // 20–25 °C
  await zoneTemp.presentValue.setValue(newTemp);
  console.log(`[sensor] Zone Temperature updated → ${newTemp.toFixed(2)} °C`);
}, 5_000);

// -------------------------------------------------------------------
// 2b. On-demand polled object
//     BDPolledSingletProperty evaluates its callback at read time,
//     so every ReadProperty gets a fresh value without a timer.
// -------------------------------------------------------------------
class LiveCpuLoadObject extends BDObject {
  constructor() {
    super(ObjectType.ANALOG_VALUE, {
      name: 'CPU Load',
      description: 'Simulated CPU load, computed fresh on each ReadProperty',
    });

    // Add a polled Present_Value: callback is called on every ReadProperty
    this.addProperty(new BDPolledSingletProperty(
      PropertyIdentifier.PRESENT_VALUE,
      ApplicationTag.REAL,
      (_ctx) => {
        const load = Math.random() * 100;  // 0–100 %
        console.log(`[poll]   CPU Load read → ${load.toFixed(2)} %`);
        return load;
      },
    ));
  }
}

device.addObject(new LiveCpuLoadObject());

// -------------------------------------------------------------------
// 2c. Binary value — HVAC on/off state
// -------------------------------------------------------------------
const hvac = device.addObject(new BDBinaryValue({
  name: 'HVAC On/Off',
  presentValue: true,
}));

// Toggle HVAC state every 10 seconds (demo)
setInterval(async () => {
  const current = hvac.presentValue.getValue();
  await hvac.presentValue.setValue(!current);
  console.log(`[sensor] HVAC On/Off toggled → ${!current}`);
}, 10_000);

// -------------------------------------------------------------------
// 3. Event listeners
//    WhoIs → IAm        : automatic (BDDevice)
//    ReadProperty       : automatic (BDDevice) for all registered objects
//    ReadPropertyMultiple: automatic (BDDevice)
// -------------------------------------------------------------------
device.on('listening', () => {
  console.log('[BACnet] Server is online');
  console.log('  Device instance : 1234');
  console.log('  Port            : 47808');
  console.log('  WhoIs/IAm       : automatic');
  console.log('  ReadProperty    : automatic for all registered objects');
});

device.on('error', (err) => {
  console.error('[BACnet] Error:', err.message);
});

// -------------------------------------------------------------------
// 4. Graceful shutdown on Ctrl+C
// -------------------------------------------------------------------
process.on('SIGINT', async () => {
  console.log('\n[BACnet] Shutting down…');
  await device.destroy();
  process.exit(0);
});

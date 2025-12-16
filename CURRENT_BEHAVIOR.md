# Current Behavior Documentation - freeAtHomeApi.ts

**Created:** 2025-12-09
**Purpose:** Baseline documentation for regression testing during migration to freeathome-local-api-client

## Current Implementation Overview

The `FreeAtHomeApi` class currently uses the `freeathome-api` GitHub fork (ZzAve/freeathome-api#feature-abb-structure) to connect to a Busch Jaeger SysAp via XMPP protocol.

## Dependencies

```typescript
import { BroadcastMessage } from "freeathome-api/dist/lib/BroadcastMessage";
import { ClientConfiguration, SystemAccessPoint } from "freeathome-api";
import { Subscriber } from "freeathome-api/dist/lib/Subscriber";
```

## Class Structure

### Key Fields
- `_connected: boolean` - Connection state flag
- `systemAccessPoint: SystemAccessPoint` - Main connection object
- `watchedDevices: Map<string, DeviceRegistrationRequest>` - Registry of devices
- `_pollInterval: NodeJS.Timeout` - Polling timer (5 min intervals)
- `_sequenceId: number` - Random ID to track restart sequences
- `count: number` - Message counter

### Architecture Pattern
- **Callback-based:** Implements `Subscriber` interface
- **Event-driven:** Devices register callbacks for updates
- **Dual update mechanism:** Real-time broadcasts + polling fallback

## Critical Behaviors to Maintain

### 1. Connection Lifecycle

**start(config?: ClientConfiguration)**
- Accepts optional ClientConfiguration: `{hostname, username, password}`
- Creates `SystemAccessPoint` via `safeConfig()`
- Calls `systemAccessPoint.connect()` (returns Promise)
- Waits up to 40 seconds (20 retries × 2s) for first message
- Enables polling after connection
- On error: triggers `restart(60000)` (60s delay)

**Current behavior on first message:**
- `broadcastMessage()` receives first message
- Sets `_connected = true`
- Logs "Received first message"
- Fires `Homey.app.apiConnectedTrigger()`

**stop(force?: Boolean)**
- Generates new `_sequenceId` to invalidate pending restarts
- Calls `systemAccessPoint.disconnect()`
- Disables polling
- Sends `onError()` to all registered devices
- Fires `Homey.app.apiDisconnectedTrigger()`

**restart(timeout: number, config?: ClientConfiguration)**
- Calls `stop(true)`
- Saves current `_sequenceId`
- Waits for timeout (default: 60s)
- Checks if restart is still relevant (sequenceId match)
- Calls `start()` with optional new config
- On error: recursively calls `restart(60000)`

### 2. Message Processing

**broadcastMessage(message: BroadcastMessage)**
- Signature: Implements `Subscriber.broadcastMessage()`
- Called by library when messages arrive
- First message behavior:
  - Sets `_connected = true`
  - Logs full message
  - Triggers `apiConnectedTrigger()`
- Message types:
  - `"error"`: Triggers restart (TimeoutError: 10s, other: 60s)
  - `"update"`: Processes device updates
- Message structure:
  ```typescript
  {
    type: "update" | "error",
    result: {
      [serialNumber: string]: {
        channels: { ... }
      }
    }
  }
  ```

**processUpdate(message: BroadcastMessage)**
- Iterates through `message.result` (keyed by serialNumber)
- For each serialNumber, finds matching devices in `watchedDevices`
- Calls `device.onUpdate({ id: uniqueId, deviceState: deviceUpdate })`
- Returns number of promises created
- Uses `Promise.all()` for parallel processing

### 3. Device Registration

**registerDevice(request: DeviceRegistrationRequest)**
- Signature:
  ```typescript
  {
    serialNumber: string,
    channel: string,
    onPoll: (msg: FreeAtHomeMessage) => void,
    onUpdate: (msg: FreeAtHomeMessage) => void,
    onError: (message: string, cause: any) => void
  }
  ```
- Queues registration in `queuedRegistration`
- If connected: immediately calls `processRegistrations()`
- Otherwise: waits for first message

**processRegistrations()**
- Called when first message arrives
- Fetches full device state via `getAllDevices()`
- Processes all queued registrations
- For each device:
  - Creates `uniqueId` as `${serialNumber}-${channel}`
  - Stores in `watchedDevices` Map
  - Validates device exists in SysAp state
  - Calls `onPoll()` with initial state
  - Enables polling if needed

**Callback signatures:**
```typescript
type FreeAtHomeMessage = {
  id: string;          // uniqueId (serialNumber-channel)
  deviceState: any;    // Full device object with channels
};
```

### 4. Device State Queries

**getAllDevices()**
- Current API: `systemAccessPoint.getDeviceData()`
- Returns: `{ [serialNumber: string]: { channels: {...} } }`
- Called during:
  - Polling (every 5 minutes)
  - Device registration
- On error: returns `{}` empty object

**setDeviceState(deviceId, channel, dataPoint, value)**
- Current API: `systemAccessPoint.setDatapoint(device, channel, dp, value)`
- Parameters: 4 arguments (no sysApUuid needed)
- All parameters converted to strings
- Only executes if `_connected === true`
- Returns promise from API call

### 5. Polling Mechanism

**enablePolling()**
- Only enables if `watchedDevices.size >= 1`
- Prevents duplicate intervals (checks `_pollInterval` exists)
- Interval: `POLL_INTERVAL = 5 * 60 * 1000` (5 minutes)
- Callback: `_onPoll()`

**_onPoll()**
- Guards: Skip if already polling or not connected
- Fetches full state via `getAllDevices()`
- For each device in `watchedDevices`:
  - Calls `onPoll({ id: uniqueId, deviceState: device })`
  - Uses `safeStateSync()` wrapper for error handling
- On error: calls `onError()` for all devices

**disablePolling()**
- Called during `stop()`
- Clears interval with `clearInterval(this._pollInterval)`

### 6. Queue Management

**Update Queue (`queuedUpdates`)**
- Prevents concurrent update processing
- `_updating` flag guards `processUpdate()`
- Queues updates if already processing
- Recursively processes queue after completion

**Registration Queue (`queuedRegistration`)**
- Stores device registrations before connection
- Processed when first message arrives
- Processed in `broadcastMessage()` and `registerDevice()`

### 7. Error Handling

**Connection Errors:**
- `start()` catch: triggers `restart(60000)`
- `broadcastMessage()` TimeoutError: triggers `restart(10000)`
- `broadcastMessage()` unknown error: triggers `restart(60000)`
- `restart()` catch: triggers `restart(60000)` recursively

**Device Operation Errors:**
- `getAllDevices()` catch: returns `{}`
- `processUpdate()` catch: logs error
- `_onPoll()` catch: calls `onError()` on all devices
- `safeStateSync()` catch: logs error per device

### 8. Logging Behavior

**Message Counter:**
- Increments on every "update" message
- Logs full message every 10 messages
- First message always fully logged

**Key Log Messages:**
- "Creating freeathome instance"
- "Starting free@home API"
- "Setting up SystemAccessPoint connection to: {hostname} with user {username}"
- "Received first message: {message}" (only once)
- "Received a message: {count} {message}" (every 10)
- "Polling for all devices..."
- "Registering {serialNumber} {channel}"
- "Successfully registered {serialNumber} {channel}"

## Constructor Signature (Old Library)

```typescript
new SystemAccessPoint(
  config: ClientConfiguration,  // {hostname, username, password}
  subscriber: Subscriber,        // 'this' - callbacks
  third: null                    // Unknown parameter
)
```

## Expected Behaviors After Migration

All the behaviors documented above MUST continue to work exactly the same way from the perspective of:
- `app.js` (no changes needed)
- Device drivers (no changes needed)
- Device base classes (no changes needed)

The only file that should change is `lib/freeAtHomeApi.ts` internally.

## Test Scenarios for Regression

1. **Initial Connection:**
   - App starts, connects to SysAp
   - First message received within 40 seconds
   - `apiConnected` trigger fires
   - Devices can be discovered

2. **Device Control:**
   - Commands sent via `setDeviceState()` execute
   - Device state changes in Free@Home system

3. **Real-time Updates:**
   - Changes in Free@Home app appear in Homey
   - `onUpdate()` callbacks fired correctly
   - Device UI updates

4. **Polling:**
   - Polling runs every 5 minutes
   - `onPoll()` callbacks fired for all registered devices
   - Devices sync state correctly

5. **Error Recovery:**
   - Network disconnection detected
   - Automatic reconnection after 60s
   - Devices notified of disconnection
   - Devices work after reconnection

6. **Settings Change:**
   - Change SysAp credentials
   - `restart()` called with new config
   - New connection established
   - Devices work with new connection

7. **App Restart:**
   - Clean shutdown via `stop()`
   - Clean startup via `start()`
   - All devices reconnect
   - No memory leaks

## File Backup

The original file has been preserved in git history at commit `30b19ea`.
To restore: `git checkout 30b19ea -- lib/freeAtHomeApi.ts`

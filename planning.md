# Migration Plan: freeathome-api → freeathome-local-api-client

## Overview

Replace the GitHub fork `freeathome-api` (ZzAve/freeathome-api#feature-abb-structure) with the official npm package `freeathome-local-api-client` v1.9.0.

**Strategy:** The migration is isolated to a single wrapper class (`lib/freeAtHomeApi.ts`), making it manageable with low risk.

## Quick Reference

### Critical Files to Modify
- [ ] `package.json` - Update dependencies
- [ ] `lib/freeAtHomeApi.ts` - Main migration work (rewrite internal implementation)

### Files to Reference (no changes needed)
- `app.js` - Verify API initialization pattern
- `lib/freeAtHomeDeviceBase.ts` - Understand device consumption pattern
- `lib/freeAtHomeDriver.ts` - Understand discovery pattern

---

## Phase 1: Preparation

### 1.1 Pre-Migration Checklist
- [x] Create feature branch: `git checkout -b feature/migrate-to-freeathome-local-api-client`
- [x] Document current behavior for regression testing
- [x] Backup current `lib/freeAtHomeApi.ts`
- [x] Ensure dev environment is ready

### 1.2 Understanding Key Differences

**Old Library Pattern (freeathome-api):**
- Callback-based with `Subscriber` interface
- `connect()` returns Promise
- `getDeviceData()` for device list
- `setDatapoint(device, channel, dp, value)`

**New Library Pattern (freeathome-local-api-client):**
- RxJS Observable-based
- `connectWebSocket()` is void, uses events
- `getConfiguration()` for full config
- `setDatapoint(sysApUuid, device, channel, dp, value)` - requires sysApUuid!

---

## Phase 2: Implementation

### 2.1 Update Dependencies (package.json)

- [x] Remove old dependency:
  ```json
  "freeathome-api": "github:ZzAve/freeathome-api#feature-abb-structure"
  ```

- [x] Add new dependencies:
  ```json
  "freeathome-local-api-client": "^1.9.0",
  "rxjs": "^7.8.2"
  ```

- [x] Run: `npm install`

- [x] Verify installation: `npm list freeathome-local-api-client rxjs`

### 2.2 Update Imports (lib/freeAtHomeApi.ts)

- [ ] Replace old imports:
  ```typescript
  // REMOVE these lines:
  import { BroadcastMessage } from "freeathome-api/dist/lib/BroadcastMessage";
  import { ClientConfiguration, SystemAccessPoint } from "freeathome-api";
  import { Subscriber } from "freeathome-api/dist/lib/Subscriber";
  ```

- [ ] Add new imports:
  ```typescript
  // ADD these lines:
  import { SystemAccessPoint, WebSocketMessage } from "freeathome-local-api-client";
  import { Subscription } from "rxjs";
  ```

- [ ] Add internal compatibility types:
  ```typescript
  type BroadcastMessage = {
    type: "error" | "update";
    result: any;
  };

  type ClientConfiguration = {
    hostname: string;
    username: string;
    password: string;
  };
  ```

- [ ] Remove `implements Subscriber` from class declaration

### 2.3 Add New Private Fields

- [ ] Add to class:
  ```typescript
  private _sysApUuid: string | null = null;
  private subscription: Subscription | null = null;
  ```

### 2.4 Update Constructor

- [ ] Add field initialization:
  ```typescript
  constructor() {
    super();
    this.on("__log", Homey.app.log.bind(this, "[FreeAtHomeAPI]"));
    this.on("__error", Homey.app.error.bind(this, "[FreeAtHomeAPI]"));

    this.log("Creating freeathome instance");
    this._connected = false;
    this._sysApUuid = null;        // ADD this line
    this.subscription = null;       // ADD this line
    this.watchedDevices = new Map<string, DeviceRegistrationRequest>();
    this.queuedUpdates = new Queue();
    this.queuedRegistration = new Queue();
  }
  ```

### 2.5 Rewrite safeConfig() Method

- [ ] Replace entire `safeConfig()` method:
  ```typescript
  private safeConfig(config: ClientConfiguration) {
    let sysApConfig = {
      hostname: "",
      username: "",
      password: "",
      ...config
    };

    this.log(
      `Setting up SystemAccessPoint connection to: ${sysApConfig.hostname} with user ${sysApConfig.username}`
    );

    // NEW: Constructor signature changed
    return new SystemAccessPoint(
      sysApConfig.hostname,
      sysApConfig.username,
      sysApConfig.password,
      true,   // tlsEnabled
      false,  // verboseErrors
      console // logger
    );
  }
  ```

### 2.6 Add Message Transformation Methods

- [ ] Add `handleWebSocketMessage()` method:
  ```typescript
  private handleWebSocketMessage(message: WebSocketMessage): void {
    try {
      const transformedMessage = this.transformMessage(message);
      this.broadcastMessage(transformedMessage);
    } catch (e) {
      this.error("Error handling WebSocket message", e);
    }
  }
  ```

- [ ] Add `transformMessage()` method:
  ```typescript
  private transformMessage(wsMessage: WebSocketMessage): BroadcastMessage {
    if (!this._sysApUuid || !wsMessage[this._sysApUuid]) {
      return {
        type: "error",
        result: { message: "Invalid WebSocket message structure" }
      };
    }

    const sysApData = wsMessage[this._sysApUuid];

    return {
      type: "update",
      result: sysApData.devices || {}
    };
  }
  ```

- [ ] Add `handleWebSocketError()` method:
  ```typescript
  private handleWebSocketError(error: any): void {
    this.error("WebSocket error occurred", error);
    this.processMessage({
      type: "error",
      result: error
    });
  }
  ```

### 2.7 Rewrite start() Method

- [ ] Replace entire `start()` method with:
  ```typescript
  async start(config?: ClientConfiguration) {
    this.log("Starting free@home API");
    this.count = 0;

    if (config) {
      this.log("(re)Setting config");
      this.systemAccessPoint = this.safeConfig(config);
    }

    try {
      // Discover sysApUuid if not yet known
      if (!this._sysApUuid) {
        this.log("Discovering sysApUuid...");
        const configuration = await this.systemAccessPoint.getConfiguration();
        this._sysApUuid = Object.keys(configuration)[0];
        this.log(`Discovered sysApUuid: ${this._sysApUuid}`);
      }

      // Setup error event listener
      this.systemAccessPoint.on('websocket-error', (error) => {
        this.handleWebSocketError(error);
      });

      // Setup subscription BEFORE connecting
      this.subscription = this.systemAccessPoint
        .getWebSocketMessages()
        .subscribe(
          (msg) => this.handleWebSocketMessage(msg),
          (err) => this.handleWebSocketError(err)
        );

      // Connect WebSocket (certificateVerification=false for local network)
      this.systemAccessPoint.connectWebSocket(false);

      await this.waitUntilConnected(20, 2000, this._sequenceId);
      this.enablePolling();
    } catch (e) {
      this.error("Could not connect to SysAp: ", e);
      await this.restart(60000);
    }
  }
  ```

### 2.8 Update stop() Method

- [ ] Replace entire `stop()` method with:
  ```typescript
  async stop(force?: Boolean) {
    this.log("Stopping free@home API");
    this._sequenceId = Math.random();

    if (force === true || this._connected) {
      try {
        // Unsubscribe from Observable
        if (this.subscription) {
          this.subscription.unsubscribe();
          this.subscription = null;
        }

        // Disconnect WebSocket
        this.systemAccessPoint.disconnectWebSocket(force ? true : false);
      } catch (e) {
        this.error("Stopping failed. Please continue");
      }

      this.disablePolling();
      this._onError(
        "Disconnected from free@home API",
        new FreeAtHomeError("stopped_freeathome")
      );

      if (this._connected === true) {
        this._connected = false;
        Homey.app.apiDisconnectedTrigger();
      }
    }
  }
  ```

### 2.9 Update getAllDevices() Method

- [ ] Replace method body:
  ```typescript
  public async getAllDevices() {
    if (this._connected) {
      this.log("Getting device info");
      try {
        // OLD: return await this.systemAccessPoint.getDeviceData();
        // NEW:
        const configuration = await this.systemAccessPoint.getConfiguration();
        return configuration[this._sysApUuid]?.devices || {};
      } catch (e) {
        this.error("Error getting device data", e);
        return {};
      }
    } else {
      this.log("Not connected to system access point");
      return {};
    }
  }
  ```

### 2.10 Update setDeviceState() Method

- [ ] Replace method body:
  ```typescript
  async setDeviceState(deviceId, channel, dataPoint, value) {
    if (this._connected && this._sysApUuid) {
      // NEW: Added sysApUuid as first parameter
      return await this.systemAccessPoint.setDatapoint(
        this._sysApUuid,
        deviceId.toString(),
        channel.toString(),
        dataPoint.toString(),
        value.toString()
      );
    }
  }
  ```

### 2.11 Build and Initial Verification

- [ ] Run build: `npm run build`
- [ ] Fix any TypeScript compilation errors
- [ ] Review build output for warnings

---

## Phase 3: Testing

### 3.1 Connection Tests

- [ ] App starts successfully
- [ ] Connection to Free@Home SysAp established
- [ ] First message received (log shows "Received first message")
- [ ] `_connected` flag set to `true`
- [ ] `_sysApUuid` discovered and logged
- [ ] `apiConnected` trigger fires

### 3.2 Device Discovery Tests

- [ ] Start device pairing in Homey
- [ ] Verify devices are discovered
- [ ] Check device list shows all expected devices
- [ ] Verify device metadata (names, types, channels) is correct

### 3.3 Device Control Tests

- [ ] Test switch device: Turn on/off
- [ ] Test dimmer device: Dim up/down, on/off
- [ ] Test blind device: Open, close, stop, set position
- [ ] Test heating device: Set temperature
- [ ] Verify commands execute successfully
- [ ] Check Free@Home system reflects the changes

### 3.4 Update Reception Tests

- [ ] Change device state via Free@Home app
- [ ] Verify Homey receives WebSocket update
- [ ] Verify device state updates in Homey UI
- [ ] Test with multiple devices changing simultaneously
- [ ] Verify message transformation works correctly

### 3.5 Polling Tests

- [ ] Wait for 5-minute polling interval
- [ ] Verify polling executes: "Polling for all devices..." in logs
- [ ] Verify all registered devices are polled
- [ ] Check device states sync correctly
- [ ] Verify no errors during polling

### 3.6 Error Handling Tests

- [ ] Disconnect network cable from SysAp
- [ ] Verify error is detected
- [ ] Verify `websocket-error` event is handled
- [ ] Check automatic reconnection kicks in
- [ ] Verify devices are notified of disconnection
- [ ] Reconnect network and verify recovery

### 3.7 Settings Change Tests

- [ ] Change SysAp settings in Homey (hostname/username/password)
- [ ] Verify `restart()` is triggered
- [ ] Verify old connection is cleaned up
- [ ] Verify new connection establishes successfully
- [ ] Verify devices reconnect and work

### 3.8 App Restart Tests

- [ ] Restart Homey app
- [ ] Verify clean shutdown (`stop()` called)
- [ ] Verify subscription is unsubscribed
- [ ] Verify app starts cleanly
- [ ] Verify connection re-establishes
- [ ] Verify all devices work after restart

### 3.9 Memory Leak Tests

- [ ] Run app for 24 hours
- [ ] Monitor memory usage
- [ ] Check for RxJS subscription leaks
- [ ] Verify no growing memory footprint
- [ ] Check connection remains stable

### 3.10 Performance Tests

- [ ] Measure connection time (should be <5 seconds)
- [ ] Measure message processing latency (<500ms)
- [ ] Check polling doesn't cause UI lag
- [ ] Verify multiple device updates handled efficiently

---

## Phase 4: Documentation & Cleanup

### 4.1 Code Documentation

- [ ] Add JSDoc comments to new methods
- [ ] Document message transformation logic
- [ ] Update README if needed
- [ ] Add comments explaining sysApUuid discovery

### 4.2 Commit Changes

- [ ] Review all changes with `git diff`
- [ ] Stage changes: `git add package.json package-lock.json lib/freeAtHomeApi.ts`
- [ ] Commit with message:
  ```
  feat: Migrate from freeathome-api to freeathome-local-api-client

  - Replace GitHub fork with official npm package
  - Switch from callback to RxJS Observable pattern
  - Add sysApUuid discovery on connection
  - Update all API calls to new library signatures
  - Maintain backward compatibility with existing devices

  Tested with: switches, dimmers, blinds, heating
  ```

### 4.3 Create Pull Request (if applicable)

- [ ] Push branch to remote
- [ ] Create PR with description
- [ ] Link to this planning document
- [ ] Request review if needed

---

## Phase 5: Deployment & Monitoring

### 5.1 Deployment

- [ ] Deploy to test environment (if applicable)
- [ ] Monitor logs for 2-4 hours
- [ ] Verify no unexpected errors
- [ ] Test all device types in test environment

### 5.2 Production Deployment

- [ ] Deploy to production
- [ ] Monitor logs closely for first hour
- [ ] Check all devices are functioning
- [ ] Verify no user reports of issues

### 5.3 Post-Deployment Monitoring

- [ ] Monitor for 24 hours
- [ ] Check connection stability
- [ ] Verify no memory leaks
- [ ] Monitor error logs
- [ ] Collect user feedback

---

## Rollback Plan

If critical issues arise:

- [ ] Stop Homey app
- [ ] Checkout previous version: `git checkout <previous-commit-hash>`
- [ ] Run: `npm install`
- [ ] Run: `npm run build`
- [ ] Restart Homey app
- [ ] Verify old version works
- [ ] Investigate issues in feature branch

---

## Reference: API Mappings

| Old API | New API | Notes |
|---------|---------|-------|
| `new SystemAccessPoint(config, subscriber, null)` | `new SystemAccessPoint(hostname, username, password, tlsEnabled, verboseErrors, logger)` | Constructor signature changed |
| `connect()` | `connectWebSocket(certificateVerification)` | New is void, uses events |
| `disconnect()` | `disconnectWebSocket(force)` | Similar but different signature |
| `getDeviceData()` | `getConfiguration()` then extract devices | Different method, needs mapping |
| `setDatapoint(device, channel, dp, value)` | `setDatapoint(sysApUuid, device, channel, dp, value)` | Requires sysApUuid |
| `broadcastMessage(msg)` callback | `getWebSocketMessages()` Observable | Pattern change |
| `BroadcastMessage.result[serial]` | `WebSocketMessage[sysApUuid].devices[serial]` | Structure needs transformation |

---

## Reference: Message Transformation

### Old Structure (BroadcastMessage)
```json
{
  "type": "update",
  "result": {
    "ABB7F50023C7": {
      "channels": {
        "ch0000": { ... }
      }
    }
  }
}
```

### New Structure (WebSocketMessage)
```json
{
  "00000000-0000-0000-0000-000000000000": {
    "devices": {
      "ABB7F50023C7": {
        "channels": {
          "ch0000": { ... }
        }
      }
    },
    "datapoints": { ... },
    "devicesAdded": [],
    "devicesRemoved": []
  }
}
```

### Transformation
Extract `wsMessage[sysApUuid].devices` → `BroadcastMessage.result`

---

## Notes & Observations

*Use this section to track any issues, gotchas, or learnings during migration:*

-
-
-

---

## Completion Checklist

- [ ] All implementation tasks completed
- [ ] All tests passing
- [ ] No regression issues
- [ ] Documentation updated
- [ ] Changes committed
- [ ] Deployed to production
- [ ] Monitored for 24+ hours
- [ ] Migration successful!

---

**Estimated Total Effort:** 2-3 days
**Risk Level:** Medium (well-isolated changes, comprehensive plan)
**Rollback Capability:** High (clean git history, old version works)
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Homey app that integrates Busch Jaeger's Free@Home system with the Homey smart home platform. It's a hobby project (not official) that enables control of Free@Home devices (switches, dimmers, blinds, heating) through Homey.

The app connects to a Busch Jaeger SysAp (System Access Point) using the `freeathome-api` library, which provides an abstraction over the XMPP protocol used by Free@Home devices.

## Build System

The project uses TypeScript in `lib/**/*.ts` files that are compiled via Webpack into a `dist/` directory for deployment to Homey.

### Common Commands

**Development:**
- `npm run build` - Build in development mode (default)
- `npm run build:dev` - Build in development mode with source maps
- `npm run build:pro` - Build in production mode
- `npm run homey:run` - Build and run app on Homey (development)
- `npm run homey:install` - Build and install app on Homey (production)
- `npm run lint` - Run ESLint to check code style

**Testing:**
There are no tests currently configured.

**Deployment:**
The build process:
1. Webpack compiles TypeScript (`lib/**/*.ts`) to JavaScript in `dist/`
2. `prepare.sh` copies assets, drivers, locales, and other files to `dist/`
3. The `dist/` directory is deployed to Homey using `homey app run` or `homey app install`

## Architecture

### Core Components

**App Layer (`app.js`):**
- `FreeAtHome` extends `Homey.App` - Main application entry point
- Manages singleton `FreeAtHomeApi` instance that all devices share
- Handles app lifecycle (init, unload, settings changes)
- Provides flow card triggers for API connection status (`busch_jaeger_connected`, `busch_jaeger_disconnected`)
- Settings stored in Homey.ManagerSettings include SysAp credentials (host, username, password)

**API Layer (`lib/freeAtHomeApi.ts`):**
- `FreeAtHomeApi` extends `Homey.SimpleClass` - Singleton that manages connection to SysAp
- Connects to SysAp via `freeathome-api` library using XMPP protocol
- Implements `Subscriber` interface to receive real-time broadcast messages
- Maintains a registry of watched devices (`Map<uniqueId, DeviceRegistrationRequest>`)
- Handles connection lifecycle: connect, disconnect, restart with exponential backoff
- Implements polling mechanism (5 min intervals) as fallback for real-time updates
- Routes updates to registered devices via callbacks (`onPoll`, `onUpdate`, `onError`)
- Uses queuing system for updates and registrations to prevent race conditions

**Driver Layer (`lib/freeAtHomeDriver.ts`):**
- `FreeAtHomeDriver` extends `Homey.Driver` - Base class for device discovery
- Implements pairing flow to discover devices by `functionId` from SysAp
- Each driver type (switch, dimmer, blind, heating) extends this base
- Device pairing flow: `list_devices` → `list_icons` → `freeathome`

**Device Layer (`lib/freeAtHomeDeviceBase.ts`):**
- `FreeAtHomeDeviceBase` extends `Homey.Device` - Base class for all device implementations
- Each physical Free@Home device channel is represented as a separate Homey device
- Device identity: `serialNumber-channel` (e.g., "ABB700D12345-ch0000")
- Implements state pattern via `FreeAtHomeDeviceCondition`: STARTING → LOADING → ACTIVE or ERROR
- Registers with `FreeAtHomeApi` on init to receive updates
- Translates Homey capability changes to SysAp datapoint updates
- Concrete implementations in `drivers/*/device.js`: SwitchDevice, DimmerDevice, BlindDevice, HeatingDevice

### Device State Management

**Device Conditions (State Pattern):**
Located in `lib/deviceConditions/`, implements a state machine for device lifecycle:
- `StartingCondition` - Initial state, attempts registration with FreeAtHomeApi
- `LoadingCondition` - Waiting for initial state from SysAp
- `ActiveCondition` - Normal operation, processing updates
- `ErrorCondition` - Error state, retries registration

Each condition implements `FreeAtHomeDeviceConditionBehaviour` with:
- `enterState()` - Called when transitioning into this state
- `onPoll()`, `onUpdate()`, `onError()` - Handle events from FreeAtHomeApi

**Update Flow:**
1. SysAp sends broadcast message → `FreeAtHomeApi.broadcastMessage()`
2. API processes message and routes to registered devices
3. Device receives `onUpdate()` or `onPoll()` callback with device state
4. Device condition handler updates Homey capabilities via `setCapabilityValue()`

**Command Flow:**
1. User triggers capability change in Homey → `onCapability*()` in device
2. Device calls `handleCapability()` which translates capability to datapoint
3. `FreeAtHomeApi.setDeviceState(deviceId, channel, datapoint, value)`
4. API sends command to SysAp
5. SysAp broadcasts update → device receives confirmation via update flow

### Key Patterns

**Singleton API:** All devices share a single `FreeAtHomeApi` instance accessed via `Homey.app.getFreeAtHomeApi()`. This ensures one connection to SysAp regardless of device count.

**Device Registration:** Devices register callbacks (`onPoll`, `onUpdate`, `onError`) with the API. The API maintains a map of `uniqueId → DeviceRegistrationRequest` and routes updates accordingly.

**Dual Update Mechanism:**
- Real-time: WebSocket-based broadcast messages from SysAp (primary)
- Polling: Full state sync every 5 minutes (fallback/reconciliation)

**Capability Mapping:** `lib/util.ts` maps Homey capabilities to Free@Home datapoint IDs (e.g., `onoff` → `idp0000`)

**Error Handling:** When API disconnects, all registered devices receive `onError()` callback and transition to ERROR state. API attempts automatic reconnection with backoff.

## Important Implementation Details

**Free@Home Device IDs:**
- Physical devices have `serialNumber` (e.g., "ABB700D12345")
- Each device has multiple channels (e.g., "ch0000", "ch0001")
- Channels have `functionId` that determines device type (0x1010 = switch, etc.)
- Homey devices are identified by `serialNumber-channel` combination

**Driver Types:**
- `switch` - functionId determines capability (on/off only)
- `dimmer` - functionId determines capability (dim + on/off)
- `blind` - windowcoverings_state + windowcoverings_set
- `heating` - freeathome_heating (custom capability)

**Settings:**
- App-level: SysAp credentials in Homey.ManagerSettings
- Device-level: `debug_log` and `info_log` for per-device logging

**Logging:** Custom logger (`captureLogs.js`) captures logs for viewing in app settings page. Devices can enable debug/info logging per-device.

## Development Notes

When working with device implementations, remember:
- TypeScript source is in `lib/`, JavaScript driver implementations in `drivers/*/`
- Device implementations extend `FreeAtHomeDeviceBase` and must implement: `onFreeAtHomeInit()`, `onPollCallback()`, `onUpdateCallback()`, `onErrorCallback()`
- Always call `setCapabilitySafely()` instead of `setCapabilityValue()` for proper error handling
- Device state comes from `deviceState.channels[channel].datapoints[datapointId].value`
- Datapoint IDs are documented in Free@Home API (e.g., odp0000 = output, idp0000 = input)
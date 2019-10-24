This app adds support for connection Homey to a Busch Jaeger Free@Home System.

What works:
* Connecting with system access point by providing the right credentials (see below)
* Device discovery, installation and usage of some switch actors

## Supported switch actors (for now):
- Some "Sensor/ Schaltaktor 2/2-fach" are supported (deviceId's: 1010)
- Some "Sensor/ Schaltaktor 1/1-fach" are supported (deviceId's: 1017, 100C, 2039)
- Some "Sensor/ Schaltaktor 2/1-fach" are supported (deviceId's: 1019)
    

## Connecting with your system access point
It is advised to create a new user specifically for Homey. This can be done within the system access points.

1. Go to [sysap.local](sysap.local) or figure out the local IP of the access point
1. Log in a configuation/installer account  
1. After login, select 'Settings' on the bottom right, and select the _User Management_ entry
1. Create a new user, with 'user' rights only; Homey doesn't need to configure your home

Now, setup the Busch Jaeger Free@Home app in homey with the newly created user, from the app's settings page.

(!) Be aware that you need to supply the IP of the access point, since Homey cannot resolve .local DNS

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Bush Jeager Free@Home

Adds support for Busch Jaeger's Free@home system and its connected devices to Homey

## Scope of POC 

### Rationale

I found a [github repo from sstadlberger](https://github.com/sstadlberger/home) (now superseded
by [this repository from henry-spanka](https://github.com/henry-spanka/freeathome-api)) that exposed a 
HTTP REST and WS interface to access the access point of a Free@Home system. The XMPP protocol
that is exposed by Busch Jaeger isn't (well) documented and my knowledge of XMPP ain't present.

Having a REST API now  got me the idea, that integrating Busch Jaeger with Homey would be doable.

### Setup

- Run a docker container `freeathome-api` from  [Dockerhub](https://hub.docker.com/r/zzave/freeathome-api/tags)
```bash
$ docker run -d -p 8000:8080 -p 8001:8081 \
    -e FREEATHOME_HOSTNAME=bj.example.com \
    -e FREEATHOME_USERNAME=freeathome \
    -e FREEATHOME_PASSWORD=mypassword \
    zzave/freeathome-api:$IMAGE_ID
```
- Make sure you update `API_URL` found in the codebase to point to wherever your `freeathome-api` is running
- Install Free@Home app from cloned repo
```bash
$ athom app run
```

Final result should look like this:

![Connections](./landscape.png)


### Scope
Currently, this app supports a device discovery for a limited set of actuators:

- All "Sensor/ Schaltaktor 2/2-fach" are supported
- All "Sensor/ Schaltaktor 1/1-fach" are supported
- All "Sensor/ Schaltaktor 2/1-fach" are supported
    
with the capability of turning the actor 'on' and 'off'.

For each device the name will be used as it is configured in the SysAp.



## Future plans
I have quite a list of things that I want to do (not necessarily in order):

- Internalize the freeathome-api to eliminate the need for an 'external' dependency
- Add support for dimmers, blinds, temperature sensors, and, if possible scenes.

- Make use of Typescript interface to have a little more insight in the classes and methods inside 'homey',
without having to leave the IDE. It also results in less trial and error.
- Add linting and autoformatting because I can
- Publish to the app store

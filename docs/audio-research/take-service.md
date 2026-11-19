# Local Space take service

The filesystem service binds to loopback. The catalog advertises a 30-second passage and 24 throws. Either endpoint can fall anywhere within the pinned MX029 revision. The service and editor validate both caps. A saved take can still play if a later editor supports fewer frames or throws, or encounters an unfamiliar Space recipe version. Its stable manifest carries validated stereo PCM references and indicates whether the current policy permits a variation.

## Run and check

Use Node 24 from the repository's .nvmrc. Give the server an explicitly prepared source directory and a separate, persistent store.

```sh
ROOM_TAKE_SOURCE_DIR=.cache/take-source ROOM_TAKE_STORE_DIR=.cache/local-takes PORT=4173 node scripts/serve.mjs
node scripts/check-take-service.mjs http://127.0.0.1:4173
node scripts/check-take-service.mjs http://127.0.0.1:4173 --write
node scripts/check-take-service.mjs http://127.0.0.1:4173 --id SAVED_ID
```

The first check reads the catalog. The explicit write requires a literal loopback origin and creates one permanent example in that store. It compares the prepared and published digests, retries publication with the same request ID and checks both independently fetched PCM assets. After restarting the server with the same directories, repeat the read by ID. The offline fixture and concurrent writer/restart tests run with `node --test test/take-store.test.mjs test/take-publish.test.mjs`.

## Measured limits

On November 19, 2026, Node 24.22.3 prepared the dense 15-minute MX029 passage at each duration. Each table row used a fresh Node process and empty temporary filesystem store, followed by one repeated preparation in the same process. The measurements include source reads, digest checks, DSP, durable writes and verification. Cold refers to the service process; the OS file cache could be warm. Run `node scripts/benchmark-take-service.mjs .cache/take-source` to repeat. Only the benchmark allows a 60-second preparation.

| Seconds | Throws | First prepare (ms) | Repeat (ms) | Peak process RSS (MiB) | Stereo PCM pair (bytes) |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 1 | 123 | 84 | 82 | 3,072,000 |
| 8 | 24 | 501 | 449 | 108 | 3,072,000 |
| 30 | 1 | 205 | 181 | 116 | 11,520,000 |
| 30 | 24 | 1,696 | 1,578 | 145 | 11,520,000 |
| 60 | 1 | 304 | 273 | 150 | 23,040,000 |
| 60 | 24 | 2,925 | 2,847 | 182 | 23,040,000 |

The stress recipe places all 24 sends within the first 240 ms using maximum delay, feedback, wet level and stereo width. This keeps their feedback tails active together. The 30-second cap kept a single cold preparation below two seconds here and the pair below 12 MB. The same 30-second recipe ran through the bundled worklet in a 48 kHz stereo OfflineAudioContext on desktop-host mobile profiles. Pixel 7 Chromium took 1,845 ms and iPhone 13 WebKit took 1,113 ms. Both produced 1,440,000 frames and a peak difference of 0.12107 full scale from the common-gain original. Physical-device real-time deadlines, hardware memory pressure, network delivery and listening quality need separate measurement.

Every request body is limited to 64 KiB on the JSON write routes. Each handler admits four active requests and up to 60 POST attempts per rolling minute. Reads do not consume write quota. A busy handler returns HTTP 429. Rendering is synchronous in the local Node process, so a dense prepare can delay reads. The measured RSS is for one preparation. A host serving simultaneous sessions needs its own worker isolation, load measurements and aggregate admission policy.

## Retention and the backend handoff

Local preparations expire after 24 hours. A new publication request receives HTTP 410 after expiry, including after cleanup has removed the private manifest. The maker retains the edited recipe and must prepare and audition it again before publishing. A previously bound request can finish after expiry or a subsequent reduction in write limits. Retries of a committed request return its original ID. Published manifests, PCM, source revisions and request bindings persist independently of the static release.

```sh
node scripts/reclaim-take-staging.mjs .cache/local-takes
```

Stop the service processes using that store before running cleanup. New local stores use a shared SQLite file lock for each service lifetime. Cleanup needs the exclusive lock, and a service starting during cleanup must retry. An exiting or killed process releases its lock through the OS. This is a local-filesystem maintenance protocol.

Cleanup removes expired unbound preparation manifests, unreferenced staged PCM and partial staging writes. It keeps active manifests and every durable publication binding, including an interrupted publication whose preparation expired. It can remove a staged copy still in use when the immutable permanent object verifies against the same digest. The response reports expired manifests and staged bytes removed. Published manifests, permanent PCM, request bindings and source files sit outside its deletion scope.

The service can still open older stores created before this lock protocol. The maintenance command refuses them because an older process could write without holding the lock. Before adopting an empty directory ever shared with an older service, stop every older service using it and keep it off that directory. An idle legacy writer may have opened the empty directory without creating files. To migrate an existing populated store, take the old service offline, initialize a fresh managed directory with this release, stop the new service, then copy the old data collections into it before switching the configured store path. The existing preview store remains in place.

Before enabling hosted anonymous writes, the existing backend owner must supply the deployment environment and durable store, a storage budget and a retention schedule coordinated with live publication on that backend. Route the API independently of static releases, enforce aggregate quotas, constrain CORS and verify independent cross-device reads and retries across service restarts and two static releases. If the host uses expiring asset URLs, verify that reopening the stable take link obtains fresh references after expiry. The loopback service uses same-origin binary GETs.

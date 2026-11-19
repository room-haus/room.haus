# Listening to a shared MX029 echo take

The local preview contains two eight-second performances of MX029 by Saad Ashraf. Each version has a saved Original and Take. Press Play take, then switch between Original and Take while the passage plays. Open the variation in its own tab to compare the placement of the echo.

| Passage in the mix | First performance | Variation |
|---|---|---|
| Curated, around 35 minutes | [Play first performance](http://127.0.0.1:4391/takes/?id=001812c4ca2955766a961b5aa168102a) | [Play variation](http://127.0.0.1:4391/takes/?id=21e1432c05ceb53781fb46a125c87b64) |
| Dense, around 15 minutes | [Play first performance](http://127.0.0.1:4391/takes/?id=bb2b4d49c37bb390a3440ca6e91329eb) | [Play variation](http://127.0.0.1:4391/takes/?id=03b5707856c53e2957bda76bb4043faa) |

**Listening prompt.** For each passage, which hit changes when you switch from Original to Take? What happens to the next hit as the echo fades? Give the approximate time within the eight seconds, your listening device and your own words before reading the measurements below. Two listeners should respond independently.

Choose **Make a variation** to move the throw. Set its start, click **Move**, then **Prepare take**. Play the prepared take and choose **Publish take** to get a new link. The first performance keeps its own link. The existing delay/reverb experiment is available from Labs → Space & echoes → Open continuous delay and reverb study.

## Run the local preview

From the implementation checkout with Node 24, dependencies installed, the prepared source and the existing preview store, run:

```sh
PORT=4391 ROOM_TAKE_SOURCE_DIR=.cache/take-source \
  ROOM_TAKE_STORE_DIR=.cache/handoff-local-store node scripts/serve.mjs
```

Open [the local Labs maker](http://127.0.0.1:4391/labs/#audio-experiments) or one of the saved links above. The server binds to loopback. These links resolve on the preview Mac. A fresh checkout also needs `npm ci`, `node scripts/prepare-take-source.mjs` and `npm run build`. The four existing IDs require this Mac’s retained store. A new store generates its own IDs.

## Source and passage checks

The full 369-segment playlist was decoded continuously with FFmpeg 9.0.2 to 177,025,220 interleaved stereo frames at 48 kHz, signed little-endian PCM16. Playlist SHA-256 is `f1a2b3878263afb5eb24b18975bb1da4f6048b9fb8563c76514ef111b608b933`. The independently decoded master hashes to the pinned source revision `805ed5a51801f065b7c171fa1e217008dc4d19c2adab1bd12b7c6f7119a502e5`. [Source lock](../../scripts/fixtures/mx029-take-source.json)

The curated HLS passage starts at 35:00.218 and selects canonical frames `[100800610,101184610)`. The dense HLS passage starts at 15:00.093 and selects `[43200261,43584261)`. The player displays canonical time, 35:00.013 and 15:00.005 respectively. These origins use AAC packet presentation timestamps relative to the first packet.

Each published boundary check covers 384,000 stereo frames. The expected Original comes from rounding each master sample at the fixed 0.5 dry gain. The test compares the whole Original digest and exact stereo samples, then hashes both decoded buffers actually scheduled by a cold public player. Frame 59,040,357 begins HLS segment 123, just beyond the PCM chunk boundary at 59,040,000.

| Selection in canonical frames, end exclusive | First Original (L, R) | Last Original (L, R) | Published Original SHA-256 |
|---|---|---|---|
| 0–384000 | 0, 0 | 387, −1019 | `fe6250ff8896a2b708a5baae2e0527f1456b343257fd59cb232a02e2efa69323` |
| 58944000–59328000 | −83, −1289 | −7194, −6534 | `ee8d49618a92995a0e9e85b807bbf54067c0d8625b9c56e6c4b396d7a2bb69f8` |
| 176641220–177025220 | −2162, −7632 | 0, 0 | `2186d7732752a656c8dd8b880f7904543072cf576da0a19b58a63e84ed485657` |

The consecutive Original frames straddling the HLS boundary are (−10293, −9872) and (−10326, −10360). A negative control moving the eight-second request by a single frame failed the expected digest check.

## Measurements on the saved listening pairs

The data below were measured from the published PCM on port 4391. Both outputs share a 0.5 dry gain. Each variation moves its parent’s throw by 500 ms. The delay is 202 ms, feedback 0.168, wet level 0.8 and stereo width 0. Peaks use full-scale units. Return RMS measures the difference between Take and Original over both channels and all eight seconds. Relative return energy is 10 log10 of summed squared difference divided by summed squared Original.

| Passage and version | Throw starts in passage | Original peak | Take peak | Return RMS | Return energy relative to Original |
|---|---:|---:|---:|---:|---:|
| Curated first performance | 1.312 s | 0.49792 | 0.49792 | 0.005485 | −23.80 dB |
| Curated variation | 1.812 s | 0.49792 | 0.49792 | 0.005953 | −23.09 dB |
| Dense first performance | 2.910 s | 0.50000 | 0.50000 | 0.003776 | −30.57 dB |
| Dense variation | 3.410 s | 0.50000 | 0.50000 | 0.004020 | −30.03 dB |

The original continuous study used the generated diagnostic loop and sustained sends for its calibration. Its half-level delay return/dry RMS was 0.13708 (−17.26 dB) and reverb was 0.13130 (−17.64 dB). The table above measures short throws on music. [Continuous Space calibration](space-and-echoes.md)

## Local verification, November 19, 2026

The maker and shared player ran on an Apple silicon Mac with macOS 26.6.2, Node 24.16.0 and Playwright 1.65.1. All four saved listening links above opened with empty storage, played and switched Original/Take in desktop Chromium 159.0.8154.6 and emulated iPhone 13 WebKit 27.2. A desktop Chromium maker prepared and auditioned a take. A fresh mobile WebKit context opened the forwarded link, switched Original/Take on the running clock, moved a throw, auditioned the child and published it. Fresh sessions reopened both versions. Their scheduled stereo buffers matched the respective audition digests, and their manifests retained the original passage and lineage. A lost publication reply recovered the same child ID on retry. Desktop Chromium and the Android Chromium profile also completed the round trip.

The three focused Labs specs passed 63 checks across desktop Chromium, Pixel 7 emulation and iPhone 13 WebKit emulation. At 390 × 844 the paper-colored maker shows the waveform, Play passage, Record and Echo together. The tests cover keyboard recording/editing, pointer drag, the mobile comparison controls and switching to the existing continuous study with the draft intact. All 30 continuous-study checks passed here, including the previously reported WebKit launcher/control cases. The underlying live worklet matched prepared impulse output at 48 kHz within half a PCM16 unit. At 44.1 kHz measured onset differences stayed below 0.15 ms and return-energy differences below 0.3 dB. The public fixture additionally checks that the first changed frame moved from 57,696 to 81,696 after the 500 ms edit.

The repository gates passed dependency policy, lint, both typechecks and all 188 Node tests. Webpack built both entries and generated 89 public pages. The built HTTP server passed 101 route and 97 asset checks. The final public suite passed 190 tests, with nine real-source cases and two touch-profile hover cases skipped. The separate real-source run passed all 24 applicable cases, including the nine skipped boundary cases, and skipped three fixture-only tail measurements. The isolated fixture handoff run passed all 18 applicable cases.

For the public and Labs suites, Playwright starts its own built HTTP server. Use an empty store and a separate port to preserve the four preview links. To repeat the full real-source handoff and boundary checks from the built checkout:

```sh
ROOM_TAKE_SOURCE_DIR=.cache/take-source ROOM_TAKE_STORE_DIR="$(mktemp -d)" \
  ROOM_TEST_ORIGIN=http://127.0.0.1:4426 \
  npm run test:browser:public -- e2e/take-handoff.spec.cjs --workers=1
```

## Acceptance still pending

- **Hosting.** Public deployment and cross-device Internet handoff await the existing backend handoff. The local store supports this preview.
- **Physical mobile Safari.** Run the cold play, Original/Take toggle, edit, audition, publish and reopen flow from a reachable secure origin on a real iPhone. Record iOS/Safari version and output device. Only simulators were available on this Mac.
- **Listening.** Two independent listeners still need to identify the changed hit and describe the following hit on both passages. Record their words and devices. If either cannot find the gesture without coaching, recalibrate and repeat. Space acceptance remains open.

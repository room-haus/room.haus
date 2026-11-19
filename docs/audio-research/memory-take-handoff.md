# Listening to a shared MX029 fragment

These local takes contain eight seconds of Saad Ashraf’s MX029, from 34:57 to 35:05. Both makers captured one second of stereo audio across the transient near 35:00. Press **Play take** and switch between **Original** and **Take**. The original performance brings back the full capture once. In the variation, the trigger starts at 5.5 seconds and plays shorter, overlapping grains.

| Maker → editor | Original performance | Variation |
| --- | --- | --- |
| Desktop Chromium → Mobile WebKit | [Play repeat](http://127.0.0.1:4391/takes/?id=500ad7cfac28217edb17b72262cf64d6) | [Play dissolve](http://127.0.0.1:4391/takes/?id=86f6fb2051a67a4b70a224d1723b182b) |
| Mobile WebKit → Desktop Chromium | [Play repeat](http://127.0.0.1:4391/takes/?id=1496dc11ad56cfa6424152504f0d77ac) | [Play dissolve](http://127.0.0.1:4391/takes/?id=1a04be76bf09be89d8a9ab5f05d17b09) |

The links resolve on the preview Mac using the retained local store. Mobile WebKit used Playwright’s iPhone 13 profile. A real phone on the network would resolve its own loopback address. To restart the preview from this worktree, retain both local directories.

```sh
PORT=4391 ROOM_TAKE_SOURCE_DIR=.cache/take-source \
  ROOM_TAKE_STORE_DIR=.cache/handoff-local-store node scripts/serve.mjs
```

## Captures and timing

The source revision is `805ed5a51801f065b7c171fa1e217008dc4d19c2adab1bd12b7c6f7119a502e5`. The verifier hashed all 708,100,880 bytes of the continuously decoded stereo master. The passage occupies absolute frames `[100656000, 101040000)`. Both captures cross the canonical chunk boundary at frame 100,800,000. Ranges exclude the end frame. Each capture contains 48,000 stereo frames of interleaved signed little-endian PCM16 at 48 kHz.

| Maker | Absolute capture frames | SHA-256 of the captured samples |
| --- | --- | --- |
| Desktop Chromium | `[100772288, 100820288)` | `cd4bffd1c15119c6d5e094c7b1223ef44506ecd95b8fa3628d9086abeced6ca3` |
| Mobile WebKit | `[100775168, 100823168)` | `67cb5cf17143403a3c20fb8b093e70fce1113b96d6c8f98104e0baf581a62a12` |

The trigger and wet onset below use passage-relative frames. Wet onset is the first frame where the corresponding Take channel differs from Original after quantization. Each performance has one two-second trigger at density 4 and level 0.8. The renderer delays the first voice by 1,200 frames and fades it in. Left and right can first differ from Original on different frames.

| Maker | Trigger, parent → child | Trigger delta | Parent wet onset L / R | Child wet onset L / R | Peak added sample L / R, parent → child |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop Chromium | 166,144 → 264,000 | +97,856 (2.039 s) | 167345 / 167345 | 265201 / 265201 | 5590 / 6330 → 2843 / 3750 |
| Mobile WebKit | 167,936 → 264,000 | +96,064 (2.001 s) | 169138 / 169138 | 265207 / 265209 | 5590 / 6330 → 3564 / 3753 |

All four Original renders have SHA-256 `54a0712d4b7f6cd6177d748aae907e793b298ac8f25651e59622cf93e5d349b2`. The browser reconstructed the scheduled stereo buffers as PCM16 and matched these Take hashes.

| Maker | Parent Take SHA-256 | Child Take SHA-256 |
| --- | --- | --- |
| Desktop Chromium | `d2f14ce6cf21aeeb28bf2910733f7938d8f400d4634e6f89db267285cfc4b500` | `99dd6b5fdb6cc01f9325732ddd6cc89695eaa7c8fedab3e32e09ab923855c89c` |
| Mobile WebKit | `251a7a110a38d68c5c47c7a6e3ef5ea1e0801278a7124a432530f2f5c7e67b64` | `80205af852ee934c13f4a3bf53dff66899681ceb2db76c39dac5fb5b09c904ad` |

## Verification

The maker used the Labs sign-in, selected the passage, recorded, captured, triggered, stopped and auditioned the preparation. The test copied the actual 192,000-byte input to Web Crypto when the maker hashed the capture. Every byte matched the parent’s downloaded fragment. The creator then closed. A second engine opened the link with empty storage, compared Original and Take, moved the trigger, selected Dissolve and published. Losing the response after the write and retrying recovered the same child ID.

The standalone verifier reads the public manifests and downloads each render and capture without editor state. It compares each fragment to the exact stereo slice of the offline master and all 384,000 frames of Original to the master at the common 0.5 gain. It subtracts Original from Take on both channels and bounds the timestamps of every nonzero result. For each parent it checks all 48,000 frames of the first repeat against the captured waveform and its linear fade. For each child it checks the first 6,000 frames of the first Hann-windowed grain before the next grain starts. The first-voice calculation allows one PCM16 unit for float rounding. Raw fragment comparisons require byte equality.

Run the read-only check on either pair from the worktree containing the continuously decoded master. The output includes both IDs, capture digest, trigger delta, wet onset and final wet frame for each channel.

```sh
node scripts/check-fragment-handoff.mjs \
  'http://127.0.0.1:4391/takes/?id=500ad7cfac28217edb17b72262cf64d6' \
  'http://127.0.0.1:4391/takes/?id=86f6fb2051a67a4b70a224d1723b182b'
node scripts/check-fragment-handoff.mjs \
  'http://127.0.0.1:4391/takes/?id=1496dc11ad56cfa6424152504f0d77ac' \
  'http://127.0.0.1:4391/takes/?id=1a04be76bf09be89d8a9ab5f05d17b09'
```

The public browser test also ran against an offline fixture with independently generated, asymmetric stereo transients and a pinned one-second period hash. Desktop Chromium, Android Chromium and mobile WebKit each passed as maker and final listener. On both real-source journeys, fresh listeners reopened the unchanged parent and forwarded child. The tests inspected the audio buffers scheduled at the same time on one clock and confirmed that the selected buffer’s gain reached one and the other’s reached zero at the destination.

After restarting the local service with the same store, both desktop Chromium and mobile WebKit reopened all four real-source links with empty storage and no creator. All eight cold openings passed the scheduled-buffer and gain checks. Both standalone pair reports matched their pre-restart values. The eight previously shared Space takes retained their original dry and performed PCM hashes. Two local negative controls shifted the capture coordinates by one frame and changed a single right-channel sample in the first dissolve grain with an updated render digest. Each failed the corresponding independent sample check.

## Listening and device evidence

The waveform, capture identity, timing, browser routing and restart checks used local software. Physical mobile Safari, a hosted preview, and human listening remain untested. No listener has yet identified the captured sound or described the difference in timing and treatment by ear. For a listening pass, compare the two Take versions to Original and describe the sound that returns, when it returns, and what changes during the two-second gesture.

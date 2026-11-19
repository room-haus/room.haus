# Shareable takes in the ROOM audio playground

Design for review · 19 November 2026

## The listening test

A maker hears a snare, holds Echo, and sends a link. A second person opens it on their phone, hears which snare changed, moves the throw to the following hit and sends back a variation. Each link keeps playing the version its maker shared. In the second experiment, moving a gesture must bring the exact piece of captured audio with it.

## Agreed scope

- Anyone with a link, including a forwarded link, can listen, compare, edit a copy and share it without signing in. A take opens directly on a listener-facing route outside the Labs login.
- MX029 is the pilot mix. Start with a curated excerpt ready to play. Makers can choose and share a passage from anywhere in MX029, from the opening frame through the end of the mix. The chosen start and end govern preview, shared playback and comparison alike.
- Each take uses one experiment. The maker performs gestures by ear, then can add, move or remove them on a timeline. A variation starts with the original passage and gestures.
- Deliver Space & echoes end to end first. Use Memory & fragments to test captured material second. The remaining four experiments, multiple simultaneous experiments and live collaboration are later work.

## The Space handoff

1. **Choose a passage.** Show the mix, selected range and a playable waveform. A single Play action auditions the curated excerpt. The same range editor previews a custom selection. Mark the out point visibly and cut playback there, including any remaining tail. Never silently expand the selection.
2. **Perform.** Put Record and the Echo pad beside the transport. A press feeds that interval of the dry signal into the delay. On release, new input to the delay stops and existing repeats decay inside the passage. The dry recording keeps playing. Make the pad operable by touch or keyboard. End a held gesture on release, cancellation, focus loss or passage end. Discard an interrupted recording pass if its timing cannot be trusted and retain earlier edits.
3. **Edit and audition.** Draw each throw at its time relative to the passage. Moving it keeps its duration and sound settings. Offer keyboard-accessible add, move and remove actions with time readouts. Replay from a selected point with the right earlier echo history. Let the maker compare Original and Take on one playhead. Show recording, audible return, and tail decay distinctly. Put the first playable gesture within reach on a phone.
4. **Share.** The maker auditions the prepared version before sharing. Return a link only after an independent reader can retrieve the complete take. Retain the editable draft on failure. Retrying the same publication should recover the same result.
5. **Vary.** A recipient presses Play take. Hear original switches the sound at the current position. Make a variation opens an editable copy. Sharing that copy creates a new immutable take with a reference to its parent. The parent's link still plays the original performance. The same flow works from a forwarded link.

## What travels with the link

**Design recommendation.** Publish a durable reference to three things together: the dry passage, the audio of the performed take, and the editable performance. Play the saved audio for listeners. A device can reproduce the reference without running the original effect or seeking into a different edition of an HLS mix. “Exact” means the same published audio content, timing and boundaries on each device. Device speakers and playback volume are outside this guarantee.

Use one versioned source and coordinate system for the two audio files. Record source identity and revision, source start and end frames, sample rate, channel layout and passage length. Align dry and performed audio to the same frame count and respect codec padding if encoded. Use one playback clock and a short click-free switch. Apply common output gain so a bypassed dry signal is consistent between versions. Keep intentional musical dynamics and test perceptual balance separately.

The editable record contains the experiment and rendering version, initial settings, stable gesture IDs, passage-relative start/end frames, effective gesture settings and any material dependencies. Store the tempo-derived delay as an effective interval when applicable. Render and edit from the same selected source revision. Compare the prepared render to the performance the maker heard, including press/release timing and tails. Share the version the maker previewed. An untouched copy must reproduce that version before an edit is made.

For Memory, retain the exact stereo samples of each referenced fragment, with format, length and content digest. Retain the playback treatment, density, level and any seed or realized event schedule needed to recreate it. Capturing opts material into a draft. Sharing publishes the fragments that the take uses. Moving a playback gesture changes its trigger time and preserves the captured samples. Removing a gesture from a variation leaves the parent's fragment intact. Bypass switches what the listener hears without discarding a fragment. Preserve bounded, cancellable runtime buffers for transient capture.

## Approaches considered

| Approach | What the maker can do | Decision |
| --- | --- | --- |
| Perform by ear, then edit | Catch a musical moment immediately and refine it precisely afterward | Selected. It addresses the weak first-play experience and supports the handoff. |
| Place gestures first | Place an event precisely before hearing it | Direct placement is available in the timeline as a secondary action. |
| Link to settings and timestamps alone | Recreate a performance on a compatible device | Insufficient for reliable cross-device reference playback or an exact Memory fragment. |
| Share an audio bounce alone | Hear the exact performance on another device | Useful for listening. Variation also needs dry audio and an editable gesture record. |

## Existing implementation and proposed boundaries

In a 390 × 844 Chromium viewport in the existing Space experiment, Effect level began around y=935 and the Delay/Reverb choices around y=1005. Choosing Reverb while listening to Original remained inaudible until a separate Processed action. The [Space calibration notes](../../audio-research/space-and-echoes.md) document an earlier return-level adjustment. Use the same viewport and a sparse/dense pair of real passages when checking the new interaction.

[ResearchHost](../../../src/experiences/shared/audio/research/ResearchHost.tsx) creates a session per modal. [ResearchAudio](../../../src/experiences/shared/audio/research/ResearchAudio.ts) ties Original to teardown. Keep explicit stop and cleanup for live processing. Give take comparison an independent monitor switch. Reuse the [Space processor](../../../src/experiences/audio-space/processor.ts) and [Memory fragment logic](../../../src/experiences/audio-memory/fragment.ts) where their behavior matches the saved performance. Space currently processes continuous input. A throw needs control of the send into the delay so release can leave a tail.

The existing Labs UI uses a tab-local gate and the site publishes a static build. Anonymous publishing requires durable storage and a service that validates a take and issues its link. Shareable sources must be explicitly identified and available as versioned, processable audio on supported editing devices. Derive public audio from those sources and supported gesture records. Keep the source identity, draft and error visible when editing or saving fails. Handle partially stored assets and duplicate requests before exposing the link. An unavailable take should open an explicit unavailable state.

For the pilot, mark the entire selected MX029 source revision as shareable in the ROOM catalog. Store its curated range independently of the eligible source bounds. Use the same versioned source for excerpts that cross HLS segment boundaries. Store shared assets independently of either browser session. Derive both audio references and fragment assets from validated, in-range source material so the anonymous publishing endpoint accepts only performances over the eligible catalog.

**Proposed pilot defaults.** Use the echo throw as the first Space gesture. Store settings at press time. A second recording pass adds gestures to the draft. Use a single active send and reject overlapping throws visibly during placement or editing. Confine a variation to its inherited passage. Keep captured Memory material within the shareable range during this pilot. The builder can choose waveform rendering, storage provider, encoder, render location and route syntax after demonstrating that preview and published playback agree. Set and document measured duration, gesture-count and publish limits before opening anonymous writes.

**Entry points proposed for review.** Start a new performance inside the existing Labs playground. Open a received link directly in a public player with the full variation editor a single action away. That public route must support publishing a child without a Labs session. A public gallery or separate blank-take landing page can be considered later.

**Curated opening passage.** Start the Space listening pilot at 35:00.218–35:08.218 in MX029, an eight-second range pinned in the [measurement fixtures](../../../scripts/fixtures/audio-processing-passages.json). It has more quiet windows than the measured passage at 15:00, making it a promising place to hear a throw decay. Confirm that choice by ear in the two-listener test. Keep 15:00.093–15:08.093 as the denser comparison. Published takes retain their chosen range if the curated default changes.

## Acceptance before expanding

| Check | Evidence |
| --- | --- |
| Cold, forwarded handoff | A fresh browser on a second device can open, play, compare, change and publish from a forwarded link with no prior Labs session. The two links resolve independently after closing both browsers. |
| Full-mix selection | Open the curated excerpt, then create takes at the start of MX029, across a segment boundary outside the curated excerpt, and ending on the final frame. Reopen each link on a second device and check the saved in/out points and both audio references against the selected source frames. |
| Exact range and gesture | Test with known impulses at and around the boundaries. Dry and performed files start and end at the selected frames. A throw on hit three moves to hit four in the child. Prior repeats are audible when seeking into a tail. A/B switching keeps position. |
| Musical usefulness | Two listeners try a sparse and a dense real-mix passage independently. Each identifies what changed, on which hit, and whether repeats obscure the next hit. Compare the dry gain, peak and return energy alongside those judgments. Revise defaults if either listener needs coaching to find or hear the throw. |
| Record-first UX | On phone and keyboard, go from the curated excerpt to a recorded throw, then add, move and remove gestures. Cancel a press, replay and recover from a failed publish without losing earlier edits. |
| Memory identity | Capture a distinctive transient once. Open a forwarded link on a second device, switch Original/Take, move the trigger, change treatment and share. Verify the decoded lossless fragment samples against the saved digest in parent and child. Audition both to confirm that the recognizable material survives. |
| Editing on another device | Exercise desktop Chromium and mobile Safari with production-like shareable audio, including the native HLS case where the existing Labs graph can be dry-only. Both must complete the variation flow. Generated loop tests alone cannot establish this. |

These are proposed acceptance checks. Implementation, hosted cross-device playback and listening sign-off are pending.

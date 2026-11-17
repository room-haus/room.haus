# Persistent listening

The user wants music to continue when leaving an experience, with pause/resume and close controls outside it. Entering another experience replaces the mix. The user explicitly selected “Switch and keep playing” when music is already playing.

Use one retained listening session independent of the visible route. Retain the existing HLS audio implementation and lazy player loading. Unmount the expensive 3D scene when leaving its experience, while retaining the audio instance and position. Re-entering the same experience reattaches its visual presentation without restarting audio. Entering a different mix or release replaces the previous session; carry playing/loading intent forward and preserve paused state. First entry with no session retains the existing explicit Play behavior.

Outside an experience, show a compact bottom bar with artwork, record/track identity, a link back to its experience, pause/resume (or loading/error/retry state), and an accessible close control. Closing disposes audio and dismisses the bar, preserving saved progress. A never-started idle recording need not leave a bar. The bar must work on the archive, splash, season, and Collective, including keyboard and touch. Render outside the inert/sliding route panels and reserve enough space to avoid covering actionable page content.

Keep ROOM typography, restrained dark controls, and existing focus/motion conventions. Minimum control target is 44px. Honor safe-area insets and reduced motion. No persistence across a full browser reload, cross-tab synchronization, new packages, or background-playback guarantees outside the browser session.

Approaches considered: retaining the entire scene hidden would waste GPU/media resources; duplicating an audio player for the mini bar risks overlapping streams. The selected implementation direction is a single retained audio owner with separate full and compact presentations. This is an implementation choice based on the user's requested behavior.

Scope: implement and validate in a separate branch/local preview. The earlier authorization to merge and deploy portraits remains a separate task.

The user additionally requested a scrubber in the persistent bar using the existing experience waveform structure. Reuse the current live PlaybackScope waveform and accessible range semantics with the retained audio owner. Provide pointer, touch, and keyboard seeking, with elapsed/total time, disabled unknown-duration seeking, and reduced-motion behavior. Preserve room controls and compact responsive layout; reserve the expanded bar footprint.

# Video editing for Breakers

Videos for **Breaking School** and **Breaking Biology**, made in code: every frame drawn by a script and every sound
placed on its frame, so a video can be re-made, edited or re-voiced by changing data instead of re-editing a timeline.

| Folder | Video | Style | Length |
|---|---|---|---|
| [`bangla-vo/`](bangla-vo/) | **বন্দি সবুজ দানা — The Green Prisoner** (Breaking Biology): Schimper, 1883, and the bacterium that became the chloroplast | Chalkboard (chalk writes itself on a classroom board, in Bangla) | ~59 s, 16:9 |

Each folder holds the finished video, its poster, subtitles, the treatment (story, shots, sound plan), CREDITS, and the
source with a one-command `build.sh`.

Built with the Lemo-Opuscar style library (https://github.com/lemomo-ai/lemo-opuscar, MIT code) on headless Chrome,
Node and ffmpeg.

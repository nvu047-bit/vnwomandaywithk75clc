# STELLAR — Art Direction Notes

## Visual thesis
**A deep-space observatory where mathematics becomes matter.** Midnight `#11121e` anchors a restrained palette of dusty lavender, mauve, periwinkle, rose quartz, muted teal and rare champagne accents. Negative space is deliberate: separate nebula wisps, star layers, orbital bodies and the personal message must remain readable rather than being swallowed by a uniformly bright particle field.

## Motion grammar
1. **Drift:** distant stars move subtly, mid-field dust twinkles, and nearer particles slide past on different time scales.
2. **Morphic identity:** the waiting screen's GPU point cloud reshapes HNUE → SMCS → K75CLC through the vertex shader. The input remains a separate minimal DOM control; there is no large banner/card. The identity and halo render above galaxy/event particle layers, then yield the same cloud to the recipient's name during reveal.
3. **Meteor passes:** heads cross bounded lanes with tapered ribbon tails. Their endpoints refit when the viewport changes.
4. **Collapse:** recipient particles converge toward a luminous core while the camera performs a short GSAP dolly.
5. **Shock:** a localized burst, expanding rings and radial matter paths create a brief climax; the name and wish regions are protected.
6. **Return:** particles reform into the recipient's seed-stable Vietnamese name; the wish follows in an editorial serif/sans composition.
7. **Parallax:** pointer movement is eased into small targets instead of moving the camera directly. Touch-first input ignores raw pointer parallax and can opt into permission-aware device orientation.
8. **Living field:** four bounded GPU lanes cross, merge and separate; taps produce a localized impulse rather than a screen-filling blast.

## Recipient-specific worlds
- Nine fixed recipient IDs map to stable visual profiles, separate galaxy morphologies, individual palettes and art-direction parameters. Personal names and wishes remain in `src/data/recipients.js`; the new gateway and math-field work does not replace that data.
- Galaxy points, orbital dust, nebula flow and equation paths are sampled into reusable GPU buffers. Shader uniforms provide time, profile transition and interaction response; geometry/material creation is kept out of the frame loop.
- The visible name is formed from a high-resolution Vietnamese glyph mask; a visually hidden `h1` preserves assistive-technology access. The message remains in the DOM and has higher stacking priority than the WebGL canvases.
- Two shaded sphere bodies with selected rings drift through outer lanes. Their palettes follow the selected recipient. They are visual motifs, not physical simulations.
- Recipient reveal settings control the camera, burst, settling time and wish timing. `prefers-reduced-motion` shortens/tames the reveal and the usual event timeline.

## Gateway and layer policy
- WebGL canvases live below the UI. The transparent `#interface` is the UI stacking context; the recipient identity and wish have explicit child layers; the corner brand/logo has a separate hit target and becomes Back only when a wish is active.
- The entry surface has no card background, border, shadow, backdrop blur or oversized title treatment. A single underline anchors input; the rest of the scene remains open.
- The waiting screen must preserve the signature morph without reintroducing a large DOM banner. `ParticleCloud.js` owns seeded `aHNUE`, `aSMCS`, and `aK75` geometry attributes; the vertex shader morphs between them. Main particles/glow use high explicit render orders (12/11), above the galaxy's point layer (1.5), so the signature stays legible against the space field.
- Cosmic events have anticipation, peak and recovery phases. The normal GSAP choreography is authored to finish in roughly 3.125–3.5625 seconds, and runtime telemetry emits each timeline's actual duration. This code-level envelope is not a measured FPS/browser QA result.

## Light / color policy
- ACES filmic output with `EffectComposer → RenderPass → UnrealBloomPass → OutputPass`. Bloom is thresholded and strength-scaled by device quality rather than placed on every object uniformly.
- The nebula is a low-resolution 3D noise/fBM volume with domain warping; additional flow strands are separate GPU points. Mobile/degraded quality lowers ray steps, octaves and render-target resolution.
- Additive emission is reserved for selected dust, ribbons, inner galaxy light and shockwaves. Editorial type uses a narrower, darker support gradient instead of bloom.

## GPU / lifecycle policy
- Desktop and mobile particle budgets are bounded in the renderer. Device pixel ratio is capped, resize work is coalesced, render ticks pause while the document is hidden, and reduced-motion preferences are honored.
- A cosmic-event replacement first kills the prior timeline and shockwaves. Shockwave timelines remove their references on completion, and Back/reset kills the post-reveal camera/core/attractor tweens as well as the main timeline.
- Geometry, materials, post-processing passes and the WebGL renderer are disposed on teardown. Adaptive quality changes only after consecutive low/high FPS windows; no universal 60 FPS claim is made.

## Technical references
- [Three.js BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html) and [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): GPU attributes, geometry disposal and draw-call reduction.
- [Three.js UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html): thresholded, multi-resolution bloom and its resource lifecycle.
- [GSAP Timeline](https://gsap.com/docs/v3/GSAP/Timeline/) and [Eases](https://gsap.com/docs/v3/Eases/): sequenced motion and explicit choreography.
- [OGL](https://github.com/oframe/ogl), [regl](https://github.com/regl-project/regl) and [React Three Fiber](https://github.com/pmndrs/react-three-fiber): alternative WebGL/scene abstractions reviewed as architecture comparisons; STELLAR does not add any of them as a second rendering stack.

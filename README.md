# STELLAR — Mathematical Universe / Motion Art

Một tác phẩm WebGL tối giản cho 9 nữ sinh K75 CLC · Sư phạm Toán · HNUE.

**Stack:** Three.js r186 · GLSL `ShaderMaterial` · GSAP 3.15 · Vite · ES6 Modules.

## Chạy dự án

Yêu cầu Node.js 20.19+ (khuyến nghị Node 22):

```bash
npm ci
npm test
npm run test:contract
npm run test:math
npm run dev
```

Mở địa chỉ Vite in trong terminal (mặc định `http://localhost:4173`). Tạo bản phát hành:

```bash
npm run build
npm run preview
```

Không cần API key hay backend. Google Fonts là tùy chọn, có font dự phòng cục bộ.

## Âm thanh

`src/audio/AudioManager.js` quản lý nhạc nền và các hiệu ứng âm thanh mà không cần thư viện bổ sung. Track “Melodic Piano Theme” của Dejan S. được phát lặp xuyên suốt, chỉ bắt đầu sau tương tác đầu tiên để tuân thủ autoplay policy. Bộ điều khiển nhỏ ở góc dưới cho phép mute và thay đổi âm lượng nhạc; tab ẩn được fade-out/tạm dừng và tiếp tục từ vị trí hiện tại khi quay lại. Hiệu ứng SFX bị giới hạn hai voice đồng thời và không phát trong mỗi frame render. Từ mã ứng dụng có thể gọi `window.STELLAR.audio.playSfx('shimmer')`; nguồn và license ghi tại [`public/audio/ATTRIBUTION.md`](./public/audio/ATTRIBUTION.md).

## Deploy lên GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` chạy kiểm thử, build production và deploy riêng thư mục `dist/` mỗi khi push lên `main`. Để bật lần đầu, vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**. Sau đó push commit lên `main` hoặc chạy workflow **Deploy to GitHub Pages** từ tab **Actions**. Không chọn `main / (root)` làm nguồn Pages: đó là mã nguồn chưa bundle, trình duyệt không thể tự resolve các package như `gsap` và `three`.

Vite dùng đường dẫn asset tương đối (`base: './'`), tương thích với project Pages ở dạng `https://<owner>.github.io/<repository>/`.

## Art direction / render pipeline

- **Muted Cosmic Palette:** the shared palette uses midnight `#11121e`, dusty lavender, mauve, periwinkle, rose quartz, muted teal, and champagne. Each recipient retains an individual pastel mix across the nebula, galaxy, comet ribbons, and particle name.
- **ACES + Post-processing:** the renderer uses ACES filmic tone mapping and `EffectComposer` runs `RenderPass → UnrealBloomPass → OutputPass`. Bloom is tuned more gently on touch-first devices; adaptive quality reduces composer pixel ratio, ray steps and FBM octaves when frame rate remains low.
- **Procedural Nebula:** a low-resolution 3D volume raymarch uses 3D Simplex noise + multi-octave fBM, time-driven domain warping, three separate cloud lobes, faint filaments and rare warm highlights. An additional GPU point-flow layer forms crossing, merging nebula streams that respond to pointer or touch input while leaving a clear mask around the name.
- **Nine Personal Galaxies:** `src/data/galaxyProfiles.js` gives every unchanged recipient ID a different structural profile: twin spiral, ribbon, stellar bloom, crystal spiral, asymmetric drift, harmonic rings, botanical branches, tilted orbital layers, or deepfield clouds. `GalaxyArchitecture.js` samples deterministic core, arm, nebula, cluster, halo, filament and depth populations into one GPU point system; the name-keyed seed keeps each world reproducible. The Canvas 2D fallback uses the same profile mapping, deterministic seed and defining curve with a smaller particle budget.
- **Galaxy Transitions and Motion:** each new profile morphs from the previous particle positions instead of swapping colors or rotating a shared model. Its own arm count, curve equation, thickness, asymmetry, depth, spin, flow and centrifugal response shape the persistent motion. The GPU shader dims dust through the central name-safe region while keeping the pearl/champagne core, broad arms and outer halo visible around it.
- **Timed Cosmic Events:** after the wish reveal finishes, `CosmicEventDirector.js` schedules a profile-aware event every ten visible seconds. The first event is a layered Stellar Supernova, with GPU matter ejecta, three expanding shock rings and radial filaments; meteor storm, equation bloom, centrifugal rift, stardust rebirth, galactic heartbeat, cosmic lens and a progressive constellation follow in a rotating sequence. One reusable GPU point layer plus one reusable line-segment layer compose with existing shockwaves, galaxy, nebula-flow and comet pulses. Meteor trails refit to the live viewport, and event origins use the title/wish bounds; GPU particles/lines attenuate over those protected reading regions. The scheduler pauses its remaining delay while the tab is hidden, resumes without catch-up, and stops on recipient change, close or teardown. Reduced-motion mode keeps the event cadence and main visual idea while compressing travel and amplitude. Canvas 2D fallback supplies matching lightweight event motifs.
- **Morphic Gateway:** the waiting screen stays open, with no glass card or oversized DOM affiliation banner; the student-code input is the only central control. Behind it, the existing GPU point cloud continuously morphs **HNUE → SMCS → K75CLC** using three seeded glyph buffers and the current vertex shader. The main points (`renderOrder = 12`) and their glow (`11`) are drawn above the galaxy/event dust so the signature is not buried under the background. On recipient reveal, the same reusable point cloud reforms into that student's Vietnamese name; the affiliation effect returns after Back.
- **Portal Supernova:** while the student-code portal is open, a separate low-frequency scheduler stages a protected Stellar Supernova after an initial pause and repeats it at a calm interval. It stops as soon as a recipient opens and resumes only after returning to the portal. Starting a new cosmic event cancels the prior event and its shockwave timelines; completed wave timelines remove their own references. Runtime `stellar:cosmic-event` events expose the actual GSAP timeline duration for measurement. The expected normal-motion envelope is about 3.125–3.5625 seconds from the authored timeline, but it is not reported as browser-measured in this environment.
- **Constellation Name:** the Vietnamese name is sampled from a high-resolution Nunito Sans glyph mask with extra weight on the letter contours. Size, grain, and a sparse champagne anchor-star layer are tuned for the viewport and DPR; independent drift and a traveling nova keep the silhouette legible instead of blooming into a white slab. A visually-hidden `h1` preserves assistive-technology access.
- **Mathematical Stardust:** each galaxy's defining equation is sampled directly into its arm/filament particle populations: lemniscate, trochoid, polar rose, superformula, logarithmic spiral, Lissajous, phyllotaxis, epicycle, or butterfly curve. These moving dust paths share the galaxy's depth, pulse, palette and profile transition instead of appearing as the same detached graph for every recipient.
- **Personal Wish:** the open greeting contains only the personalized wish, composed as a soft serif lead and readable Manrope continuation. Equations, recipient numbers and concept labels are not shown.
- **Depth Bodies:** small, shaded spheres and selected rings move along the frame edges from distant to near perspective, behind the particle name.
- **Pointer Parallax:** desktop mouse coordinates feed eased targets with a small amplitude; raw pointer events never move the camera directly. Touch-first devices ignore pointer parallax and may opt into a small, permission-aware DeviceOrientation offset from a user gesture.
- **Additive emission:** stars, layered galaxy particles, comet ribbon trails and shockwaves retain additive blending. Three starfield depth tiers and the galaxy's seven particle populations share packed `BufferGeometry` draw calls to keep the space field efficient.
- **Meteor Ribbons:** meteor heads cross in varied diagonal and transverse passes at staggered depths. Their positions are evaluated from bounded time-based trajectories, ribbon samples follow the same path behind the head, and normalized endpoints are refit when the viewport changes.
- **Reveal:** personalized reveal profiles control wish timing, editorial alignment, camera, burst and settling; `prefers-reduced-motion` switches to a short, non-bouncy reveal.
- **Stellar Bomb:** charge → collapse → shockwave/burst → spiral reform → living particle name and wish. Reduced-motion settings shorten the title nova and slow the scene clock.
- **Adaptive:** DPR is capped by device class; the nebula render target and composer are scaled separately; resize events are coalesced by `requestAnimationFrame`; the scene removes its GSAP ticker while hidden and respects reduced-motion preference. Scene disposal releases geometry/material/texture/render-target resources, kills owned tweens, and explicitly releases the WebGL context. If WebGL startup fails or the context is lost, the main entry switches to a low-power Canvas 2D fallback (30 FPS mobile / 36 FPS desktop) that stops its RAF while hidden.

## Module map

```text
index.html
src/
  main.js
  style.css
  data/recipients.js
  data/artDirections.js
  data/galaxyProfiles.js
  ui/interface.js
  graphics/
    shaders.js
    MathematicalSamples.js
    ParticleCloud.js
    GalaxyArchitecture.js
    NebulaFlow.js
    CosmicBodies.js
    SpaceField.js
    CometField.js
    StrangeAttractor.js
    StellarScene.js
    MathRain.js
    FallbackScene.js
    index.js
 tests/smoke.mjs
 tests/contract.mjs
 tests/math-forms.mjs
 package.json
 vite.config.js
```

## Cá nhân hóa

Mỗi sinh viên mở bằng mã chính xác hoặc slug, ví dụ `#/tran-thi-kieu-cham`. Dữ liệu người nhận và lời chúc gốc ở `src/data/recipients.js`. Kiểm tra các route bằng `npm test`.

## Thiên hà chung — Constellation of Her Universes

Ở màn hình nhập mã, chọn **KHÁM PHÁ THIÊN HÀ CHUNG** để mở chín thiên hà cá nhân trong cùng một không gian. Trên điện thoại, khung nhìn ban đầu tập trung vào một thiên hà; vuốt ngang/dọc để lướt qua không gian rộng hơn, rồi chạm thiên hà để mở vũ trụ tương ứng. Khi quay từ một vũ trụ cá nhân về thiên hà chung, chính thiên hà vừa xem sẽ được đưa vào giữa khung hình. Các thiên hà được bố trí gần nhau hơn và nối bằng cầu vật chất sáng, rõ hơn. Một lời nhắc mờ “Vuốt nhẹ để khám phá những thiên hà khác” hiện trong khoảng ba giây khi vừa vào. Máy tính vẫn hiển thị toàn cảnh. Cảnh chung chỉ hiển thị tên các bạn nữ; tiêu đề và lời chúc dạng chữ đã được loại bỏ. Sao chổi vẫn đi qua theo quỹ đạo cong, để lại đuôi nhiều lớp và kích hoạt ánh sáng/sóng phản ứng khi lướt gần một thiên hà; nút mũi tên ở góc trên trái quay lại màn hình nhập mã.

`src/graphics/SharedGalaxy.js` mở một cảnh WebGL thống nhất (`src/graphics/shared/`): một `WebGLRenderer`, một vòng `requestAnimationFrame`, một đồng hồ chung. Chín thiên hà được sinh bằng chính `generateGalaxyPoints()` và vertex shader GPU của vũ trụ cá nhân (`GalaxyArchitecture.js`), cùng bảng màu, `GALAXY_PROFILES` và art direction; mỗi thiên hà dao động nhẹ quanh vị trí riêng trong khi các tâm, nhãn và vùng chọn luôn đi cùng nhau. Tên mỗi bạn được đặt giữa ba lớp sương tinh vân màu riêng có parallax chậm, bụi sao và các lớp chữ sáng/tối lệch nhẹ để tạo cảm giác nằm sâu trong không gian, vẫn giữ nét rõ sau bloom. Các dòng vật chất cong liên thiên hà, màn bụi che khuất, lớp sao nền/tiền cảnh (`SpaceField.js`), lớp bụi chuyển động trong vùng trống, hai sao chổi nền tuần hoàn, sao chổi sự kiện và 12 loại cosmic event có hoạt ảnh riêng (armWave, cascade, starburst, dustStream, nebulaBloom, comet, convergence, aurora, pulsar, supernova, tidalWave, binaryResonance) đều chạy theo thời gian. Những màn cực quang, sao xung, siêu tân tinh, sóng thủy triều và cộng hưởng đôi mới luân phiên với các sự kiện hiện có; scheduler giữ khoảng nghỉ ngẫu nhiên ngắn 0.7–2.1 giây giữa cao trào để bầu trời luôn sống động mà không chồng nhiều hiệu ứng sáng mạnh. Màn hình này chỉ hiển thị tên chín bạn nữ (sprite trong cùng renderer). `src/data/sharedWishes.js` vẫn là dữ liệu nội bộ, không in thành chữ. Nếu không tạo được WebGL, `SharedGalaxy2D.js` cung cấp bụi, sao chổi nền, tám kiểu sự kiện canvas và chuyển động dịu tương ứng. Render loop của scene nền được tạm dừng khi cảnh này hoạt động. URL `#/galaxy` mở trực tiếp cảnh này.

Các test mới: `npm run test:shared` (contract/data) và `npm run test:shared-runtime` (Canvas lifecycle/hit testing). Các ảnh và dữ liệu do kiểm thử trực quan sinh ra trong `verification/` không được lưu trong Git.

## Tham khảo kỹ thuật

- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) và [Color Management](https://threejs.org/manual/en/color-management.html): ACES/tone mapping, color space và xử lý vật liệu.
- [Stellarium Web Engine](https://github.com/Stellarium/stellarium-web-engine): kiến trúc WebGL theo các lớp sao và dữ liệu bầu trời; STELLAR không tích hợp dữ liệu thiên văn hoặc sao Gaia.
- [N0rvel/galaxy_sim](https://github.com/N0rvel/galaxy_sim): tham khảo cách tổ chức particle mô phỏng trên GPU; [Three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples): tham khảo `BufferGeometry` và shader. Các hiệu ứng mới dùng mã và dữ liệu riêng của STELLAR, không sao chép mã nguồn bên ngoài.
- [Lusion — ION](https://exp-ion.lusion.co/): tham khảo art direction về trải nghiệm real-time WebGL nhất quán giữa chuyển động, ánh sáng và UI; không sao chép tài sản hay mã nguồn.
- [GSAP Timeline](https://gsap.com/docs/v3/GSAP/Timeline/) và [eases](https://gsap.com/docs/v3/Eases/): điều phối các pha animation có nhịp điệu.

## Kiểm thử và giới hạn

`npm test` xác thực đủ 9 mã/tên/slug và art direction, lời chúc khác nhau, palette muted riêng, DOM typography layering, font hạt sao, NebulaFlow, các import nội bộ, ACES, 3 lớp star LOD, particle typography và shader ribbon. Các file nguồn có thể chạy `node --check`.

Build production và shader compile trên GPU vật lý chỉ được xem là đạt sau khi cài dependency và kiểm thử trên trình duyệt/thiết bị thật; không suy diễn FPS hoặc pin từ kiểm thử tĩnh.


## Nebula Refinement Update

The volume keeps spatially separated wisps and deliberate negative space, with muted pastel cores and moving crossover filaments. `NebulaFlow.js` adds four bounded GPU streams; recipient flow direction, palette, and title bounds stay synchronized on viewport changes. Particle names use a heavy Vietnamese glyph mask, contour/core sampling, and a sparse halo; pointer/touch taps trigger a localized ripple. The particle budget is 6,500 on mobile and 15,000 on desktop. Sparse contour-biased pearl grains, rare champagne anchors, and a localized equation resonance keep the glyph readable without a broad white halo.

## Mathematical constellation update

The particle-text study informed the use of glyph-mask sampling rather than an overlaid title texture. The galaxy studies informed depth-layered GPU particles and procedural motion; the equation-animation study informed path-parameter and tangent-driven movement. STELLAR's implementation remains native to its existing `ShaderMaterial` pipeline and does not copy demo assets or add dependencies.

- [Particle Text 3D](https://github.com/sebastianvasquezechavarria1234/particle-text-3d) — glyph-to-particle construction and per-particle interaction.
- [Three.js Galaxy](https://github.com/ggwzrd/threejs-galaxy) — instanced depth layers and shader-driven orbital distribution.
- [ThreeJS Particle Animations Demo](https://github.com/qbb84/ThreeJS-Particle-Animations-Demo) — equation-parameterized particle motion.
- [Three.js Galaxy Shader](https://github.com/AmitDigga/threejs-galaxy-shader) — procedural shader color and spatial variation.

## Galaxy and orbital motion update

The former loose accretion scatter is sampled along three logarithmic spiral arms, with a pearl/champagne inner concentration, differential rotation, small arm breathing and depth scatter. Its GPU point scale is fitted as one ellipse to both portrait and landscape viewports, keeping the galaxy behind (rather than in place of) the Vietnamese particle glyphs.

Pointer/touch taps and the recipient reveal now share a timed centrifugal impulse across the galaxy, three star tiers, glyph cloud, nebula streams, equation dust and meteor paths. Each shader/layer uses the same event time and center but a different radial response; reduced-motion mode lowers the event strength. Selecting a new recipient preserves the previous particle mask and eases its points into the next name during the reformation phase.

Meteor paths are analytic in normalized viewport coordinates, so their head and trail use the same smooth flight curve without frame-by-frame velocity integration or modulo jumps on-screen. Resize refits each path at its own depth. The two orbiting bodies now use continuous sinusoidal depth rather than a sawtooth reset. Existing visibility pausing, clamped scene delta, adaptive resolution and reduced-motion scaling remain in place.


## Giai đoạn 4 — Polish, Optimization & Fallback

- `FallbackScene.js` uses a low-cost Canvas 2D star field and a small number of comet trails. It caps DPR (1 on touch-first devices), throttles its animation loop, stops it while the document is hidden, and removes resize/orientation/visibility listeners on disposal. If Canvas 2D is also unavailable, CSS gradients still provide a branded fallback and the HTML greeting card remains usable.
- `main.js` switches to fallback when WebGL creation throws or the context is lost. It cleans up the scene, fallback renderer, equation-rain animation, and UI listeners on full page exit or Vite hot replacement. Font readiness no longer blocks the app startup.
- `StellarScene.js` coalesces window/orientation/visual viewport resize events into one RAF. Camera aspect, renderer resolution, nebula render target, bloom/composer size and particle pixel-ratio uniforms are synchronized. Constructor failures run partial cleanup, and dispose is idempotent.
- `style.css` adds tablet/mobile/small-screen/landscape layouts, safe-area spacing, touch scrolling for the wish card and a CSS-only fallback backdrop.
- `vite.config.js` separates Three.js and GSAP vendor chunks, minifies JavaScript/CSS, avoids source maps by default, inlines only very small assets and emits `.gz` siblings for text assets when gzip makes a material size reduction. A production web server must be configured to negotiate and serve pre-compressed assets (for example, Nginx `gzip_static`); original assets remain available for hosts without that feature.

### Stage 4 verification

`npm test` and `npm run build` pass. Browser checks verified the settled recipient view at portrait and landscape sizes, particle-title accessibility, metadata-free greeting, and no console or page errors. A physical-device GPU/FPS measurement and forced Canvas 2D fallback run were not performed.

import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [manager, html, main, ui, readme, attribution] = await Promise.all([
  read('../src/audio/AudioManager.js'),
  read('../index.html'),
  read('../src/main.js'),
  read('../src/ui/interface.js'),
  read('../README.md'),
  read('../public/audio/ATTRIBUTION.md')
]);

assert.match(manager, /bgmUrl = '\.\/audio\/bgm-melodic-piano-theme\.mp3'/, 'BGM uses the bundled piano track');
assert.match(manager, /this\.bgm\.loop = true/, 'the BGM loops natively');
assert.match(manager, /document\.addEventListener\('pointerdown', this\.onFirstGesture/, 'autoplay waits for a user pointer gesture');
assert.match(manager, /document\.addEventListener\('keydown', this\.onFirstGesture/, 'keyboard interaction can unlock BGM');
assert.match(manager, /this\.fadeTo\(target, this\.bgm\.currentTime < 0\.1 \? 1500 : 500, \(\) => \{/, 'BGM fades in once and resumes without restarting');
assert.match(manager, /this\.document\.addEventListener\('visibilitychange', this\.onVisibilityChange\)/, 'background tabs fade and pause audio');
assert.match(manager, /setBgmVolume\(volume\)[\s\S]*Math\.min\(0\.3, volume\)/, 'BGM volume is adjustable and capped');
assert.match(manager, /toggleMute\(\)[\s\S]*this\.muted = !this\.muted/, 'mute state is managed by the audio manager');
assert.match(manager, /MAX_SFX_VOICES = 2/, 'SFX playback has bounded polyphony');
assert.match(manager, /pointerover[\s\S]*playSfx\('hover'\)/, 'hover controls trigger a light UI sound');
assert.match(manager, /onClick\(event\)[\s\S]*playSfx\(control\.id === 'brandBackButton' \? 'back' : 'tap'\)/, 'click and back controls use distinct sounds');
assert.match(manager, /dispose\(\)[\s\S]*removeEventListener\('pointerover'/, 'delegated listeners are cleaned up on teardown');
assert.match(html, /id="audioMuteButton"[\s\S]*id="audioVolume"/, 'mute and BGM volume controls are present');
assert.match(manager, /#audioMuteButton[\s\S]*#audioVolume/, 'audio controls are wired to the manager');
assert.match(main, /audio\.playSfx\('stardust'\)/, 'the scene burst hook triggers the particle SFX');
assert.match(ui, /eventCallback\('onStart', \(\) => window\.STELLAR\?\.audio\?\.playSfx\('shimmer'\)\)/, 'GSAP reveal start triggers a synchronized shimmer');
assert.match(ui, /showSharedGalaxy[\s\S]*playSfx\('shimmer'\)/, 'shared-galaxy reveal is accompanied by a shimmer');
assert.match(readme, /Melodic Piano Theme/, 'the actual music track is documented');
assert.match(attribution, /Creative Commons Attribution 4\.0 International/, 'the music license is attributed');
assert.match(attribution, /CC0 1\.0/, 'the SFX license is attributed');
const assetSizes = await Promise.all([
  '../public/audio/bgm-melodic-piano-theme.mp3',
  '../public/audio/sfx/glass_001.ogg',
  '../public/audio/sfx/click_001.ogg',
  '../public/audio/sfx/confirmation_001.ogg',
  '../public/audio/sfx/forceField_000.ogg',
  '../public/audio/sfx/back_001.ogg'
].map(path => stat(new URL(path, import.meta.url)).then(file => file.size)));
assert.ok(assetSizes[0] > 1_000_000, 'the bundled BGM is a real, complete audio track');
assert.ok(assetSizes.slice(1).every(size => size > 1000), 'all referenced SFX files are present');

console.log('Audio manager contract tests passed.');

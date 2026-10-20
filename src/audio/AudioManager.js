const DEFAULT_SOUNDS = {
  hover: './audio/sfx/glass_001.ogg',
  tap: './audio/sfx/click_001.ogg',
  shimmer: './audio/sfx/confirmation_001.ogg',
  stardust: './audio/sfx/forceField_000.ogg',
  back: './audio/sfx/back_001.ogg'
};

const UI_CONTROL_SELECTOR = 'button, a, [role="button"]';
const MAX_SFX_VOICES = 2;
const SFX_COOLDOWN_MS = 180;

export class AudioManager {
  constructor({
    bgmUrl = './audio/bgm-melodic-piano-theme.mp3',
    sounds = DEFAULT_SOUNDS,
    documentRef = document,
    AudioClass = Audio
  } = {}) {
    this.document = documentRef;
    this.AudioClass = AudioClass;
    this.sounds = sounds;
    this.bgm = new this.AudioClass(bgmUrl);
    this.bgm.loop = true;
    this.bgm.preload = 'metadata';
    this.bgm.volume = 0;
    this.bgmVolume = 0.2;
    this.sfxVolume = 0.38;
    this.muted = false;
    this.playRequested = false;
    this.unlocked = false;
    this.disposed = false;
    this.fadeFrame = 0;
    this.fadeTimer = 0;
    this.fadeGeneration = 0;
    this.gestureArmed = true;
    this.playPromise = null;
    this.activeSfx = new Map();
    this.lastSfxAt = new Map();
    this.reportedSources = new Set();
    this.playButton = this.document.querySelector('#audioMuteButton');
    this.volumeSlider = this.document.querySelector('#audioVolume');
    this.status = this.document.querySelector('#audioStatus');
    this.onFirstGesture = this.onFirstGesture.bind(this);
    this.onPointerOver = this.onPointerOver.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.onBgmError = () => this.reportMissingSource(bgmUrl);
    this.onVolumeInput = () => this.setBgmVolume(Number(this.volumeSlider.value));
    this.onMuteClick = () => this.toggleMute();
    this.bgm.addEventListener('error', this.onBgmError);
    this.playButton?.addEventListener('click', this.onMuteClick);
    this.volumeSlider?.addEventListener('input', this.onVolumeInput);
    this.document.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });
    this.document.addEventListener('keydown', this.onFirstGesture, true);
    this.document.addEventListener('pointerover', this.onPointerOver);
    this.document.addEventListener('click', this.onClick);
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.updateControls();
  }

  onFirstGesture(event) {
    this.unlock();
    if (event.target?.closest?.('#audioMuteButton')) return;
    this.requestPlayback();
  }

  onPointerOver(event) {
    const control = event.target?.closest?.(UI_CONTROL_SELECTOR);
    if (!control || control === this.playButton || control === this.volumeSlider ||
      control.contains(event.relatedTarget)) return;
    this.playSfx('hover');
  }

  onClick(event) {
    const control = event.target?.closest?.(UI_CONTROL_SELECTOR);
    if (!control || control === this.playButton || control === this.volumeSlider) return;
    this.playSfx(control.id === 'brandBackButton' ? 'back' : 'tap');
  }

  unlock() {
    if (this.disposed) return;
    this.unlocked = true;
    if (this.gestureArmed) {
      this.document.removeEventListener('pointerdown', this.onFirstGesture, true);
      this.document.removeEventListener('keydown', this.onFirstGesture, true);
      this.gestureArmed = false;
    }
  }

  armGestureRetry() {
    if (this.gestureArmed || this.disposed) return;
    this.gestureArmed = true;
    this.document.addEventListener('pointerdown', this.onFirstGesture, { capture: true, passive: true });
    this.document.addEventListener('keydown', this.onFirstGesture, true);
  }

  requestPlayback() {
    if (this.disposed) return Promise.resolve();
    this.playRequested = true;
    this.syncBgm();
    return this.playPromise || Promise.resolve();
  }

  syncBgm() {
    if (this.disposed || !this.playRequested || this.document.hidden) return;
    if (this.playPromise) return;

    let resolvePlayback;
    this.playPromise = new Promise(resolve => {
      resolvePlayback = resolve;
    });
    const play = async () => {
      try {
        if (this.bgm.paused) await this.bgm.play();
        if (this.disposed) return;
        const audible = this.playRequested && !this.muted && !this.document.hidden;
        const target = audible ? this.bgmVolume : 0;
        this.fadeTo(target, this.bgm.currentTime < 0.1 ? 1500 : 500, () => {
          if (!audible) this.bgm.pause();
        });
        this.updateControls();
      } catch (error) {
        if (error?.name === 'NotAllowedError') {
          this.playRequested = false;
          this.armGestureRetry();
          console.warn('Background music playback was blocked by the browser autoplay policy.', error);
          this.updateControls('Chạm để bật nhạc nền');
        } else if (error?.name !== 'AbortError') {
          this.playRequested = false;
          console.error(`Background music playback failed: ${this.bgm.currentSrc || this.bgm.src}`, error);
          this.updateControls('Nhạc nền không thể phát');
        }
      } finally {
        this.playPromise = null;
        resolvePlayback();
      }
    };
    play();
  }

  onVisibilityChange() {
    if (this.document.hidden) {
      if (!this.bgm.paused) this.fadeTo(0, 280, () => this.bgm.pause());
      return;
    }
    this.syncBgm();
  }

  setBgmVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(0.3, volume));
    if (this.volumeSlider) this.volumeSlider.value = String(this.bgmVolume);
    if (this.playRequested && !this.muted && !this.document.hidden) {
      this.fadeTo(this.bgmVolume, 120);
    }
    this.updateControls();
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    for (const audio of this.activeSfx.keys()) audio.volume = this.sfxVolume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.fadeTo(0, 180, () => this.bgm.pause());
    } else {
      this.requestPlayback();
    }
    this.updateControls();
  }

  playSfx(name) {
    const source = this.sounds[name];
    if (!source || !this.unlocked || this.disposed || this.muted || this.sfxVolume === 0) return;
    const now = performance.now();
    if (now - (this.lastSfxAt.get(name) || -Infinity) < SFX_COOLDOWN_MS) return;
    this.lastSfxAt.set(name, now);

    while (this.activeSfx.size >= MAX_SFX_VOICES) {
      const [oldest] = this.activeSfx.keys();
      this.stopSfx(oldest);
    }

    const audio = new this.AudioClass(source);
    audio.preload = 'auto';
    audio.volume = this.sfxVolume;
    const cleanup = () => {
      this.activeSfx.delete(audio);
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', onError);
    };
    const onError = () => {
      this.reportMissingSource(source);
      cleanup();
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', onError, { once: true });
    this.activeSfx.set(audio, name);
    audio.play().catch(error => {
      cleanup();
      if (error?.name === 'NotAllowedError') {
        console.warn(`Sound effect playback was blocked by the browser autoplay policy: ${source}`, error);
      } else if (error?.name !== 'AbortError') {
        console.error(`Sound effect playback failed: ${source}`, error);
      }
    });
  }

  stopSfx(audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
    this.activeSfx.delete(audio);
  }

  fadeTo(target, duration, onComplete = () => {}) {
    this.fadeGeneration++;
    const generation = this.fadeGeneration;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    const start = this.bgm.volume;
    const startedAt = performance.now();
    const step = now => {
      if (generation !== this.fadeGeneration || this.disposed) return;
      const progress = duration <= 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      this.bgm.volume = start + (target - start) * eased;
      if (progress < 1) {
        if (this.document.hidden) {
          this.fadeFrame = 0;
          this.fadeTimer = setTimeout(() => {
            this.fadeTimer = 0;
            step(performance.now());
          }, 50);
        } else {
          this.fadeFrame = requestAnimationFrame(step);
        }
        return;
      }
      this.fadeFrame = 0;
      this.fadeTimer = 0;
      onComplete();
    };
    if (this.document.hidden) this.fadeTimer = setTimeout(() => {
      this.fadeTimer = 0;
      step(performance.now());
    }, 50);
    else this.fadeFrame = requestAnimationFrame(step);
  }

  reportMissingSource(source) {
    if (!source || this.reportedSources.has(source)) return;
    this.reportedSources.add(source);
    console.warn(`Audio asset could not be loaded: ${source}`);
  }

  updateControls(message = '') {
    if (this.playButton) {
      this.playButton.setAttribute('aria-pressed', String(this.muted));
      this.playButton.setAttribute('aria-label', this.muted ? 'Bật âm thanh' : 'Tắt âm thanh');
      this.playButton.title = this.muted ? 'Bật âm thanh' : 'Tắt âm thanh';
    }
    if (this.volumeSlider) {
      this.volumeSlider.setAttribute('aria-valuetext', `${Math.round(this.bgmVolume / 0.3 * 100)}% âm lượng nhạc nền`);
      this.volumeSlider.style.setProperty('--audio-level', `${this.bgmVolume / 0.3 * 100}%`);
    }
    if (this.status) {
      this.status.textContent = message || (this.muted
        ? 'Âm thanh đã tắt'
        : this.playRequested ? 'Nhạc nền đang phát' : 'Chạm để bắt đầu nhạc nền');
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.fadeGeneration++;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.document.removeEventListener('pointerdown', this.onFirstGesture, true);
    this.document.removeEventListener('keydown', this.onFirstGesture, true);
    this.document.removeEventListener('pointerover', this.onPointerOver);
    this.document.removeEventListener('click', this.onClick);
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.playButton?.removeEventListener('click', this.onMuteClick);
    this.volumeSlider?.removeEventListener('input', this.onVolumeInput);
    this.bgm.removeEventListener('error', this.onBgmError);
    this.bgm.pause();
    for (const audio of this.activeSfx.keys()) this.stopSfx(audio);
    this.activeSfx.clear();
  }
}

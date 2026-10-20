import { gsap } from 'gsap';
import { recipients, findRecipient } from '../data/recipients.js';
import { sharedWishes } from '../data/sharedWishes.js';
import { getRecipientArtDirection } from '../data/artDirections.js';
import { COSMIC_COLORS } from '../data/cosmicPalette.js';
import { CosmicEventDirector } from '../graphics/CosmicEventDirector.js';
import { SharedGalaxy } from '../graphics/SharedGalaxy.js';

function loadParticleFont() {
  if (!document.fonts?.load) {
    console.warn('Nunito Sans cannot be verified; particle names will use a system sans-serif fallback.');
    return Promise.resolve(false);
  }

  let timeoutId;
  const fontPromise = document.fonts.load('900 80px "Nunito Sans"', 'NGUYỄN THỊ KHÁNH LINH')
    .then(fonts => {
      const loaded = fonts.some(font => font.family.toLowerCase() === 'nunito sans');
      if (!loaded) console.warn('Nunito Sans is unavailable; particle names will use a system sans-serif fallback.');
      return loaded;
    })
    .catch(error => {
      console.warn('Nunito Sans could not be loaded; particle names will use a system sans-serif fallback:', error);
      return false;
    });
  const timeoutPromise = new Promise(resolve => {
    timeoutId = window.setTimeout(() => {
      console.warn('Nunito Sans loading timed out; particle names will use a system sans-serif fallback.');
      resolve(false);
    }, 1600);
  });

  return Promise.race([fontPromise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function sharedGalaxySeedFromLocation() {
  const raw = new URLSearchParams(location.search).get('sharedGalaxySeed');
  if (raw === null) return undefined;
  const seed = Number(raw);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    console.warn('Invalid sharedGalaxySeed; expected an unsigned 32-bit integer. Using a random event seed.');
    return undefined;
  }
  return seed;
}

export class StellarInterface {
  constructor({ scene, fallback, rain }) {
    this.scene = scene;
    this.fallback = fallback;
    this.rain = rain;
    this.activeRecipient = null;
    this.autoOpenTimer = 0;
    this.input = document.querySelector('#studentCode');
    this.portal = document.querySelector('#portal');
    this.identity = document.querySelector('#identity');
    this.reveal = document.querySelector('#reveal');
    this.status = document.querySelector('#portalStatus');
    this.counter = document.querySelector('#digitCount');
    this.name = document.querySelector('#recipientName');
    this.wish = document.querySelector('#recipientWish');
    this.sceneIndex = document.querySelector('#sceneIndex');
    this.form = document.querySelector('#portalForm');
    this.brandBackButton = document.querySelector('#brandBackButton');
    this.sharedGalaxyEntry = document.querySelector('#sharedGalaxyEntry');
    this.sharedGalaxyFromWish = document.querySelector('#sharedGalaxyFromWish');
    this.sharedGalaxyView = document.querySelector('#sharedGalaxyView');
    this.sharedGalaxyActive = false;
    this.returnToGalaxy = false;
    this.sharedGalaxy = this.sharedGalaxyView ? new SharedGalaxy({
      canvas: document.querySelector('#sharedGalaxyCanvas'),
      view: this.sharedGalaxyView,
      recipients,
      wishes: sharedWishes,
      seed: sharedGalaxySeedFromLocation(),
      onSelect: recipient => this.selectSharedRecipient(recipient)
    }) : null;
    this.destroyed = false;
    this.openGeneration = 0;

    // The waiting screen cycles through 8 distinct cosmic phenomena
    const IDLE_COSMIC_EVENTS = [
      'stellarSupernova',
      'stellarGenesis',
      'meteorPassage',
      'mathematicalUniverse',
      'centrifugalWave',
      'stardustCascade',
      'galacticRings',
      'cosmicLens'
    ];

    this.cosmicDirector = new CosmicEventDirector((event, detail) => {
      if (this.destroyed || !this.reveal.classList.contains('is-visible')) return;
      const recipient = this.activeRecipient;
      if (!recipient) return;
      if (this.scene?.playCosmicEvent) this.scene.playCosmicEvent(event, detail);
      else this.fallback?.playCosmicEvent?.(event, detail);
    });
    this.idleCosmicDirector = new CosmicEventDirector((event, detail) => {
      if (this.destroyed || this.activeRecipient || this.portal.classList.contains('is-hidden')) return;
      if (this.scene?.playCosmicEvent) this.scene.playCosmicEvent(event, { ...detail, idle: true });
      else this.fallback?.playCosmicEvent?.(event, { ...detail, idle: true });
    }, { interval: 11000, initialDelay: 18000, events: IDLE_COSMIC_EVENTS });
    this.particleFontReady = loadParticleFont();
    this.touchStart = () => this.scene?.enableDeviceParallax?.();
    this.submitHandler = event => this.onSubmit(event);
    this.inputHandler = () => this.onInput();
    this.focusHandler = () => this.onFocus();
    this.blurHandler = () => this.onBlur();
    this.keyDownHandler = (e) => this.onKeyDown(e);
    this.returnHandler = () => {
      if (this.sharedGalaxyActive) this.closeSharedGalaxy();
      else this.returnHome();
    };
    this.sharedGalaxyEntryHandler = () => this.showSharedGalaxy();
    this.sharedGalaxyFromWishHandler = () => this.returnHome({ showGalaxy: true });
    this.hashHandler = () => this.routeFromHash();
    this.bind();
    this.idleCosmicDirector.start();
  }

  buildKineticName(label) {
    this.name.textContent = label;
    this.name.setAttribute('aria-label', label);
  }

  bind() {
    // On phones, the first deliberate tap can grant motion-sensor permission
    // in browsers that require a user gesture (notably iOS Safari).
    if (matchMedia('(pointer: coarse)').matches) {
      this.input.addEventListener('pointerdown', this.touchStart, { passive: true, once: true });
    }
    this.form?.addEventListener('submit', this.submitHandler);
    this.input?.addEventListener('input', this.inputHandler);
    this.input?.addEventListener('focus', this.focusHandler);
    this.input?.addEventListener('blur', this.blurHandler);
    this.input?.addEventListener('keydown', this.keyDownHandler);
    this.brandBackButton?.addEventListener('click', this.returnHandler);
    this.sharedGalaxyEntry?.addEventListener('click', this.sharedGalaxyEntryHandler);
    this.sharedGalaxyFromWish?.addEventListener('click', this.sharedGalaxyFromWishHandler);
    window.addEventListener('hashchange', this.hashHandler);
  }

  onFocus() {
    this.portal?.classList.add('is-focused');
  }

  onBlur() {
    this.portal?.classList.remove('is-focused');
  }

  onKeyDown(e) {
    // Spawn subtle keystroke ripple wave
    if (e.key && e.key.length === 1) {
      this.spawnKeystrokeRipple();
    }
  }

  spawnKeystrokeRipple() {
    const wrapper = this.form?.querySelector('.input-keystroke-wave');
    if (!wrapper) return;
    const ripple = document.createElement('span');
    ripple.className = 'keystroke-pulse';
    wrapper.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  }

  onSubmit(event) {
    event.preventDefault();
    clearTimeout(this.autoOpenTimer);
    const recipient = findRecipient(this.input.value);
    if (recipient) {
      this.portal?.classList.add('is-surging');
      this.openRecipient(recipient);
    } else {
      this.triggerInvalidAnomaly();
      this.setStatus('NO ORBIT FOUND', 'error');
    }
  }

  triggerInvalidAnomaly() {
    this.portal?.classList.remove('is-anomaly');
    void this.portal?.offsetWidth; // re-trigger reflow
    this.portal?.classList.add('is-anomaly');
    setTimeout(() => {
      this.portal?.classList.remove('is-anomaly');
    }, 600);
  }

  onInput() {
    this.updateCounter();
    clearTimeout(this.autoOpenTimer);
    const value = this.input.value.trim();
    if (!value) { this.setStatus('ENTER YOUR ORBIT'); return; }
    const recipient = findRecipient(value);
    if (recipient) {
      this.setStatus('ORBIT IDENTIFIED', 'found');
      this.portal?.classList.add('is-surging');
      this.autoOpenTimer = setTimeout(() => {
        if (this.input.value.trim() === value && this.portal.isConnected && !this.portal.classList.contains('is-hidden')) this.openRecipient(recipient);
      }, 360);
    } else this.setStatus(/^\d+$/.test(value) && value.length < 9 ? 'NINE DIGITS REQUIRED' : 'CHECK THE IDENTIFIER');
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.openGeneration++;
    this.cosmicDirector.stop();
    this.idleCosmicDirector.stop();
    clearTimeout(this.autoOpenTimer);
    this.revealTimeline?.kill();
    gsap.killTweensOf(this.portal);
    gsap.killTweensOf(this.reveal);
    this.form?.removeEventListener('submit', this.submitHandler);
    this.input?.removeEventListener('pointerdown', this.touchStart);
    this.input?.removeEventListener('input', this.inputHandler);
    this.input?.removeEventListener('focus', this.focusHandler);
    this.input?.removeEventListener('blur', this.blurHandler);
    this.input?.removeEventListener('keydown', this.keyDownHandler);
    this.brandBackButton?.removeEventListener('click', this.returnHandler);
    this.sharedGalaxyEntry?.removeEventListener('click', this.sharedGalaxyEntryHandler);
    this.sharedGalaxyFromWish?.removeEventListener('click', this.sharedGalaxyFromWishHandler);
    this.sharedGalaxy?.dispose?.();
    window.removeEventListener('hashchange', this.hashHandler);
  }

  updateCounter() {
    const value = this.input.value.trim();
    this.counter.textContent = /^\d*$/.test(value) ? `${String(value.length).padStart(2, '0')} / 09` : 'SLUG / URL';
  }
  setStatus(text, state = '') { this.status.textContent = text; this.status.dataset.state = state; }

  renderWish(text) {
    const content = String(text);
    const sentenceEnd = content.search(/[.!?](?:\s|$)/u);
    this.wish.replaceChildren();
    if (sentenceEnd < 0) {
      this.wish.textContent = content;
      return [];
    }

    const leadEnd = sentenceEnd + 1;
    const lead = document.createElement('span');
    lead.className = 'wish-lead';
    lead.textContent = content.slice(0, leadEnd);
    const body = document.createElement('span');
    body.className = 'wish-body';
    body.textContent = content.slice(leadEnd).trim();
    this.wish.append(lead, body);
    return [lead, body];
  }

  setPhase(phase) {
    const labels = {
      idle: 'FIELD 01 / INFINITY', charge: 'FIELD 02 / COLLAPSE',
      burst: 'EVENT / SUPERNOVA', reform: 'FIELD 03 / REFORMATION', settled: 'ORBIT / YOURS'
    };
    this.sceneIndex.textContent = labels[phase] || labels.idle;
    document.body.dataset.phase = phase;
  }

  openRecipient(recipient, fromRoute = false) {
    if (!recipient) return;
    if (this.sharedGalaxyActive) this.hideSharedGalaxy();
    document.body.classList.add('has-recipient');
    this.cosmicDirector.stop();
    this.idleCosmicDirector.stop();
    this.scene?.stopCosmicEvent?.();
    this.fallback?.stopCosmicEvent?.();
    clearTimeout(this.autoOpenTimer);
    // A hash change or rapid re-entry can happen before the Back crossfade ends.
    // Cancel those panel tweens before beginning the new recipient transition.
    gsap.killTweensOf([this.portal, this.identity, this.reveal, '#eventFlash']);
    gsap.killTweensOf(this.reveal.querySelectorAll('*'));
    gsap.set([this.portal, this.identity, this.reveal], { clearProps: 'opacity,visibility,transform' });
    gsap.killTweensOf('#eventFlash');
    gsap.set('#eventFlash', { opacity: 0 });
    const generation = ++this.openGeneration;
    this.activeRecipient = recipient;
    // The STELLAR / HNUE wordmark is the unobtrusive Back control on the wish view.
    if (this.brandBackButton) this.brandBackButton.disabled = false;
    const direction = getRecipientArtDirection(recipient);
    const revealStyle = direction.reveal;
    this.revealTimeline?.kill();
    this.buildKineticName(recipient.display);
    const wishLines = this.renderWish(recipient.wish);
    document.body.dataset.artStyle = String(direction.style);
    document.body.style.setProperty('--recipient-accent', recipient.palette[0]);
    document.body.style.setProperty('--recipient-secondary', recipient.palette[1]);
    document.body.style.setProperty('--recipient-panel-offset', `${direction.reveal.panelOffset}px`);
    this.identity.classList.remove('is-visible');
    this.reveal.classList.remove('is-visible');
    this.portal.classList.add('is-leaving');
    this.setStatus('ORBIT FOUND', 'found');
    gsap.to(this.portal, { autoAlpha: 0, y: 14, duration: 0.65, ease: 'power2.inOut', onComplete: () => {
      this.portal.classList.add('is-hidden');
      this.portal.classList.remove('is-leaving');
    }});
    if (!fromRoute) history.replaceState(null, '', `${location.pathname}${location.search}#/${recipient.slug}`);
    this.rain?.setPalette(recipient.palette);
    this.rain?.burst();
    const completed = () => {
      // A Stellar Bomb may finish after the user has already pressed Back.
      // Never allow a stale completion callback to reopen the previous greeting.
      if (this.destroyed || generation !== this.openGeneration || this.activeRecipient?.slug !== recipient.slug) return;
      this.identity.classList.add('is-visible');
      this.reveal.classList.add('is-visible');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.revealTimeline?.kill();
      this.revealTimeline = gsap.timeline({ defaults: { overwrite: true } });
      this.revealTimeline.eventCallback('onStart', () => window.STELLAR?.audio?.playSfx('shimmer'));

      if (reducedMotion) {
        this.revealTimeline.fromTo(
          [...wishLines],
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.18, stagger: 0.035, ease: 'none' }
        );
      } else {
        this.revealTimeline
          .fromTo(wishLines[0] || this.wish,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, revealStyle.textDelay)
          .fromTo(wishLines[1] || this.wish,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.74, ease: 'power2.out' }, revealStyle.textDelay + 0.18);
      }
      this.setPhase('settled');
      this.revealTimeline.eventCallback('onComplete', () => {
        if (!this.destroyed && generation === this.openGeneration &&
          this.activeRecipient?.slug === recipient.slug &&
          this.reveal.classList.contains('is-visible')) {
          this.cosmicDirector.start();
        }
      });
    };
    this.particleFontReady.then(() => {
      if (this.destroyed || generation !== this.openGeneration || this.activeRecipient?.slug !== recipient.slug) return;
      try {
        if (this.scene?.triggerBomb) this.scene.triggerBomb(recipient, completed);
        else if (this.fallback?.triggerBomb) this.fallback.triggerBomb(recipient, completed);
        else completed(); // CSS-only fallback still reveals the personalized card.
      } catch (error) {
        console.error('Stellar event error:', error);
        completed();
      }
    });
  }

  returnHome({ showGalaxy = false } = {}) {
    // Invalidate every async entrance/event callback before changing visible state.
    // This also makes Back safe while the initial bomb, a reveal timeline, or a
    // scheduled auto-open is still running.
    const revealGalaxyAfterReturn = showGalaxy || this.returnToGalaxy;
    const returningRecipient = this.activeRecipient;
    this.returnToGalaxy = false;
    const generation = ++this.openGeneration;
    this.activeRecipient = null;
    this.hideSharedGalaxy();
    document.body.classList.remove('has-recipient');
    // Disable the wordmark hit target immediately to prevent repeated Back taps during crossfade.
    if (this.brandBackButton) this.brandBackButton.disabled = true;
    clearTimeout(this.autoOpenTimer);
    this.autoOpenTimer = 0;
    this.cosmicDirector.stop();
    this.idleCosmicDirector.stop();
    this.scene?.stopCosmicEvent?.();
    this.fallback?.stopCosmicEvent?.();
    this.revealTimeline?.kill();
    this.revealTimeline = null;
    gsap.killTweensOf([this.portal, this.identity, this.reveal]);
    gsap.killTweensOf(this.reveal.querySelectorAll('*'));
    gsap.killTweensOf('#eventFlash');
    gsap.set('#eventFlash', { opacity: 0 });

    this.portal.classList.remove('is-hidden', 'is-leaving', 'is-surging', 'is-anomaly', 'is-focused');
    this.input.value = '';
    this.updateCounter();
    this.setStatus('ENTER YOUR ORBIT');
    this.rain?.setPalette([COSMIC_COLORS.dustyLavender, COSMIC_COLORS.periwinkle, COSMIC_COLORS.champagne]);
    this.scene?.resetToIdle?.();
    this.fallback?.resetToIdle?.();
    document.body.dataset.phase = 'idle';
    delete document.body.dataset.artStyle;
    document.body.style.removeProperty('--recipient-accent');
    document.body.style.removeProperty('--recipient-secondary');
    document.body.style.removeProperty('--recipient-panel-offset');
    this.sceneIndex.textContent = 'FIELD 01 / INFINITY';
    history.replaceState(null, '', `${location.pathname}${location.search}`);

    gsap.to(this.reveal, { autoAlpha: 0, y: 14, duration: 0.3, ease: 'power2.in', overwrite: true, onComplete: () => {
      if (this.destroyed || generation !== this.openGeneration) return;
      this.reveal.classList.remove('is-visible');
      gsap.set(this.reveal, { clearProps: 'opacity,visibility,transform' });
      this.wish.replaceChildren();
    }});
    gsap.to(this.identity, { autoAlpha: 0, y: -6, duration: 0.24, ease: 'power2.in', overwrite: true, onComplete: () => {
      if (this.destroyed || generation !== this.openGeneration) return;
      this.identity.classList.remove('is-visible');
      gsap.set(this.identity, { clearProps: 'opacity,visibility,transform' });
      this.name.textContent = '';
      this.name.removeAttribute('aria-label');
    }});
    if (revealGalaxyAfterReturn) {
      this.portal.classList.add('is-hidden');
      this.showSharedGalaxy({ focusRecipient: returningRecipient });
      return;
    }

    this.portal.classList.remove('is-hidden');
    gsap.fromTo(this.portal, { autoAlpha: 0, y: 12 }, {
      autoAlpha: 1, y: 0, duration: 0.62, ease: 'power3.out', delay: 0.04, overwrite: true,
      onComplete: () => {
        if (this.destroyed || generation !== this.openGeneration || this.activeRecipient) return;
        gsap.set(this.portal, { clearProps: 'opacity,visibility,transform' });
        if (!document.hidden) this.idleCosmicDirector.start();
        this.input.focus({ preventScroll: true });
      }
    });
  }

  showSharedGalaxy({ updateRoute = true, focusRecipient = null } = {}) {
    if (this.destroyed || !this.sharedGalaxy || this.sharedGalaxyActive) return;
    window.STELLAR?.audio?.playSfx('shimmer');
    clearTimeout(this.autoOpenTimer);
    this.autoOpenTimer = 0;
    this.cosmicDirector.stop();
    this.idleCosmicDirector.stop();
    this.scene?.stopCosmicEvent?.();
    this.fallback?.stopCosmicEvent?.();
    this.scene?.pause?.();
    this.fallback?.pause?.();
    this.sharedGalaxyActive = true;
    this.brandBackButton.disabled = false;
    this.brandBackButton.setAttribute('aria-label', 'Quay lại màn hình nhập mã sinh viên');
    // Keep the shared scene's visible typography to recipient names only.
    this.brandBackButton.removeAttribute('title');
    document.body.classList.add('is-shared-galaxy');
    const focusIndex = focusRecipient ? recipients.indexOf(focusRecipient) : 0;
    this.sharedGalaxy.start({ focusIndex: Math.max(0, focusIndex) });
    if (updateRoute && location.hash !== '#/galaxy') {
      history.replaceState(null, '', `${location.pathname}${location.search}#/galaxy`);
    }
  }

  hideSharedGalaxy() {
    if (!this.sharedGalaxyActive && !this.sharedGalaxy) return;
    this.sharedGalaxyActive = false;
    this.sharedGalaxy?.stop?.();
    if (this.brandBackButton && !this.brandBackButton.hasAttribute('title')) {
      this.brandBackButton.setAttribute('title', 'Quay lại nhập mã');
    }
    this.scene?.resume?.();
    this.fallback?.resume?.();
    document.body.classList.remove('is-shared-galaxy');
  }

  closeSharedGalaxy() {
    this.hideSharedGalaxy();
    this.brandBackButton.disabled = true;
    document.body.classList.remove('has-recipient');
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    this.portal.classList.remove('is-hidden', 'is-leaving', 'is-surging', 'is-anomaly');
    this.input.value = '';
    this.updateCounter();
    this.setStatus('ENTER YOUR ORBIT');
    gsap.fromTo(this.portal, { autoAlpha: 0, y: 12 }, {
      autoAlpha: 1, y: 0, duration: .52, ease: 'power3.out', overwrite: true,
      onComplete: () => {
        if (this.destroyed || this.sharedGalaxyActive || this.activeRecipient) return;
        gsap.set(this.portal, { clearProps: 'opacity,visibility,transform' });
        if (!document.hidden) this.idleCosmicDirector.start();
        this.input.focus({ preventScroll: true });
      }
    });
  }

  selectSharedRecipient(recipient) {
    if (!recipient || this.destroyed) return;
    this.returnToGalaxy = true;
    this.hideSharedGalaxy();
    this.openRecipient(recipient);
  }

  routeFromHash() {
    let route = location.hash.replace(/^#\/?/, '').trim();
    try { route = decodeURIComponent(route); } catch { return; }
    if (!route) return;
    if (route.toLocaleLowerCase('en-US') === 'galaxy') {
      if (this.activeRecipient) this.returnHome({ showGalaxy: true });
      else this.showSharedGalaxy({ updateRoute: false });
      return;
    }
    const fromGalaxy = this.sharedGalaxyActive;
    const recipient = findRecipient(route);
    if (recipient && this.activeRecipient?.slug !== recipient.slug) {
      if (fromGalaxy) this.returnToGalaxy = true;
      this.hideSharedGalaxy();
      this.openRecipient(recipient, true);
    }
  }
}

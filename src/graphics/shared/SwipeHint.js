export class SwipeHint {
  constructor() {
    this.element = document.querySelector('#sharedGalaxySwipeHint');
    this.timeout = 0;
  }

  show(enabled) {
    if (!this.element || !enabled) return;
    clearTimeout(this.timeout);
    this.element.setAttribute('aria-hidden', 'false');
    this.element.classList.add('is-visible');
    this.timeout = setTimeout(() => this.hide(), 3000);
  }

  hide() {
    clearTimeout(this.timeout);
    this.timeout = 0;
    this.element?.classList.remove('is-visible');
    this.element?.setAttribute('aria-hidden', 'true');
  }
}

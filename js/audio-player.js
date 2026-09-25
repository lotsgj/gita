export class AudioPlayer {
  constructor({ audio, playButton, playIcon, pauseIcon, seek, time, onError = () => {} }) {
    this.audio = audio;
    this.playButton = playButton;
    this.playIcon = playIcon;
    this.pauseIcon = pauseIcon;
    this.seek = seek;
    this.time = time;
    this.onError = onError;
    this.bind();
  }

  bind() {
    this.playButton.addEventListener('click', () => this.toggle());
    this.audio.addEventListener('play', () => this.updatePlayState());
    this.audio.addEventListener('pause', () => this.updatePlayState());
    this.audio.addEventListener('ended', () => this.updatePlayState());
    this.audio.addEventListener('loadedmetadata', () => {
      this.seek.max = Number.isFinite(this.audio.duration) ? String(this.audio.duration) : '0';
      this.seek.disabled = !Number.isFinite(this.audio.duration) || this.audio.duration <= 0;
      this.time.textContent = '00:00 / ' + this.formatTime(this.audio.duration);
    });
    this.audio.addEventListener('timeupdate', () => {
      this.seek.value = String(this.audio.currentTime || 0);
      this.time.textContent = this.formatTime(this.audio.currentTime) + ' / ' + this.formatTime(this.audio.duration);
    });
    this.seek.addEventListener('input', (event) => {
      if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Number(event.target.value);
    });
    this.audio.addEventListener('error', () => {
      this.time.textContent = 'Audio unavailable';
      this.playButton.disabled = true;
      this.seek.disabled = true;
      this.updatePlayState();
      this.onError();
    });
  }

  setSource(source) {
    this.stop();
    this.audio.removeAttribute('src');
    if (source) this.audio.src = source;
    this.playButton.disabled = !source;
    this.seek.disabled = !source;
    this.seek.max = '0';
    this.seek.value = '0';
    this.time.textContent = source ? '00:00 / 00:00' : 'No audio';
  }

  toggle() {
    if (!this.audio.getAttribute('src')) return;
    if (this.audio.paused) this.audio.play().catch(() => this.updatePlayState());
    else this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.seek.value = '0';
    this.updatePlayState();
  }

  updatePlayState() {
    const playing = !this.audio.paused && !this.audio.ended;
    this.playIcon.toggleAttribute('hidden', playing);
    this.pauseIcon.toggleAttribute('hidden', !playing);
    this.playButton.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
    this.playButton.title = (playing ? 'Pause audio' : 'Play audio') + ' (P or Space)';
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
  }
}

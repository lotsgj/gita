export class AudioPlayer {
  constructor({ audio, playButton, playIcon, pauseIcon, seek, time, onError = () => {}, onEvent = () => {} }) {
    this.audio = audio;
    this.playButton = playButton;
    this.playIcon = playIcon;
    this.pauseIcon = pauseIcon;
    this.seek = seek;
    this.time = time;
    this.onError = onError;
    this.onEvent = onEvent;
    this.started = false;
    this.suppressPause = false;
    this.milestones = new Set();
    this.listenedSeconds = 0;
    this.lastPlaybackTime = 0;
    this.bind();
  }

  bind() {
    this.playButton.addEventListener('click', () => this.toggle());
    this.audio.addEventListener('play', () => {
      this.onEvent(this.started ? 'audio_resumed' : 'audio_started');
      this.started = true;
      this.updatePlayState();
    });
    this.audio.addEventListener('pause', () => {
      if (!this.suppressPause && this.started && !this.audio.ended && this.audio.currentTime > 0) this.onEvent('audio_paused');
      this.updatePlayState();
    });
    this.audio.addEventListener('ended', () => {
      this.onEvent('audio_completed');
      this.updatePlayState();
    });
    this.audio.addEventListener('loadedmetadata', () => {
      this.seek.max = Number.isFinite(this.audio.duration) ? String(this.audio.duration) : '0';
      this.seek.disabled = !Number.isFinite(this.audio.duration) || this.audio.duration <= 0;
      this.time.textContent = '00:00 / ' + this.formatTime(this.audio.duration);
    });
    this.audio.addEventListener('timeupdate', () => {
      const currentTime = this.audio.currentTime || 0;
      const playbackDelta = currentTime - this.lastPlaybackTime;
      if (!this.audio.paused && playbackDelta > 0 && playbackDelta < 2) this.listenedSeconds += playbackDelta;
      this.lastPlaybackTime = currentTime;
      this.seek.value = String(this.audio.currentTime || 0);
      this.time.textContent = this.formatTime(this.audio.currentTime) + ' / ' + this.formatTime(this.audio.duration);
      if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        const progress = this.listenedSeconds / this.audio.duration;
        [[.25, 'audio_25'], [.5, 'audio_50'], [.75, 'audio_75']].forEach(([point, name]) => {
          if (progress >= point && !this.milestones.has(name)) {
            this.milestones.add(name);
            this.onEvent(name);
          }
        });
      }
    });
    this.seek.addEventListener('input', (event) => {
      if (Number.isFinite(this.audio.duration)) this.audio.currentTime = Number(event.target.value);
    });
    this.seek.addEventListener('change', () => {
      this.lastPlaybackTime = this.audio.currentTime || 0;
      this.onEvent('audio_seeked');
    });
    this.audio.addEventListener('error', () => {
      this.time.textContent = 'Audio unavailable';
      this.playButton.disabled = true;
      this.seek.disabled = true;
      this.updatePlayState();
      this.onError();
      this.onEvent('audio_failed');
    });
  }

  setSource(source) {
    this.suppressPause = true;
    this.stop();
    this.suppressPause = false;
    this.started = false;
    this.milestones.clear();
    this.listenedSeconds = 0;
    this.lastPlaybackTime = 0;
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

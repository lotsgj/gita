export const EVENT_SCHEMA_VERSION = 1;

export const EVENT_NAMES = new Set([
  'app_opened',
  'profile_created',
  'profile_selected',
  'profile_updated',
  'profile_switched',
  'experience_selected',
  'location_changed',
  'language_changed',
  'home_opened',
  'data_load_failed',
  'profile_storage_failed',
  'verse_viewed',
  'verse_engaged_10s',
  'verse_engaged_30s',
  'verse_engaged_60s',
  'audio_started',
  'audio_resumed',
  'audio_paused',
  'audio_seeked',
  'audio_25',
  'audio_50',
  'audio_75',
  'audio_completed',
  'audio_failed'
]);

export function validateEventInput(name, input = {}) {
  if (!EVENT_NAMES.has(name)) throw new Error('Unknown Gitaverse event: ' + name);
  if (input.context != null && (typeof input.context !== 'object' || Array.isArray(input.context))) {
    throw new Error('Event context must be an object.');
  }
  if (input.details != null && (typeof input.details !== 'object' || Array.isArray(input.details))) {
    throw new Error('Event details must be an object.');
  }
  if (name === 'location_changed') {
    if (!input.context?.experience || !input.context?.sid) {
      throw new Error('location_changed requires experience and sid.');
    }
  }
  if ((name === 'location_changed' || name === 'home_opened') && !Number.isInteger(Number(input.profileId))) {
    throw new Error(name + ' requires a profile ID.');
  }
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

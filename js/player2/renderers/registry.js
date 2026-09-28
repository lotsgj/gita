import { createGita700Renderer } from './gita-700.js';

const experiences = {
  'gita-700': {
    available: true,
    label: 'Gita 700',
    load: async () => createGita700Renderer()
  },
  'gita-yoga': { available: false, label: 'Gita Yoga' },
  'gita-sara': { available: false, label: 'Gita Sara' }
};

export function getExperience(id) {
  return experiences[id] || null;
}

export function availableExperiences() {
  return Object.entries(experiences).filter(([, experience]) => experience.available);
}

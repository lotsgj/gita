import { createGita700Renderer } from './gita-700.js';
import { createGitaYogaRenderer } from './gita-yoga.js';

const experiences = {
  'gita-700': {
    available: true,
    label: 'Gita 700',
    load: async () => createGita700Renderer()
  },
  'gita-yoga': {
    available: true,
    label: 'Gita Yoga',
    load: async () => createGitaYogaRenderer()
  },
  'gita-sara': { available: false, label: 'Gita Sara' }
};

export function getExperience(id) {
  return experiences[id] || null;
}

export function availableExperiences() {
  return Object.entries(experiences).filter(([, experience]) => experience.available);
}

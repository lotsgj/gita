import { createGita700Renderer } from './gita-700.js';
import { createGitaYogaRenderer } from './gita-yoga.js';
import { createGitaSaraRenderer } from './gita-sara.js';

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
  'gita-sara': {
    available: true,
    label: 'Gita Sara',
    load: async (options) => createGitaSaraRenderer(options)
  }
};

export function getExperience(id) {
  return experiences[id] || null;
}

export function availableExperiences() {
  return Object.entries(experiences).filter(([, experience]) => experience.available);
}

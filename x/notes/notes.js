const views = {
  library: document.querySelector('#library-view'),
  context: document.querySelector('#context-view')
};

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
    Object.entries(views).forEach(([name, view]) => { view.hidden = name !== button.dataset.view; });
  });
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    const filter = button.dataset.filter;
    document.querySelectorAll('.note-card').forEach((card) => {
      card.hidden = filter !== 'all' && !card.dataset.kind.split(' ').includes(filter);
    });
  });
});

document.querySelectorAll('.note-types button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.note-types button').forEach((item) => item.classList.toggle('active', item === button));
  });
});

const recordButton = document.querySelector('.record-button');
const recordTime = document.querySelector('.recording time');
recordButton.addEventListener('click', () => {
  const active = recordButton.classList.toggle('recording-now');
  recordButton.querySelector('span').textContent = active ? '■' : '●';
  recordButton.setAttribute('aria-label', active ? 'Stop voice recording' : 'Start voice recording');
  recordTime.hidden = !active;
  recordTime.textContent = active ? '00:07' : '00:00';
  document.querySelector('.recording small').textContent = active ? 'Recording… tap to stop' : 'Tap to record your reflection';
});

document.querySelector('.close-composer').addEventListener('click', () => document.querySelector('[data-view="library"]').click());
document.querySelector('.quiet').addEventListener('click', () => document.querySelector('[data-view="library"]').click());

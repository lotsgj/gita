const illustrations = [
  {
    caption: '',
    art: `<svg viewBox="0 0 640 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A person tending a small field while a wide sunrise opens beyond distant mountains">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5c56f"/><stop offset=".55" stop-color="#e8d5b3"/><stop offset="1" stop-color="#89a6a5"/></linearGradient><linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#728b65"/><stop offset="1" stop-color="#384f48"/></linearGradient></defs>
      <rect width="640" height="760" fill="url(#sky)"/><circle cx="470" cy="180" r="74" fill="#f8de8b" opacity=".9"/>
      <path d="M0 400 150 250 270 380 405 220 640 410V760H0Z" fill="#706f67" opacity=".72"/><path d="M0 450 180 350 310 430 475 320 640 440V760H0Z" fill="#536b63"/><path d="M0 500Q180 440 340 505T640 480V760H0Z" fill="url(#land)"/>
      <g stroke="#cbbf83" stroke-width="5" opacity=".75"><path d="M0 575Q190 515 640 560"/><path d="M0 630Q230 570 640 615"/><path d="M0 690Q250 625 640 675"/></g>
      <g transform="translate(210 468)" fill="#283b35"><circle cx="0" cy="0" r="15"/><path d="M-9 16 18 85H-22Z"/><path d="M7 35 60 70" stroke="#283b35" stroke-width="12" stroke-linecap="round"/><path d="M55 68 82 115" stroke="#583d2c" stroke-width="7"/></g>
      <path d="M100 145q35-28 70 0m-35-18q30-25 62 2" fill="none" stroke="#4b5c5b" stroke-width="5" stroke-linecap="round"/>
    </svg>`
  },
  {
    caption: 'Care for the action without trying to hold its fruit.',
    art: `<svg viewBox="0 0 640 760" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Two open hands releasing a seed that grows into a tree beyond their reach">
      <rect width="640" height="760" fill="#dfe8e2"/><circle cx="320" cy="236" r="145" fill="#f7edce"/><path d="M320 470V245" stroke="#70543b" stroke-width="18" stroke-linecap="round"/>
      <g fill="#748d63"><ellipse cx="260" cy="270" rx="77" ry="38" transform="rotate(-25 260 270)"/><ellipse cx="380" cy="290" rx="78" ry="39" transform="rotate(28 380 290)"/><ellipse cx="290" cy="205" rx="70" ry="34" transform="rotate(-65 290 205)"/><ellipse cx="358" cy="205" rx="70" ry="34" transform="rotate(65 358 205)"/></g>
      <circle cx="320" cy="510" r="11" fill="#b95b2b"/><path d="M40 650q125-100 240-30l40 27-40 20q-132 34-240-17Z" fill="#d6a67e"/><path d="M600 650q-125-100-240-30l-40 27 40 20q132 34 240-17Z" fill="#d6a67e"/><path d="M120 650q98-34 176 4M520 650q-98-34-176 4" fill="none" stroke="#b98465" stroke-width="6"/>
    </svg>`
  }
];

const questions = [
  'What action deserves your complete attention right now?',
  'Where is concern about the outcome changing the quality of your action?',
  'What would wholehearted effort look like if success were not guaranteed?',
  'Is fear of the result pulling you toward inaction?'
];

const illustrationStage = document.querySelector('#illustration-stage');
const illustrationControls = document.querySelector('#illustration-controls');
const questionStage = document.querySelector('#question-stage');
const questionControls = document.querySelector('#question-controls');
const questionModeButton = document.querySelector('#question-mode');
let illustrationIndex = 0;
let questionIndex = 0;
let questionMode = 'one';
let useDefaultIllustration = false;
let useDefaultQuestion = false;

function renderIllustration() {
  if (useDefaultIllustration) {
    illustrationStage.innerHTML = `<div class="illustration-default" role="img" aria-label="A quiet contemplative motif"><div><div class="default-mark">⌁</div><p>Stay with the shloka and allow its meaning to form its own image.</p></div></div>`;
    illustrationControls.hidden = true;
    return;
  }
  const item = illustrations[illustrationIndex];
  illustrationStage.innerHTML = `<figure class="illustration${item.caption ? ' has-caption' : ''}">${item.art}${item.caption ? `<figcaption>${item.caption}</figcaption>` : ''}</figure>`;
  illustrationControls.hidden = illustrations.length <= 1;
}

function renderQuestions() {
  const isAll = questionMode === 'all';
  questionModeButton.setAttribute('aria-label', isAll ? 'Show one contemplation at a time' : 'Show all contemplations');
  questionModeButton.title = isAll ? 'One at a time' : 'Show all contemplations';
  questionStage.classList.toggle('all-mode', isAll && !useDefaultQuestion);
  if (useDefaultQuestion) {
    questionStage.innerHTML = `<div class="question-default"><span aria-hidden="true">✦</span><p>Pause with this shloka. What stands out to you?</p></div>`;
    questionControls.hidden = true;
    return;
  }
  if (isAll) {
    questionStage.innerHTML = `<ol class="question-list">${questions.map((question) => `<li>${question}</li>`).join('')}</ol>`;
    questionControls.hidden = true;
    return;
  }
  questionStage.innerHTML = `<article class="question-card"><span class="question-number">Contemplation ${questionIndex + 1}</span><p>${questions[questionIndex]}</p></article>`;
  questionControls.hidden = questions.length <= 1;
}

function moveIllustration(delta) { illustrationIndex = (illustrationIndex + delta + illustrations.length) % illustrations.length; renderIllustration(); }
function moveQuestion(delta) { questionIndex = (questionIndex + delta + questions.length) % questions.length; renderQuestions(); }
document.querySelector('#previous-illustration').addEventListener('click', () => moveIllustration(-1));
document.querySelector('#next-illustration').addEventListener('click', () => moveIllustration(1));
document.querySelector('#previous-question').addEventListener('click', () => moveQuestion(-1));
document.querySelector('#next-question').addEventListener('click', () => moveQuestion(1));
questionModeButton.addEventListener('click', () => { questionMode = questionMode === 'one' ? 'all' : 'one'; renderQuestions(); });

const menuButton = document.querySelector('#main-menu-button');
const mainMenu = document.querySelector('#main-menu');
menuButton.addEventListener('click', () => { mainMenu.hidden = !mainMenu.hidden; menuButton.setAttribute('aria-expanded', String(!mainMenu.hidden)); });
function closeMenu() { mainMenu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }
document.querySelector('#preview-complete').addEventListener('click', () => { useDefaultIllustration = false; useDefaultQuestion = false; closeMenu(); renderIllustration(); renderQuestions(); });
document.querySelector('#preview-no-image').addEventListener('click', () => { useDefaultIllustration = true; useDefaultQuestion = false; closeMenu(); renderIllustration(); renderQuestions(); });
document.querySelector('#preview-no-questions').addEventListener('click', () => { useDefaultIllustration = false; useDefaultQuestion = true; closeMenu(); renderIllustration(); renderQuestions(); });
document.querySelector('.illustration-panel').addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft') moveIllustration(-1); if (event.key === 'ArrowRight') moveIllustration(1); });
document.querySelector('.contemplation-panel').addEventListener('keydown', (event) => { if (questionMode !== 'one') return; if (event.key === 'ArrowLeft') moveQuestion(-1); if (event.key === 'ArrowRight') moveQuestion(1); });
renderIllustration();
renderQuestions();

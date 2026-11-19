const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- theme toggle ----------
const toggle = document.querySelector('.theme-toggle');
let switching = false; // overlapping transitions cancel each other and leave the page half-switched
toggle.addEventListener('click', () => {
  if (switching) return;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  };
  if (!document.startViewTransition || reduceMotion) return apply();

  // light grows out of the toggle as a circle, and shrinks back into it when going dark
  const toLight = next === 'light';
  const { left, top, width, height } = toggle.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const clip = [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
  switching = true;
  root.classList.add('theme-switching', toLight ? 'to-light' : 'to-dark');
  const transition = document.startViewTransition(apply);
  let reveal;
  transition.ready.then(() => {
    reveal = root.animate(
      { clipPath: toLight ? clip : clip.reverse() },
      {
        duration: 650,
        easing: 'cubic-bezier(.65, 0, .35, 1)',
        fill: 'forwards', // otherwise the shrunk light page pops back for a frame before the transition ends
        pseudoElement: toLight ? '::view-transition-new(root)' : '::view-transition-old(root)',
      },
    );
  }).catch(() => {}); // rejects when the browser skips the transition; the theme still applies
  transition.finished.finally(() => {
    reveal?.cancel(); // a kept (fill: forwards) animation would also clip the next transition's snapshots
    root.classList.remove('theme-switching', 'to-light', 'to-dark');
    switching = false;
  });
});

// ---------- footer year ----------
document.querySelector('.js-year').textContent = new Date().getFullYear();

// ---------- terminal: type a question, send it, stream the answer ----------
// The finished state lives in the HTML; this only replays it, so no-JS and reduced motion see it as is.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];

// [while working, once done]
const verbs = [
  ['Thinking', 'Thought'],
  ['Pondering', 'Pondered'],
  ['Brewing', 'Brewed'],
  ['Cooking', 'Cooked'],
  ['Baking', 'Baked'],
  ['Churning', 'Churned'],
  ['Crunching', 'Crunched'],
  ['Noodling', 'Noodled'],
  ['Percolating', 'Percolated'],
  ['Cogitating', 'Cogitated'],
];

const textNodesOf = el => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
};

const playTerminal = async term => {
  const user = term.querySelector('.js-user');
  const reply = term.querySelector('.js-reply');
  const output = term.querySelector('.js-output');
  const status = term.querySelector('.js-status');
  const spinner = term.querySelector('.js-spinner');
  const statusText = term.querySelector('.js-status-text');
  const prompt = term.querySelector('.js-prompt');

  // lock the final size so nothing around the terminal moves while it fills up
  const { width, height } = term.getBoundingClientRect();
  term.style.minWidth = `${width}px`;
  term.style.minHeight = `${height}px`;

  const question = user.textContent.replace(/^>\s*/, '');
  const outputNodes = textNodesOf(output).map(node => ({ node, text: node.textContent }));
  outputNodes.forEach(({ node }) => { node.textContent = ''; });
  user.hidden = true;
  reply.hidden = true;
  status.hidden = true;
  root.classList.remove('term-pending');

  // 1. type the question into the input box, then "press enter"
  await sleep(700);
  for (const char of question) {
    prompt.textContent += char;
    await sleep(rand(35, 90));
  }
  await sleep(450);
  prompt.textContent = '';
  user.hidden = false;

  // 2. spinner runs while the model thinks and streams
  const start = performance.now();
  const frames = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  let frame = 0;
  const [working, done] = pick(verbs);
  const verb = document.createElement('span');
  verb.className = 'term__verb';
  verb.textContent = `${working}…`;
  const meta = document.createElement('span');
  meta.className = 'term__meta';
  statusText.replaceChildren(verb, ' ', meta);
  const tick = () => {
    spinner.textContent = frames[frame++ % frames.length];
    const secs = Math.floor((performance.now() - start) / 1000);
    meta.textContent = `(${secs}s · esc to interrupt)`;
  };
  spinner.classList.add('is-spinning');
  status.hidden = false;
  tick();
  const timer = setInterval(tick, 110);
  await sleep(1300);

  // 3. stream the answer in small token-sized chunks
  reply.hidden = false;
  for (const { node, text } of outputNodes) {
    let i = 0;
    while (i < text.length) {
      i += Math.round(rand(2, 6));
      node.textContent = text.slice(0, i);
      await sleep(28);
    }
  }

  clearInterval(timer);
  spinner.classList.remove('is-spinning');
  spinner.textContent = '✻';
  const secs = ((performance.now() - start) / 1000).toFixed(1);
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  statusText.textContent = `${done} for ${secs}s · done ${time}`;
  term.style.minWidth = '';
  term.style.minHeight = '';
};

const terminal = document.querySelector('.term');
if (terminal && !reduceMotion) document.fonts.ready.then(() => playTerminal(terminal));

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- theme toggle ----------
document.querySelector('.theme-toggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

// ---------- footer year ----------
document.querySelector('.js-year').textContent = new Date().getFullYear();

// ---------- terminal: type a question, send it, stream the answer ----------
// The finished state lives in the HTML; this only replays it, so no-JS and reduced motion see it as is.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);

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
  let label = 'Thinking…';
  const tick = () => {
    spinner.textContent = frames[frame++ % frames.length];
    const secs = Math.floor((performance.now() - start) / 1000);
    statusText.textContent = `${label} (${secs}s · esc to interrupt)`;
  };
  spinner.classList.add('is-spinning');
  status.hidden = false;
  tick();
  const timer = setInterval(tick, 110);
  await sleep(1300);

  // 3. stream the answer in small token-sized chunks
  label = 'Generating…';
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
  statusText.textContent = `Worked for ${((performance.now() - start) / 1000).toFixed(1)}s`;
  term.style.minWidth = '';
  term.style.minHeight = '';
};

const terminal = document.querySelector('.term');
if (terminal && !reduceMotion) document.fonts.ready.then(() => playTerminal(terminal));

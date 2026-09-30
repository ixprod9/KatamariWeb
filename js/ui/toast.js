import { $ } from '../dom.js';

let timer;

// Show a short status message; `bad` gives it the error style.
export function toast(msg, bad) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('bad', !!bad);
  t.classList.add('on');
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('on'), 2600);
}

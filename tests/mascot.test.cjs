const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../mascot.js'), 'utf8');

function fixture({ reduced = false } = {}) {
  let now = 0, id = 0, observer;
  const jobs = new Map();
  const target = () => ({
    handlers: new Map(), dataset: {}, style: { setProperty(key, value) { this[key] = value; } },
    addEventListener(name, callback) {
      const handlers = this.handlers.get(name) || [];
      handlers.push(callback);
      this.handlers.set(name, handlers);
    },
    emit(name, event = {}) { for (const callback of this.handlers.get(name) || []) callback(event); },
  });
  const elements = Object.fromEntries(['button', 'motion', 'art', 'shadow', 'speech'].map(name => [`.mascot-${name}`, target()]));
  const dock = target();
  dock.dataset.state = 'idle';
  dock.querySelector = selector => elements[selector];
  const motion = Object.assign(target(), { matches: reduced });
  const window = Object.assign(target(), { scrollY: 0, matchMedia: () => motion, scrollToCalls: [], scrollTo(options) { this.scrollToCalls.push(options); } });
  const document = Object.assign(target(), { hidden: false, querySelector: () => dock, querySelectorAll: () => [] });
  function schedule(callback, delay, kind) { const key = ++id; jobs.set(key, { at: now + delay, callback, kind }); return key; }
  vm.runInNewContext(source, {
    window, document, performance: { now: () => now },
    Math: Object.assign(Object.create(Math), { random: () => .5 }),
    setTimeout: (callback, delay) => schedule(callback, delay, 'timer'),
    clearTimeout: key => jobs.delete(key),
    requestAnimationFrame: callback => schedule(callback, 16, 'frame'),
    cancelAnimationFrame: key => jobs.delete(key),
    IntersectionObserver: class { constructor(callback) { observer = callback; } observe() {} },
  });
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      jobs.delete(next[0]); now = next[1].at; next[1].callback(now);
    }
    now = end;
  }
  function scroll(y) { window.scrollY = y; window.emit('scroll'); }
  return { dock, elements, window, document, motion, advance, scroll, jobs,
    tap: () => elements['.mascot-button'].emit('click'),
    frames: () => [...jobs.values()].filter(job => job.kind === 'frame').length,
  };
}

test('mascot taps play actions without scrolling', () => {
  const f = fixture();
  f.tap(); assert.equal(f.dock.dataset.state, 'greet');
  f.advance(100); f.tap(); assert.equal(f.dock.dataset.state, 'spin');
  f.advance(1800); assert.equal(f.dock.dataset.state, 'idle');
  assert.equal(f.frames(), 0);
  assert.equal(f.window.scrollToCalls.length, 0);
});

test('scrolling keeps one animation loop, changes direction and settles completely', () => {
  const f = fixture();
  for (let i = 1; i < 80; i++) {
    f.scroll(i < 40 ? i * 20 : (80 - i) * 20);
    assert.equal(f.frames(), 1);
    f.advance(16);
    assert.equal(f.dock.dataset.state, i <= 40 ? 'swim' : 'flight');
    assert.doesNotMatch(f.elements['.mascot-motion'].style.transform, /NaN|Infinity/);
  }
  f.advance(2500);
  assert.equal(f.dock.dataset.state, 'idle');
  assert.equal(f.frames(), 0);
  assert.equal(f.elements['.mascot-motion'].style.transform, '');
});

test('upward scroll restores balloon with moving limbs and holds it through landing', () => {
  const f = fixture();
  f.scroll(1200); f.advance(32);
  const positions = new Set();
  for (let i = 1; i <= 30; i++) {
    f.scroll(1200 - i * 20); f.advance(16);
    assert.equal(f.dock.dataset.state, 'flight');
    assert.equal(f.elements['.mascot-art'].dataset.sprite, 'balloon');
    positions.add(f.elements['.mascot-art'].style['--mascot-balloon-x']);
    assert.match(f.elements['.mascot-motion'].style.transform, /^translate3d\(0, -?[\d.]+px, 0\)$/);
  }
  assert.equal(positions.size, 4, 'all four arm/leg poses should play');
  f.advance(250);
  assert.equal(f.dock.dataset.state, 'landing');
  assert.equal(f.elements['.mascot-art'].dataset.sprite, 'balloon');
  f.advance(2200);
  assert.equal(f.dock.dataset.state, 'idle');
  assert.equal(f.elements['.mascot-art'].dataset.sprite, 'base');
  assert.equal(f.frames(), 0);
});

test('reduced motion keeps static art and still responds with a message', () => {
  const f = fixture({ reduced: true });
  f.tap(); f.scroll(500); f.advance(5000);
  assert.equal(f.dock.dataset.state, 'idle');
  assert.equal(f.frames(), 0);
  assert.equal(f.dock.dataset.paused, 'true');
  assert.match(f.elements['.mascot-speech'].textContent, /พร้อมเที่ยว/);
});

test('hiding the page cancels all animation and timers; visibility restores idle', () => {
  const f = fixture(); f.tap(); f.advance(80);
  f.document.hidden = true; f.document.emit('visibilitychange');
  assert.equal(f.jobs.size, 0);
  assert.equal(f.dock.dataset.paused, 'true');
  f.document.hidden = false; f.document.emit('visibilitychange');
  assert.equal(f.dock.dataset.state, 'idle');
  assert.equal(f.dock.dataset.paused, 'false');
  assert.equal(f.frames(), 0);
  assert.ok(f.jobs.size > 0);
});

test('long inactivity leads to sleep; a tap wakes the companion', () => {
  const f = fixture(); f.advance(65000);
  assert.equal(f.dock.dataset.state, 'sleep');
  assert.equal(f.jobs.size, 0);
  f.tap(); assert.equal(f.dock.dataset.state, 'greet');
});

test('opening details reacts without intercepting the accordion; map links trigger guide action', () => {
  const f = fixture();
  f.document.emit('toggle', { target: { tagName: 'DETAILS', open: true } });
  assert.equal(f.dock.dataset.state, 'curious');
  f.document.emit('click', { target: { closest: () => ({}) } });
  assert.equal(f.dock.dataset.state, 'map');
  assert.match(f.elements['.mascot-speech'].textContent, /แผนที่/);
  f.advance(5000); assert.equal(f.frames(), 0);
});

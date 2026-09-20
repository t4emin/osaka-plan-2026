(() => {
  const dock = document.querySelector('.mascot-dock');
  if (!dock) return;
  const button = dock.querySelector('.mascot-button');
  const actor = dock.querySelector('.mascot-motion');
  const art = dock.querySelector('.mascot-art');
  const shadow = dock.querySelector('.mascot-shadow');
  const speech = dock.querySelector('.mascot-speech');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canMove = () => !motion.matches && !document.hidden;
  const poses = {
    greet: [0, 1, 4, 5, 6, 7, 1, 0],
    swim: [8, 9, 10, 11, 12, 13, 14, 15],
    look: [0, 8, 9, 9, 12, 13, 0],
    curious: [0, 8, 9, 12, 0],
    snack: [0, 4, 5, 6, 5, 0],
    bubble: [8, 9, 10, 11],
  };
  const messages = {
    greet: 'พร้อมเที่ยวแล้ว! ไปกัน 🐟',
    spin: 'ว้าว… หมุนจนมึนเลย!',
    snack: 'ทาโกะยากิร้อน ๆ … ฟู่!',
    map: 'แผนที่กลับหัวนี่นา… อ๋อ ทางนี้!',
    photo: 'ยิ้มหน่อย… แชะ! 📷',
    bubble: 'บุ๋ง ๆ ไปดูปลาด้วยกัน!',
    bye: 'เก็บความทรงจำกลับบ้านกัน',
    curious: 'ขอดูด้วยคนสิ!',
  };
  const durations = { greet: 1500, spin: 1200, snack: 3200, map: 2900, photo: 2400, bubble: 2600, bye: 2300, curious: 1500, look: 2100 };
  // Keep the body and feet anchored to the same point in every source frame.
  const centers = [121, 123, 123, 121, 121.5, 122.5, 122, 122.5, 122, 121.5, 121.5, 121.5, 122.5, 121, 120, 123];
  const feet = [609, 609, 609, 609, 609, 609, 610, 609, 609, 609, 608, 609, 608, 608, 609, 608];
  // Measured eye centers keep the head still while the free arm and feet paddle.
  const balloonEyes = [[281.72, 412.48], [797.86, 411.96], [1327.63, 412.2], [1839.65, 412.56]];
  let frame = -1;
  let raf = null;
  let lastTick = 0;
  let action = null;
  let state = 'idle';
  let lastScrollY = window.scrollY;
  let lastScrollAt = -Infinity;
  let lastInputAt = performance.now();
  let lastReactionAt = -Infinity;
  let lastTapAt = -Infinity;
  let tapCount = 0;
  let speed = 0;
  let scrollDirection = 1;
  let swimPhase = 0;
  let day = 'day1';
  let blinkTimer, blinkEndTimer, idleTimer, speechTimer;
  const position = { y: 0 };
  const velocity = { y: 0 };

  function setState(next) {
    if (state === next) return;
    state = next;
    dock.dataset.state = next;
  }
  function setFrame(next) {
    const key = `base-${next}`;
    if (frame === key) return;
    frame = key;
    art.dataset.sprite = 'base';
    art.style.setProperty('--mascot-x', 0.5 - next - centers[next] / 244);
    art.style.setProperty('--mascot-y', 1.55 - (feet[next] + 6) / 244 - 0.02);
  }
  function setBalloonFrame(next) {
    const key = `balloon-${next}`;
    if (frame === key) return;
    frame = key;
    art.dataset.sprite = 'balloon';
    const [x, y] = balloonEyes[next];
    art.style.setProperty('--mascot-balloon-x', 0.5 - x * 4.24 / 2172);
    art.style.setProperty('--mascot-balloon-y', 1.087 - y * 4.24 / 2172);
  }
  function say(text) {
    clearTimeout(speechTimer);
    speech.textContent = text;
    dock.dataset.speaking = 'true';
    speechTimer = setTimeout(() => { dock.dataset.speaking = 'false'; }, 3200);
  }
  function clearIdle() {
    clearTimeout(blinkTimer);
    clearTimeout(blinkEndTimer);
    clearTimeout(idleTimer);
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    if (!canMove() || state !== 'idle') return;
    blinkTimer = setTimeout(() => {
      if (!canMove() || state !== 'idle') return;
      setFrame(2);
      blinkEndTimer = setTimeout(() => {
        if (state === 'idle') setFrame(0);
        scheduleBlink();
      }, 110);
    }, 2300 + Math.random() * 3100);
  }
  function scheduleIdle() {
    clearIdle();
    if (!canMove() || state !== 'idle') return;
    scheduleBlink();
    idleTimer = setTimeout(() => {
      if (!canMove() || state !== 'idle') return;
      if (performance.now() - lastInputAt > 45000) {
        setState('sleep');
        clearIdle();
        setFrame(2);
      } else {
        play('look', { user: false, speak: false });
      }
    }, 6500 + Math.random() * 5500);
  }
  function requestTick() {
    if (raf !== null || !canMove()) return;
    lastTick = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function play(name, { user = true, speak = true } = {}) {
    if (document.hidden) return;
    if (speak) say(messages[name] || messages.greet);
    if (user) lastInputAt = performance.now();
    if (!canMove()) return;
    clearIdle();
    action = { name, start: performance.now(), duration: durations[name] };
    setState(name);
    setFrame(0);
    requestTick();
  }
  function tick(now) {
    raf = null;
    if (!canMove()) return;
    const dt = Math.min(Math.max((now - lastTick) / 1000, .001), .032);
    lastTick = now;
    const target = { y: 0 };
    let busy = false;
    if (action && now - action.start >= action.duration) {
      action = null;
      setState('idle');
      setFrame(0);
    }
    if (action) {
      busy = true;
      const p = Math.min(1, (now - action.start) / action.duration);
      const envelope = Math.sin(Math.PI * p);
      const frames = poses[action.name] || poses.greet;
      setFrame(frames[Math.min(frames.length - 1, Math.floor(p * frames.length))]);
      if (action.name === 'greet' || action.name === 'bye') {
        target.y = -12 * envelope;
      } else if (action.name === 'look' || action.name === 'curious' || action.name === 'map') {
        target.y = -3 * envelope;
      } else if (action.name === 'bubble') {
        target.y = -15 * envelope;
      } else if (action.name === 'snack') {
        target.y = -3 * envelope;
      }
    } else if (now - lastScrollAt < 190) {
      busy = true;
      const flight = scrollDirection < 0;
      const nextState = flight ? 'flight' : 'swim';
      if (state !== nextState) swimPhase = 0;
      setState(nextState);
      const intensity = Math.min(1, Math.abs(speed) / 1500);
      target.y = flight ? -12 - 24 * intensity : -6 - 20 * intensity;
      const cadence = 145 - intensity * 65;
      swimPhase += dt * 1000 / cadence;
      if (flight) setBalloonFrame(Math.floor(swimPhase) % balloonEyes.length);
      else setFrame(poses.swim[Math.floor(swimPhase) % poses.swim.length]);
    } else if (state === 'flight' || state === 'landing') {
      // Keep holding the balloon until the spring has brought the body to rest.
      setState('landing');
      swimPhase += dt * 1000 / 220;
      setBalloonFrame(Math.floor(swimPhase) % balloonEyes.length);
    } else if (state !== 'idle') {
      setState('idle');
      setFrame(0);
    }
    // A damped spring preserves velocity when scroll direction or action changes.
    let moving = false;
    for (const key of Object.keys(position)) {
      velocity[key] += ((target[key] - position[key]) * 145 - velocity[key] * 21) * dt;
      position[key] += velocity[key] * dt;
      if (Math.abs(target[key] - position[key]) > .03 || Math.abs(velocity[key]) > .1) moving = true;
    }
    actor.style.transform = `translate3d(0, ${position.y.toFixed(2)}px, 0)`;
    const lift = Math.min(1, Math.abs(position.y) / 30);
    shadow.style.transform = `scaleX(${(1 - lift * .35).toFixed(3)})`;
    shadow.style.opacity = (1 - lift * .55).toFixed(3);
    if (busy || moving) {
      raf = requestAnimationFrame(tick);
    } else {
      actor.style.transform = '';
      setState('idle');
      setFrame(0);
      scheduleIdle();
    }
  }
  function contextualAction() {
    if (day === 'day4') return 'bubble';
    if (day === 'day5') return 'bye';
    if (day === 'day2' || day === 'day3') return 'photo';
    return 'snack';
  }
  button.addEventListener('click', () => {
    const now = performance.now();
    const rapid = now - lastTapAt < 450;
    lastTapAt = now;
    const choices = ['greet', 'snack', contextualAction(), 'map', 'spin'];
    // Let an existing spin finish instead of restarting its rotation on every tap.
    if (rapid && state === 'spin') { say(messages.spin); return; }
    play(rapid ? 'spin' : choices[tapCount++ % choices.length]);
  });
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || state !== 'idle' || performance.now() - lastReactionAt < 8000) return;
    lastReactionAt = performance.now();
    play('greet', { speak: false });
  });
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const delta = y - lastScrollY;
    lastScrollY = y;
    if (!canMove() || Math.abs(delta) < 1) return;
    const now = performance.now();
    const elapsed = Math.max(16, Math.min(100, now - lastScrollAt));
    speed = speed * .55 + (delta / elapsed * 1000) * .45;
    scrollDirection = Math.sign(delta);
    lastScrollAt = lastInputAt = now;
    clearIdle();
    if (action?.name === 'look') action = null;
    requestTick();
  }, { passive: true });
  document.addEventListener('toggle', (event) => {
    if (event.target.tagName !== 'DETAILS' || !event.target.open) return;
    const now = performance.now();
    if (now - lastReactionAt < 6000 || action) return;
    lastReactionAt = now;
    play('curious', { speak: false });
  }, true);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-map-place], #map-actions button, .leaflet-marker-icon')) play('map');
  });
  if ('IntersectionObserver' in window) {
    const visibleDays = new Map();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleDays.set(entry.target.id, entry.intersectionRatio);
        else visibleDays.delete(entry.target.id);
      }
      const nearest = [...visibleDays].sort((a, b) => b[1] - a[1])[0];
      if (nearest) day = nearest[0];
    }, { rootMargin: '-15% 0px -25% 0px', threshold: [0, .1, .25, .5, .75, 1] });
    document.querySelectorAll('section[id^="day"]').forEach(section => observer.observe(section));
  }
  function syncMotion() {
    clearIdle();
    clearTimeout(speechTimer);
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    action = null;
    speed = 0;
    lastScrollAt = -Infinity;
    lastScrollY = window.scrollY;
    lastInputAt = performance.now();
    for (const key of Object.keys(position)) position[key] = velocity[key] = 0;
    actor.style.transform = '';
    shadow.style.transform = '';
    shadow.style.opacity = '';
    dock.dataset.paused = String(!canMove());
    dock.dataset.speaking = 'false';
    setState('idle');
    setFrame(0);
    scheduleIdle();
  }
  document.addEventListener('visibilitychange', syncMotion);
  motion.addEventListener('change', syncMotion);
  syncMotion();
})();

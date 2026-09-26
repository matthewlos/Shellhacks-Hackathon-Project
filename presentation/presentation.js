/* A standalone presentation. No backend, telemetry, or dashboard runtime. */
(() => {
  'use strict';

  const root = document.documentElement;
  const chapters = [...document.querySelectorAll('.chapter')];
  const navLinks = [...document.querySelectorAll('.chapter-nav a')];
  const previous = document.querySelector('#previous-chapter');
  const next = document.querySelector('#next-chapter');
  const pageNumber = document.querySelector('#page-number');
  const navigationStatus = document.querySelector('#navigation-status');
  const motionButton = document.querySelector('#motion-toggle');
  const fullscreenButton = document.querySelector('#fullscreen-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rig = document.querySelector('.rig-layout');
  const cyclePlay = document.querySelector('#cycle-play');
  const cycleButtons = [...document.querySelectorAll('[data-cycle]')];
  const cycleTitle = document.querySelector('#cycle-title');
  const cycleDescription = document.querySelector('#cycle-description');
  const cycleAnnouncement = document.querySelector('#cycle-announcement');
  const moistureValue = document.querySelector('#moisture-value');
  // Example numbers for the drawing: 35% is box A's real minimum, 48% the example target.
  const stages = [
    { title: 'Soil at 32%', description: 'Below the 35% minimum. The temperature probe reads too, for context.', moisture: 32, duration: 2200 },
    { title: 'Laya calls for a pour', description: 'The ESP32 checks its safety rules, then switches the relay on.', moisture: 32, duration: 2200 },
    { title: 'Pouring', description: 'Water goes in and the probe keeps reading as the soil takes it up.', moisture: 32, duration: 4800 },
    { title: 'Stopped at 48%', description: 'The pump is off. Farm Hand keeps reading every second.', moisture: 48, duration: 3000 },
  ];

  let activeIndex = -1;
  let paused = reducedMotion.matches;
  let cycleIndex = 0;
  let cycleElapsed = 0;
  let cycleRunning = false;
  let cycleFinished = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let scrollFrame = 0;

  function announce(text, element = navigationStatus) {
    element.textContent = text;
  }

  function updateCycleButton() {
    if (reducedMotion.matches) {
      cyclePlay.textContent = 'Next step';
      return;
    }
    cyclePlay.textContent = cycleRunning && !paused ? 'Pause' : cycleFinished ? 'Replay' : cycleElapsed > 0 || cycleIndex > 0 ? 'Resume' : 'Play';
  }

  function setMotion(value) {
    paused = value;
    root.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    const label = reducedMotion.matches ? 'Reduced motion enabled by your device' : paused ? 'Resume animations' : 'Pause animations';
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    motionButton.disabled = reducedMotion.matches;
    updateCycleButton();
    syncAnimation();
  }

  function setActive(index) {
    if (activeIndex === index) return;
    activeIndex = index;
    chapters.forEach((section, i) => section.classList.toggle('is-active', i === index));
    navLinks.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    previous.disabled = index === 0;
    next.disabled = index === chapters.length - 1;
    pageNumber.textContent = `${index + 1} of 4`;
    syncAnimation();
  }

  function updateFromScroll() {
    scrollFrame = 0;
    const headerHeight = document.querySelector('.masthead').getBoundingClientRect().height;
    const probe = headerHeight + (window.innerHeight - headerHeight - 66) * 0.35;
    let index = 0;
    chapters.forEach((chapter, i) => {
      if (chapter.getBoundingClientRect().top <= probe) index = i;
    });
    setActive(index);
  }

  function navigate(index, { updateHash = true, speak = true } = {}) {
    const target = Math.max(0, Math.min(chapters.length - 1, index));
    chapters[target].scrollIntoView({ behavior: paused || reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    if (updateHash) history.pushState(null, '', `#${chapters[target].id}`);
    if (speak) announce(`Section ${target + 1} of 4. ${navLinks[target].textContent.trim()}.`);
    if (paused || reducedMotion.matches) setActive(target);
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const index = chapters.findIndex((section) => `#${section.id}` === link.getAttribute('href'));
      if (index < 0) return;
      event.preventDefault();
      navigate(index);
      // A skip link also moves keyboard focus past the fixed navigation.
      if (link.classList.contains('skip-link')) {
        chapters[index].tabIndex = -1;
        chapters[index].focus({ preventScroll: true });
      }
    });
  });

  previous.addEventListener('click', () => navigate(activeIndex - 1));
  next.addEventListener('click', () => navigate(activeIndex + 1));
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateFromScroll);
  }, { passive: true });
  window.addEventListener('resize', updateFromScroll);
  window.addEventListener('hashchange', () => {
    const index = chapters.findIndex((chapter) => `#${chapter.id}` === window.location.hash);
    if (index >= 0) navigate(index, { updateHash: false });
  });

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await root.requestFullscreen();
    } catch {
      announce('Fullscreen is unavailable in this browser. The presentation still works in this window.');
    }
  }
  fullscreenButton.hidden = !document.fullscreenEnabled;
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = `${label} (F)`;
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const interactive = event.target.closest('button, a, summary');
    if (interactive && [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      navigate(activeIndex + 1);
    } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      navigate(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      navigate(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      navigate(3);
    } else if (event.key.toLowerCase() === 'f' && !interactive) {
      event.preventDefault();
      toggleFullscreen();
    } else if (/^[1-4]$/.test(event.key) && !interactive) {
      event.preventDefault();
      navigate(Number(event.key) - 1);
    }
  });

  const soilButtons = [...document.querySelectorAll('[data-soil]')];
  soilButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const wet = button.dataset.soil === 'wet';
      document.querySelector('.problem-figure').dataset.water = button.dataset.soil;
      soilButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      document.querySelector('#soil-state-label').textContent = wet ? 'Soil too wet' : 'Soil too dry';
      document.querySelector('#soil-caption').textContent = wet
        ? 'Same pour every morning. After the rain it runs off the top.'
        : 'Same pour every morning. The soil dries out between pours.';
    });
  });

  function setMoisture(value) {
    const rounded = String(Math.round(value));
    if (moistureValue.textContent !== rounded) moistureValue.textContent = rounded;
    rig.style.setProperty('--moisture', `${value}%`);
  }

  function showStage(index, speak = true) {
    cycleIndex = index;
    cycleElapsed = 0;
    const stage = stages[index];
    rig.dataset.stage = String(index);
    rig.style.setProperty('--wet-scale', '.25');
    rig.style.setProperty('--cup-scale', '1');
    cycleTitle.textContent = stage.title;
    cycleDescription.textContent = stage.description;
    // Manual/reduced-motion viewing shows the water step at a representative midpoint.
    setMoisture(index === 2 && !cycleRunning ? 40 : stage.moisture);
    if (index === 2 && !cycleRunning) {
      cycleElapsed = stages[2].duration / 2;
      rig.style.setProperty('--wet-scale', '.65');
      rig.style.setProperty('--cup-scale', '.92');
    }
    cycleButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (speak) announce(`${stage.title} ${stage.description}`, cycleAnnouncement);
    updateCycleButton();
  }

  cycleButtons.forEach((button) => button.addEventListener('click', () => {
    cycleRunning = false;
    cycleFinished = false;
    showStage(Number(button.dataset.cycle));
    syncAnimation();
  }));

  cyclePlay.addEventListener('click', () => {
    if (reducedMotion.matches) {
      showStage((cycleIndex + 1) % stages.length);
      return;
    }
    if (paused) {
      cycleRunning = true;
      if (cycleFinished) { cycleFinished = false; showStage(0); }
      setMotion(false);
      return;
    }
    if (cycleFinished) {
      cycleFinished = false;
      showStage(0);
    }
    cycleRunning = !cycleRunning;
    updateCycleButton();
    syncAnimation();
  });

  document.querySelector('#cycle-reset').addEventListener('click', () => {
    cycleRunning = false;
    cycleFinished = false;
    showStage(0);
    syncAnimation();
  });

  function shouldAnimate() {
    return !paused && !document.hidden && activeIndex === 2 && cycleRunning;
  }

  function syncAnimation() {
    if (shouldAnimate() && !animationFrame) {
      lastFrame = 0;
      animationFrame = requestAnimationFrame(tick);
    } else if (!shouldAnimate() && animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrame = 0;
    }
  }

  function tick(now) {
    animationFrame = 0;
    if (!shouldAnimate()) return;
    const dt = lastFrame ? Math.min(now - lastFrame, 100) : 0;
    lastFrame = now;
    if (cycleRunning) {
      cycleElapsed += dt;
      if (cycleIndex === 2) {
        const fraction = Math.min(1, cycleElapsed / stages[2].duration);
        setMoisture(32 + fraction * 16);
        rig.style.setProperty('--wet-scale', String(.25 + fraction * .75));
        rig.style.setProperty('--cup-scale', String(1 - fraction * .16));
      }
      if (cycleElapsed >= stages[cycleIndex].duration) {
        if (cycleIndex < stages.length - 1) showStage(cycleIndex + 1);
        else {
          cycleRunning = false;
          cycleFinished = true;
          updateCycleButton();
          announce('Cycle done. The pump is off and Farm Hand keeps reading.', cycleAnnouncement);
        }
      }
    }
    if (shouldAnimate()) animationFrame = requestAnimationFrame(tick);
  }

  motionButton.addEventListener('click', () => setMotion(!paused));
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('page-hidden', document.hidden);
    syncAnimation();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) cycleRunning = false;
    setMotion(reducedMotion.matches);
  });

  root.classList.add('js-ready');
  setMotion(paused);
  updateFromScroll();
  // Native deep links are kept, including when the page is opened as a local file.
  const initial = chapters.findIndex((chapter) => `#${chapter.id}` === window.location.hash);
  if (initial >= 0) {
    requestAnimationFrame(() => {
      chapters[initial].scrollIntoView({ behavior: 'instant', block: 'start' });
      setActive(initial);
    });
  }
})();

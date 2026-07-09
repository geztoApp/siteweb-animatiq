const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Intro boot sequence */

const intro = document.querySelector("[data-intro]");
const hasSeenIntro = window.localStorage.getItem("animatiq-intro-seen");

if (intro) {
  const hideIntro = () => {
    intro.classList.add("is-hidden");
    intro.setAttribute("aria-hidden", "true");
    window.localStorage.setItem("animatiq-intro-seen", "true");
  };

  if (reduceMotion || hasSeenIntro === "true") {
    hideIntro();
  } else {
    window.setTimeout(hideIntro, 2600);
  }
}

/* Scroll reveal */

const revealNodes = document.querySelectorAll(".reveal");

revealNodes.forEach((node) => {
  const delay = Number(node.dataset.delay || 0);
  node.style.setProperty("--reveal-delay", `${delay}ms`);
});

if (!reduceMotion && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealNodes.forEach((node) => revealObserver.observe(node));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

/* Animated counters */

const counters = document.querySelectorAll("[data-count]");

const animateCounter = (node) => {
  const target = Number(node.dataset.count || 0);
  const duration = 1800;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = Math.round(target * eased).toLocaleString("fr-FR");

    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

if (!reduceMotion && "IntersectionObserver" in window) {
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.45 }
  );

  counters.forEach((counter) => counterObserver.observe(counter));
} else {
  counters.forEach((counter) => {
    counter.textContent = Number(counter.dataset.count || 0).toLocaleString("fr-FR");
  });
}

/* Mouse parallax */

const parallaxNodes = document.querySelectorAll("[data-parallax]");
const pointerFine = window.matchMedia("(pointer: fine)").matches;

parallaxNodes.forEach((node) => {
  node.style.setProperty("--parallax-x", "0px");
  node.style.setProperty("--parallax-y", "0px");
});

if (!reduceMotion && pointerFine && parallaxNodes.length > 0) {
  window.addEventListener("pointermove", (event) => {
    const xRatio = event.clientX / window.innerWidth - 0.5;
    const yRatio = event.clientY / window.innerHeight - 0.5;

    parallaxNodes.forEach((node) => {
      const strength = Number(node.dataset.parallax || 0) * 100;
      node.style.setProperty("--parallax-x", `${xRatio * strength}px`);
      node.style.setProperty("--parallax-y", `${yRatio * strength}px`);
    });
  });
}

/* Bonus scroll parallax on the background scene, only if GSAP loaded */

if (!reduceMotion && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  const scene = document.querySelector(".background-scene");

  if (scene) {
    gsap.to(scene, {
      yPercent: 8,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
      },
    });
  }
}

/* Discreet sound effects (Web Audio API, no external assets) */

let audioCtx;

const ensureAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

const playTone = (freq, delay, duration, type, gainValue) => {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = freq;
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  const startTime = ctx.currentTime + delay;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
};

const sounds = {
  coin: () => {
    playTone(988, 0, 0.09, "square", 0.045);
    playTone(1319, 0.08, 0.14, "square", 0.045);
  },
  click: () => playTone(660, 0, 0.06, "square", 0.03),
  success: () => {
    playTone(523, 0, 0.1, "triangle", 0.04);
    playTone(659, 0.09, 0.1, "triangle", 0.04);
    playTone(784, 0.18, 0.16, "triangle", 0.04);
  },
};

document.querySelectorAll("[data-sound]").forEach((node) => {
  node.addEventListener("click", () => {
    const sound = sounds[node.dataset.sound];
    if (sound) sound();
  });
});

/* Game demo modal */

const gameModal = document.querySelector("[data-game-modal]");
const gameModalFrame = document.querySelector("[data-game-modal-frame]");
let lastGameTrigger = null;

// TODO: replace with the real VPS URL once the counter server is deployed
// (see demo-counter-server/). Left blank means play counts are simply not reported.
const DEMO_COUNTER_API = "";

const reportDemoPlay = (slug) => {
  if (!DEMO_COUNTER_API || !slug) return;

  fetch(`${DEMO_COUNTER_API}/counters/${slug}/play`, { method: "POST" }).catch(() => {
    // Counter server unreachable — never block the demo over this.
  });
};

const openGameModal = (src, title, slug) => {
  if (!gameModal || !gameModalFrame) return;

  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = title || "Démo jouable";
  iframe.setAttribute("allow", "autoplay");
  gameModalFrame.replaceChildren(iframe);

  gameModal.classList.add("is-open");
  gameModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  reportDemoPlay(slug);

  const closeButton = gameModal.querySelector(".game-modal__close");
  if (closeButton) closeButton.focus();
};

const closeGameModal = () => {
  if (!gameModal || !gameModalFrame) return;

  gameModal.classList.remove("is-open");
  gameModal.setAttribute("aria-hidden", "true");
  gameModalFrame.replaceChildren();
  document.body.style.overflow = "";

  if (lastGameTrigger) lastGameTrigger.focus();
};

document.querySelectorAll("[data-game-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    lastGameTrigger = trigger;
    openGameModal(trigger.dataset.gameTrigger, trigger.dataset.gameTitle, trigger.dataset.gameSlug);
  });
});

document.querySelectorAll("[data-game-modal-close]").forEach((el) => {
  el.addEventListener("click", closeGameModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && gameModal && gameModal.classList.contains("is-open")) {
    closeGameModal();
  }
});

/* Contact form (no backend wired yet) */

const contactForm = document.querySelector("[data-contact-form]");
const contactNote = document.querySelector("[data-contact-note]");

if (contactForm && contactNote) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactNote.textContent = "Message envoyé ! On revient vers vous très vite. 🎉";
    contactForm.reset();
  });
}

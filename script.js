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
const gameModalHint = document.querySelector("[data-game-modal-hint]");
let lastGameTrigger = null;

const reportDemoPlay = (slug) => {
  if (!slug) return;

  fetch(`/api/counters/${slug}/play`, { method: "POST" }).catch(() => {
    // Counter API unreachable — never block the demo over this.
  });
};

const openGameModal = (src, title, slug) => {
  if (!gameModal || !gameModalFrame) return;

  if (lastGameTrigger) lastGameTrigger.blur();
  if (gameModalHint) gameModalHint.classList.remove("is-hidden");

  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = title || "Démo jouable";
  iframe.setAttribute("allow", "autoplay");
  iframe.addEventListener("load", () => iframe.focus());
  iframe.addEventListener("focus", () => {
    if (gameModalHint) gameModalHint.classList.add("is-hidden");
  });
  gameModalFrame.replaceChildren(iframe);

  gameModal.classList.add("is-open");
  gameModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  reportDemoPlay(slug);
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

/* Shared form-success toggler: hides a form completely and replaces it with
   a mascot + confirmation text, used by both the request modal and the
   plain contact form below. */

const createSuccessToggler = (form, success, successText, extraHideEls = []) => ({
  showSuccess: (message) => {
    if (form) form.hidden = true;
    extraHideEls.forEach((el) => {
      if (el) el.hidden = true;
    });
    if (success) {
      success.hidden = false;
      if (successText) successText.textContent = message;
    }
  },
  showForm: () => {
    if (success) success.hidden = true;
    extraHideEls.forEach((el) => {
      if (el) el.hidden = false;
    });
    if (form) form.hidden = false;
  },
});

/* Request modal (project/game inquiry form, pill-based — no typing required
   beyond name/email/optional details) */

const requestModal = document.querySelector("[data-request-modal]");
// Scoped to the modal — a bare [data-request-title] selector would also match
// the "Je veux ce projet" trigger buttons in the Réalisations cards, which
// carry the same attribute (as a data value) for a different purpose.
const requestTitleEl = requestModal ? requestModal.querySelector("[data-request-title]") : null;
const requestKickerEl = requestModal ? requestModal.querySelector(".request-modal__kicker") : null;
const requestMessageEl = document.querySelector("[data-request-message]");
const requestForm = document.querySelector("[data-request-form]");
const requestNote = document.querySelector("[data-request-note]");
const requestSuccessToggler = createSuccessToggler(
  requestForm,
  document.querySelector("[data-request-success]"),
  document.querySelector("[data-request-success-text]"),
  [requestKickerEl, requestTitleEl]
);
const showRequestSuccess = requestSuccessToggler.showSuccess;
const showRequestForm = requestSuccessToggler.showForm;

let lastRequestTrigger = null;
let requestProjectTitle = "";
let requestFormShownAt = null;

document.querySelectorAll("[data-pill-group]").forEach((group) => {
  const multi = group.hasAttribute("data-multi");
  group.addEventListener("click", (event) => {
    const button = event.target.closest(".pill-choice");
    if (!button || !group.contains(button)) return;

    if (multi) {
      const selected = !button.classList.contains("is-selected");
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    } else {
      group.querySelectorAll(".pill-choice").forEach((btn) => {
        const selected = btn === button;
        btn.classList.toggle("is-selected", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });
    }
  });
});

const resetRequestPills = () => {
  if (!requestForm) return;
  requestForm.querySelectorAll(".pill-choice.is-selected").forEach((btn) => {
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
  });
};

/* Step-by-step wizard: event type (multi-select) → concept (single-select) → details */

const REQUEST_STEP_ORDER = ["event-type", "concept", "details"];
const requestSteps = requestForm ? Array.from(requestForm.querySelectorAll("[data-request-step]")) : [];
let requestStepIndex = 0;

const showRequestStep = (index) => {
  requestStepIndex = index;
  requestSteps.forEach((step) => {
    step.hidden = step.dataset.requestStep !== REQUEST_STEP_ORDER[index];
  });
};

document.querySelectorAll("[data-step-next]").forEach((button) => {
  button.addEventListener("click", () => {
    const stepName = REQUEST_STEP_ORDER[requestStepIndex];
    const group = requestForm.querySelector(`[data-pill-group="${stepName}"]`);
    const hasSelection = group && group.querySelector(".pill-choice.is-selected");
    if (!hasSelection) {
      if (requestNote) requestNote.textContent = "Merci de choisir au moins une option pour continuer.";
      return;
    }
    if (requestNote) requestNote.textContent = "";
    showRequestStep(Math.min(requestStepIndex + 1, REQUEST_STEP_ORDER.length - 1));
  });
});

document.querySelectorAll("[data-step-back]").forEach((button) => {
  button.addEventListener("click", () => {
    if (requestNote) requestNote.textContent = "";
    showRequestStep(Math.max(requestStepIndex - 1, 0));
  });
});

const openRequestModal = (title) => {
  if (!requestModal) return;

  requestProjectTitle = title || "";
  requestFormShownAt = Date.now();

  if (requestTitleEl) requestTitleEl.textContent = title || "Un projet sur mesure";
  if (requestMessageEl) requestMessageEl.value = "";
  if (requestNote) requestNote.textContent = "";
  resetRequestPills();
  showRequestStep(0);
  showRequestForm();

  requestModal.classList.add("is-open");
  requestModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeRequestModal = () => {
  if (!requestModal) return;

  requestModal.classList.remove("is-open");
  requestModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  if (lastRequestTrigger) lastRequestTrigger.focus();
};

document.querySelectorAll("[data-request-trigger]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    lastRequestTrigger = trigger;
    openRequestModal(trigger.dataset.requestTitle);
  });
});

document.querySelectorAll("[data-request-modal-close]").forEach((el) => {
  el.addEventListener("click", closeRequestModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && requestModal && requestModal.classList.contains("is-open")) {
    closeRequestModal();
  }
});

/* Lightweight anti-spam guard shared by both forms below:
   - a honeypot field must stay empty (bots tend to fill in every field they find)
   - the form must have been visible for at least a couple seconds (bots submit
     near-instantly)
   Both checks fail *silently* — spam gets the same "success" message as a real
   submit, so a bot never learns it was caught, but nothing is actually sent
   once a real backend is wired up here. */

const MIN_HUMAN_FILL_TIME_MS = 2000;

const isLikelySpam = (form, shownAt) => {
  const honeypot = form.querySelector("[data-honeypot]");
  if (honeypot && honeypot.value.trim() !== "") return true;
  if (shownAt && Date.now() - shownAt < MIN_HUMAN_FILL_TIME_MS) return true;
  return false;
};

const submitToContactServer = async (payload) => {
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error("submit failed");
  return response.json();
};

if (requestForm && requestNote) {
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isLikelySpam(requestForm, requestFormShownAt)) {
      requestForm.reset();
      resetRequestPills();
      showRequestStep(0);
      showRequestSuccess("Demande envoyée ! On revient vers vous très vite.");
      return;
    }

    const eventPills = Array.from(
      requestForm.querySelectorAll('[data-pill-group="event-type"] .pill-choice.is-selected')
    );
    const conceptPill = requestForm.querySelector('[data-pill-group="concept"] .pill-choice.is-selected');

    if (!eventPills.length || !conceptPill) {
      requestNote.textContent = "Merci de compléter les étapes précédentes.";
      return;
    }

    const formData = new FormData(requestForm);
    const extra = (formData.get("message") || "").trim();
    const eventLabels = eventPills.map((pill) => pill.textContent.trim()).join(", ");
    const composedMessage = [
      `Type d'événement : ${eventLabels}`,
      `Le jeu doit mettre en avant : ${conceptPill.textContent.trim()}`,
      extra,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      eventType: eventPills.map((pill) => pill.dataset.value),
      concept: conceptPill.dataset.value,
      message: composedMessage,
      company: formData.get("company") || "",
      shownAt: requestFormShownAt,
      source: requestProjectTitle ? `request:${requestProjectTitle}` : "request",
    };

    try {
      await submitToContactServer(payload);
      requestForm.reset();
      resetRequestPills();
      showRequestStep(0);
      showRequestSuccess("Demande envoyée ! On revient vers vous très vite.");
    } catch {
      requestNote.textContent = "Oups, une erreur est survenue. Réessayez ou écrivez-nous directement.";
    }
  });
}

/* Contact form */

const contactForm = document.querySelector("[data-contact-form]");
const contactNote = document.querySelector("[data-contact-note]");
const contactFormShownAt = Date.now();
const contactSuccessToggler = createSuccessToggler(
  contactForm,
  document.querySelector("[data-contact-success]"),
  document.querySelector("[data-contact-success-text]")
);

if (contactForm && contactNote) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isLikelySpam(contactForm, contactFormShownAt)) {
      contactForm.reset();
      contactSuccessToggler.showSuccess("Message envoyé ! On revient vers vous très vite.");
      return;
    }

    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      eventType: "",
      message: formData.get("project"),
      company: formData.get("company") || "",
      shownAt: contactFormShownAt,
      source: "contact",
    };

    try {
      await submitToContactServer(payload);
      contactForm.reset();
      contactSuccessToggler.showSuccess("Message envoyé ! On revient vers vous très vite.");
    } catch {
      contactNote.textContent = "Oups, une erreur est survenue. Réessayez ou écrivez-nous directement.";
    }
  });
}

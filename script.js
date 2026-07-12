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

/* Request modal (project/game inquiry form, with an optional AI chat step) */

// TODO: set once chat-server (see chat-server/) is deployed, e.g. "https://your-vps.example/chat".
// Left blank means the modal skips straight to the plain form — nothing breaks either way.
const CHAT_API = "";

const requestModal = document.querySelector("[data-request-modal]");
const requestTitleEl = document.querySelector("[data-request-title]");
const requestMessageEl = document.querySelector("[data-request-message]");
const requestForm = document.querySelector("[data-request-form]");
const requestNote = document.querySelector("[data-request-note]");
const requestEventTypeSelect = requestForm ? requestForm.querySelector("select[name='event-type']") : null;

const requestChat = document.querySelector("[data-request-chat]");
const requestChatMessages = document.querySelector("[data-request-chat-messages]");
const requestChatForm = document.querySelector("[data-request-chat-form]");
const requestChatInput = document.querySelector("[data-request-chat-input]");
const requestChatFallback = document.querySelector("[data-request-chat-fallback]");
const requestSkipChatButton = document.querySelector("[data-request-skip-chat]");

let lastRequestTrigger = null;
let chatHistory = [];
let chatProjectTitle = "";
let chatBusy = false;
let requestFormShownAt = null;

const addChatBubble = (role, text) => {
  if (!requestChatMessages) return null;
  const bubble = document.createElement("div");
  bubble.className = `request-chat__bubble request-chat__bubble--${role}`;
  bubble.textContent = text;
  requestChatMessages.appendChild(bubble);
  requestChatMessages.scrollTop = requestChatMessages.scrollHeight;
  return bubble;
};

const addTypingBubble = () => {
  if (!requestChatMessages) return null;
  const bubble = document.createElement("div");
  bubble.className = "request-chat__bubble request-chat__bubble--assistant request-chat__bubble--typing";
  bubble.innerHTML =
    '<span class="request-chat__dot"></span><span class="request-chat__dot"></span><span class="request-chat__dot"></span>';
  requestChatMessages.appendChild(bubble);
  requestChatMessages.scrollTop = requestChatMessages.scrollHeight;
  return bubble;
};

const showFormDirectly = () => {
  requestFormShownAt = Date.now();
  if (requestChat) requestChat.hidden = true;
  if (requestForm) requestForm.hidden = false;
  const nameField = requestForm ? requestForm.querySelector("input[name='name']") : null;
  if (nameField) nameField.focus();
};

const completeChat = (eventType, message) => {
  if (requestEventTypeSelect && eventType) requestEventTypeSelect.value = eventType;
  if (requestMessageEl && message) requestMessageEl.value = message;
  showFormDirectly();
};

const sendChatMessage = async (userText) => {
  if (!CHAT_API || chatBusy) return;
  chatBusy = true;

  if (userText) {
    chatHistory.push({ role: "user", content: userText });
    addChatBubble("user", userText);
  }

  const typingBubble = addTypingBubble();

  try {
    const response = await fetch(`${CHAT_API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectTitle: chatProjectTitle, messages: chatHistory }),
    });

    if (!response.ok) throw new Error("chat request failed");

    const data = await response.json();
    if (typingBubble) typingBubble.remove();

    if (data.done) {
      addChatBubble(
        "assistant",
        "Parfait, j'ai tout ce qu'il faut ! Vérifiez le résumé ci-dessous et complétez vos coordonnées. 🎉"
      );
      completeChat(data.eventType, data.message);
    } else {
      chatHistory.push({ role: "assistant", content: data.reply });
      addChatBubble("assistant", data.reply);
    }
  } catch {
    if (typingBubble) typingBubble.remove();
    if (requestChatFallback) requestChatFallback.hidden = false;
  } finally {
    chatBusy = false;
  }
};

if (requestChatForm) {
  requestChatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = requestChatInput.value.trim();
    if (!text) return;
    requestChatInput.value = "";
    sendChatMessage(text);
  });
}

if (requestSkipChatButton) {
  requestSkipChatButton.addEventListener("click", showFormDirectly);
}

const openRequestModal = (title) => {
  if (!requestModal) return;

  chatProjectTitle = title || "";
  chatHistory = [];
  chatBusy = false;

  if (requestTitleEl) requestTitleEl.textContent = title || "Un projet sur mesure";
  if (requestMessageEl) requestMessageEl.value = "";
  if (requestEventTypeSelect) requestEventTypeSelect.value = "";
  if (requestChatMessages) requestChatMessages.replaceChildren();
  if (requestChatFallback) requestChatFallback.hidden = true;

  if (CHAT_API) {
    if (requestChat) requestChat.hidden = false;
    if (requestForm) requestForm.hidden = true;
    sendChatMessage(null);
  } else {
    if (requestMessageEl && title) {
      requestMessageEl.value = `Je suis intéressé(e) par : ${title}.\n\n`;
    }
    showFormDirectly();
  }

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

// TODO: set once contact-server (see contact-server/) is deployed, e.g.
// "https://your-vps.example". Left blank means both forms below keep their
// old fake-success behaviour — nothing breaks either way.
const CONTACT_API = "";

const submitToContactServer = async (payload) => {
  if (!CONTACT_API) return { ok: true };

  const response = await fetch(`${CONTACT_API}/submit`, {
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
      requestNote.textContent = "Demande envoyée ! On revient vers vous très vite. 🎉";
      requestForm.reset();
      return;
    }

    const formData = new FormData(requestForm);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      eventType: formData.get("event-type") || "",
      message: formData.get("message"),
      company: formData.get("company") || "",
      shownAt: requestFormShownAt,
      source: chatProjectTitle ? `request:${chatProjectTitle}` : "request",
    };

    try {
      await submitToContactServer(payload);
      requestNote.textContent = "Demande envoyée ! On revient vers vous très vite. 🎉";
      requestForm.reset();
    } catch {
      requestNote.textContent = "Oups, une erreur est survenue. Réessayez ou écrivez-nous directement.";
    }
  });
}

/* Contact form */

const contactForm = document.querySelector("[data-contact-form]");
const contactNote = document.querySelector("[data-contact-note]");
const contactFormShownAt = Date.now();

if (contactForm && contactNote) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isLikelySpam(contactForm, contactFormShownAt)) {
      contactNote.textContent = "Message envoyé ! On revient vers vous très vite. 🎉";
      contactForm.reset();
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
      contactNote.textContent = "Message envoyé ! On revient vers vous très vite. 🎉";
      contactForm.reset();
    } catch {
      contactNote.textContent = "Oups, une erreur est survenue. Réessayez ou écrivez-nous directement.";
    }
  });
}

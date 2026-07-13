const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const toastRegion = document.querySelector("[data-toast]");
let toastTimer;

export function showToast(message, tone = "info") {
  if (!toastRegion) return;
  window.clearTimeout(toastTimer);
  toastRegion.textContent = message;
  toastRegion.dataset.tone = tone;
  toastRegion.dataset.visible = "true";
  toastTimer = window.setTimeout(() => {
    toastRegion.dataset.visible = "false";
  }, 3600);
}

export function safeStorage() {
  try {
    const key = "__forge_atlas_storage_test__";
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return null;
  }
}

function closeNav() {
  if (!nav || !navToggle) return;
  nav.dataset.open = "false";
  navToggle.setAttribute("aria-expanded", "false");
}

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const willOpen = nav.dataset.open !== "true";
    nav.dataset.open = String(willOpen);
    navToggle.setAttribute("aria-expanded", String(willOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.dataset.open === "true") {
      closeNav();
      navToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 981px)").matches) closeNav();
  });
}

document.querySelectorAll("[data-filter-group]").forEach((group) => {
  const targetSelector = group.dataset.filterTarget;
  const target = targetSelector ? document.querySelector(targetSelector) : group.parentElement;
  if (!target) return;

  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    const filter = button.dataset.filter;

    group.querySelectorAll("[data-filter]").forEach((candidate) => {
      candidate.setAttribute("aria-pressed", String(candidate === button));
    });

    target.querySelectorAll("[data-filter-item]").forEach((item) => {
      const categories = (item.dataset.filterItem || "").split(/\s+/);
      item.hidden = filter !== "all" && !categories.includes(filter);
    });
  });
});

document.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy]");
  if (!copyButton) return;
  const selector = copyButton.dataset.copy;
  const source = selector ? document.querySelector(selector) : null;
  const value = source?.value ?? source?.textContent ?? "";
  if (!value.trim()) return;

  try {
    await navigator.clipboard.writeText(value.trim());
    showToast("Copied to clipboard.", "success");
  } catch {
    showToast("Clipboard access is unavailable in this browser.", "error");
  }
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const saveData = Boolean(navigator.connection?.saveData);
const motionEnabled = !reducedMotion.matches && !saveData;
const root = document.documentElement;

root.classList.add("motion-ready");

function initScrollProgress() {
  const meter = document.querySelector("[data-scroll-progress]");
  if (!meter) return;
  let queued = false;

  const update = () => {
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    meter.style.setProperty("--scroll-progress", String(Math.min(1, Math.max(0, window.scrollY / range))));
    queued = false;
  };

  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  update();
}

function initPointerField() {
  const pointer = document.querySelector("[data-cinema-pointer]");
  if (!pointer || !precisePointer.matches) return;

  window.addEventListener("pointermove", (event) => {
    root.style.setProperty("--pointer-x", `${event.clientX}px`);
    root.style.setProperty("--pointer-y", `${event.clientY}px`);
  }, { passive: true });
}

function initReveals() {
  const selectors = [
    ".section-heading",
    ".section > .card-grid > .card",
    ".card-grid > .card",
    ".truth-grid > .truth-item",
    ".metric-strip > .metric",
    ".fight-setup > .panel",
    ".mission-setup > .panel",
    ".feed-list > .feed-item",
    ".site-footer"
  ];
  const nodes = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
  nodes.forEach((node, index) => {
    node.dataset.reveal = "";
    node.dataset.revealOrder = String(index % 4);
  });

  if (!motionEnabled || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.dataset.revealed = "true");
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.dataset.revealed = "true";
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
  nodes.forEach((node) => observer.observe(node));
}

function initDepthScenes() {
  if (!motionEnabled || !precisePointer.matches) return;
  document.querySelectorAll("[data-depth-scene]").forEach((scene) => {
    const layers = [...scene.querySelectorAll("[data-depth]")];
    if (!layers.length) return;

    scene.addEventListener("pointermove", (event) => {
      const bounds = scene.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      layers.forEach((layer) => {
        const depth = Number(layer.dataset.depth) || 0.2;
        layer.style.translate = `${(x * depth * 32).toFixed(2)}px ${(y * depth * 24).toFixed(2)}px`;
      });
    }, { passive: true });

    scene.addEventListener("pointerleave", () => {
      layers.forEach((layer) => layer.style.translate = "0 0");
    }, { passive: true });
  });
}

function initInteractiveSurfaces() {
  if (!motionEnabled || !precisePointer.matches) return;

  document.querySelectorAll("[data-tilt]").forEach((surface) => {
    surface.addEventListener("pointermove", (event) => {
      const bounds = surface.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      surface.style.setProperty("--tilt-x", `${((0.5 - y) * 7).toFixed(2)}deg`);
      surface.style.setProperty("--tilt-y", `${((x - 0.5) * 7).toFixed(2)}deg`);
      surface.style.setProperty("--glow-x", `${(x * 100).toFixed(1)}%`);
      surface.style.setProperty("--glow-y", `${(y * 100).toFixed(1)}%`);
    }, { passive: true });

    surface.addEventListener("pointerleave", () => {
      surface.style.setProperty("--tilt-x", "0deg");
      surface.style.setProperty("--tilt-y", "0deg");
      surface.style.setProperty("--glow-x", "50%");
      surface.style.setProperty("--glow-y", "50%");
    }, { passive: true });
  });

  document.querySelectorAll("[data-magnetic]").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const bounds = button.getBoundingClientRect();
      const x = event.clientX - bounds.left - bounds.width / 2;
      const y = event.clientY - bounds.top - bounds.height / 2;
      button.style.transform = `translate3d(${(x * 0.12).toFixed(2)}px, ${(y * 0.16).toFixed(2)}px, 0)`;
    }, { passive: true });
    button.addEventListener("pointerleave", () => button.style.transform = "", { passive: true });
  });
}

function initAtmosphere() {
  const canvas = document.querySelector("[data-cinema-canvas]");
  const context = canvas?.getContext("2d", { alpha: true });
  if (!canvas || !context || !motionEnabled) {
    if (canvas) canvas.hidden = true;
    return;
  }

  let width = 0;
  let height = 0;
  let frame = 0;
  let particles = [];
  const pointer = { x: -1000, y: -1000 };

  function buildParticles() {
    const count = Math.max(22, Math.min(48, Math.round(width / 32)));
    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.13,
      vy: -0.05 - Math.random() * 0.16,
      radius: 0.45 + Math.random() * 1.05,
      alpha: 0.16 + Math.random() * 0.46,
      cyan: index % 3 === 0
    }));
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildParticles();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    particles.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.y < -8) { particle.y = height + 8; particle.x = Math.random() * width; }
      if (particle.x < -8) particle.x = width + 8;
      if (particle.x > width + 8) particle.x = -8;

      const pointerDistance = Math.hypot(particle.x - pointer.x, particle.y - pointer.y);
      const pointerLift = pointerDistance < 190 ? (190 - pointerDistance) / 190 : 0;
      context.beginPath();
      context.fillStyle = particle.cyan
        ? `rgba(80, 215, 232, ${particle.alpha + pointerLift * 0.24})`
        : `rgba(242, 205, 121, ${particle.alpha + pointerLift * 0.2})`;
      context.arc(particle.x, particle.y, particle.radius + pointerLift, 0, Math.PI * 2);
      context.fill();

      for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
        const other = particles[otherIndex];
        const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
        if (distance > 112) continue;
        context.beginPath();
        context.strokeStyle = `rgba(150, 188, 190, ${(1 - distance / 112) * 0.055})`;
        context.lineWidth = 0.5;
        context.moveTo(particle.x, particle.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }
    });
  }

  function tick() {
    if (!document.hidden) {
      frame += 1;
      if (frame % 2 === 0) draw();
    }
    window.requestAnimationFrame(tick);
  }

  if (precisePointer.matches) {
    window.addEventListener("pointermove", (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }, { passive: true });
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();
  tick();
}

initScrollProgress();
initPointerField();
initReveals();
initDepthScenes();
initInteractiveSurfaces();
initAtmosphere();

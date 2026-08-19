/**
 * Lightweight motion-safe confetti burst.
 * Bypassed entirely when prefers-reduced-motion is active.
 */
export function fireMotionSafeConfetti() {
  if (typeof window === "undefined") return;

  // Strict check for prefers-reduced-motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const colors = ["#0F766E", "#14B8A6", "#2563EB", "#7C3AED", "#F59E0B", "#EF4444", "#10B981"];
  const particles: {
    x: number;
    y: number;
    size: number;
    color: string;
    vx: number;
    vy: number;
    rotation: number;
    rotSpeed: number;
    alpha: number;
  }[] = [];

  const count = 45;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight * 0.6,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 10 + 6),
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      alpha: 1,
    });
  }

  let animationFrame: number;
  const startTime = Date.now();

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const elapsed = Date.now() - startTime;
    let alive = false;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.rotSpeed;
      p.alpha = Math.max(0, 1 - elapsed / 1800);

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    if (alive && elapsed < 1800) {
      animationFrame = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrame);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    }
  }

  render();
}

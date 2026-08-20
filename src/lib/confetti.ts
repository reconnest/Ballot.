/**
 * Lightweight motion-safe confetti burst.
 * Bypassed entirely when prefers-reduced-motion is active.
 * Launches directly from the submit button's screen coordinates.
 */
export function fireMotionSafeConfetti(originX?: number, originY?: number) {
  if (typeof window === "undefined") return;

  // Strict check for prefers-reduced-motion
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }
  ctx.scale(dpr, dpr);

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

  const startX = typeof originX === "number" && !isNaN(originX) ? originX : window.innerWidth / 2;
  const startY = typeof originY === "number" && !isNaN(originY) ? originY : window.innerHeight * 0.6;

  const count = 65;
  for (let i = 0; i < count; i++) {
    // Fan out upward between 210 deg (top-left) to 330 deg (top-right)
    const angle = ((210 + Math.random() * 120) * Math.PI) / 180;
    const speed = Math.random() * 13 + 6;

    particles.push({
      x: startX + (Math.random() - 0.5) * 20,
      y: startY,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 14,
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

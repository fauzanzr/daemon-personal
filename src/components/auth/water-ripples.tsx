'use client';

import { useEffect, useRef } from 'react';

interface Droplet {
  x: number;
  y: number;
  targetY: number;
  speed: number;
  length: number;
  alpha: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  alpha: number;
  rings: number;
}

/** Monochrome matte-black & white ambient raindrop + gathering water-ripple animation. */
export function WaterRipples() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const droplets: Droplet[] = [];
    const ripples: Ripple[] = [];

    function spawnRipple(x: number, y: number, maxRadius?: number) {
      ripples.push({
        x,
        y,
        radius: 2,
        maxRadius: maxRadius ?? 65 + Math.random() * 95,
        speed: 0.45 + Math.random() * 0.45,
        alpha: 0.24 + Math.random() * 0.14,
        rings: Math.random() > 0.4 ? 3 : 2,
      });
      if (ripples.length > 42) ripples.shift();
    }

    function spawnDroplet() {
      const x = Math.random() * width;
      const targetY = height * (0.2 + Math.random() * 0.72);
      droplets.push({
        x,
        y: -20 - Math.random() * 140,
        targetY,
        speed: 3.2 + Math.random() * 2.8,
        length: 12 + Math.random() * 16,
        alpha: 0.14 + Math.random() * 0.18,
      });
    }

    // Seed a few soft ripples so the screen feels alive right away
    for (let i = 0; i < 6; i++) {
      spawnRipple(Math.random() * width, Math.random() * height);
    }

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const onPointerDown = (e: PointerEvent) => {
      spawnRipple(e.clientX, e.clientY, 120);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onPointerDown);

    let raf = 0;
    let tick = 0;

    function frame() {
      if (!ctx) return;
      // Soft trail clear for smooth matte fade
      ctx.fillStyle = 'rgba(11, 11, 11, 0.28)';
      ctx.fillRect(0, 0, width, height);

      tick++;
      if (!reduced && tick % 26 === 0 && droplets.length < 18) {
        spawnDroplet();
      }

      // Draw falling droplets
      for (let i = droplets.length - 1; i >= 0; i--) {
        const d = droplets[i];
        d.y += d.speed;

        const grad = ctx.createLinearGradient(d.x, d.y - d.length, d.x, d.y);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(1, `rgba(255, 255, 255, ${d.alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - d.length);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();

        if (d.y >= d.targetY) {
          spawnRipple(d.x, d.targetY);
          droplets.splice(i, 1);
        }
      }

      // Draw gathering & slowly fading concentric water ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        const progress = r.radius / r.maxRadius;
        if (progress >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        // Smooth ease-out fade
        const fade = Math.pow(1 - progress, 1.8) * r.alpha;

        for (let ring = 0; ring < r.rings; ring++) {
          const ringRadius = r.radius - ring * 12;
          if (ringRadius <= 0) continue;
          const ringAlpha = fade * (1 - ring * 0.28);
          if (ringAlpha <= 0.004) continue;

          ctx.strokeStyle = `rgba(255, 255, 255, ${ringAlpha.toFixed(4)})`;
          ctx.lineWidth = ring === 0 ? 1.1 : 0.7;
          ctx.beginPath();
          // Subtle perspective ellipse like calm water surface
          ctx.ellipse(r.x, r.y, ringRadius, ringRadius * 0.62, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, height);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 h-full w-full" aria-hidden="true" />;
}

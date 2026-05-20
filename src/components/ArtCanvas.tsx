/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { AudioFeatures, HandData, SwirlParticle, VisualElement } from '../types';

// Fused Master Artist Palette - raw traditional natural earth & pigment tones with zero digital neon feel
const MASTER_PALETTE = {
  bg: '#F5F2E6', // Premium warm artistic parchment paper with rich texture
  // A mixed array of high-end traditional paint pigments matches the provided images
  strokes: [
    '#C23122', // Cadmium Red Deep
    '#1B447A', // Cobalt Blue
    '#DCA124', // Warm Ochre / Sunflower Yellow
    '#2E5336', // Cypress green / Viridian
    '#7D2B1C', // Burnt Sienna / Madder Root
    '#574744', // Raw Umber
    '#E52D50', // Alizarin Magenta Crimson
    '#12718E', // Prussian Teal / Cerulean Blue
    '#F1981F', // Chrome Yellow / Orange
    '#10865E', // Vibrant Jade Green
    '#4E2A78', // Plum / Dark Indigo Violet
    '#EC6A8B', // Wild Rose Pink
    '#EFA18A', // Peach Vermillion
  ],
  accents: [
    '#1A1A1A', // Ivory Black
    '#DFD5B9', // Linen wash gray
    '#FAFAF7', // Cream White mask pigment
  ],
  watercolors: [
    'rgba(24,68,122,0.06)',   // Indigo diluent
    'rgba(194,49,34,0.06)',   // Red bleed
    'rgba(220,161,36,0.06)',  // Ochre wash
    'rgba(46,83,54,0.06)',    // Forest wash
    'rgba(229,45,80,0.05)',   // Magenta / Pink wash
    'rgba(18,113,142,0.05)'   // Teal wash
  ]
};

interface ResetDot {
  x: number;
  y: number;
  baseRadius: number;
  hue: number;
  sat: number;
  light: number;
  variance: number[];
  speedX: number;
  speedY: number;
}

interface ArtCanvasProps {
  audioFeatures: AudioFeatures | null;
  handData: HandData | null;
  paintActive: boolean;
  onClearTriggered?: () => void;
  clearTriggerRef?: React.MutableRefObject<(() => void) | null>;
}

export const ArtCanvas: React.FC<ArtCanvasProps> = ({
  audioFeatures,
  handData,
  paintActive,
  onClearTriggered,
  clearTriggerRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Two main visible canvases:
  // 1. Accumulative painting canvas (re-rendered crisp every frame)
  // 2. Active HUD canvas (renders hand skeleton feedback and active vocal coordinate crosshairs)
  const paintingCanvasRef = useRef<HTMLCanvasElement>(null);
  const hudCanvasRef = useRef<HTMLCanvasElement>(null);

  // High-performance double-buffering cache canvases:
  // - bgCanvasRef: Holds the pre-rendered, high-fidelity textured parchment paper to bypass costly redraws
  // - offscreenCanvasRef: Keeps continuously accumulating watercolor washes and starry particle feeds
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Hardcode rigid 1280x720 composition internal dimensions
  const COMP_WIDTH = 1280;
  const COMP_HEIGHT = 720;
  
  const [clearImpactProgress, setClearImpactProgress] = useState(0); // Fist gesture clearing splash progress

  // References for drawing state
  const particlesRef = useRef<SwirlParticle[]>([]);
  const geometriesRef = useRef<VisualElement[]>([]);
  const frameCountRef = useRef<number>(0);
  const flowFieldAngleRef = useRef<number>(0);
  const lastStateHandFistRef = useRef<boolean>(false);
  const resetDotsRef = useRef<ResetDot[]>([]);

  // Input smoothing for seamless continuous visuals
  const smoothPitchRef = useRef<number>(440);
  const smoothAmpRef = useRef<number>(0);
  const smoothTimbreRef = useRef<{ warm: number; bright: number }>({ warm: 0.5, bright: 0.5 });

  // Canvas background paper texture generator
  const drawPerfectBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = MASTER_PALETTE.bg;
    ctx.fillRect(0, 0, COMP_WIDTH, COMP_HEIGHT);

    // Fine, classical dry-point margins / golden borders
    ctx.strokeStyle = 'rgba(0,0,0,0.035)';
    ctx.lineWidth = 1;
    ctx.strokeRect(COMP_WIDTH * 0.04, COMP_HEIGHT * 0.04, COMP_WIDTH * 0.92, COMP_HEIGHT * 0.92);
    ctx.strokeRect(COMP_WIDTH * 0.042, COMP_HEIGHT * 0.042, COMP_WIDTH * 0.916, COMP_HEIGHT * 0.916);

    // Warm museum physical vignette wash
    const radialGrad = ctx.createRadialGradient(
      COMP_WIDTH / 2, 
      COMP_HEIGHT / 2, 
      COMP_HEIGHT * 0.45, 
      COMP_WIDTH / 2, 
      COMP_HEIGHT / 2, 
      COMP_WIDTH * 0.75
    );
    radialGrad.addColorStop(0, 'rgba(0,0,0,0)');
    radialGrad.addColorStop(1, 'rgba(110,95,80,0.06)');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, COMP_WIDTH, COMP_HEIGHT);

    // Subtle watercolor paper fiber noise
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(128,128,128,0.06)';
    for (let i = 0; i < 600; i++) {
      const px = Math.random() * COMP_WIDTH;
      const py = Math.random() * COMP_HEIGHT;
      const pw = Math.random() * 3 + 1;
      const ph = Math.random() * 3 + 1;
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.restore();
  };

  // Seeding initial constructivist layout framework of vertical & horizontal axes
  const generateInitialMasterFramework = () => {
    // Elegant, uncluttered canvas has no static background axes lines!
  };

  useEffect(() => {
    if (geometriesRef.current.length === 0) {
      generateInitialMasterFramework();
    }
  }, []);

  const clearPaintCanvas = () => {
    const pCanvas = paintingCanvasRef.current;
    if (!pCanvas) return;
    const ctx = pCanvas.getContext('2d');
    if (!ctx) return;

    particlesRef.current = [];
    geometriesRef.current = [];

    // Reset accumulated transparency paint layer
    if (offscreenCanvasRef.current) {
      const offCtx = offscreenCanvasRef.current.getContext('2d');
      if (offCtx) {
        offCtx.clearRect(0, 0, COMP_WIDTH, COMP_HEIGHT);
      }
    }

    ctx.clearRect(0, 0, COMP_WIDTH, COMP_HEIGHT);
    if (bgCanvasRef.current) {
      ctx.drawImage(bgCanvasRef.current, 0, 0, COMP_WIDTH, COMP_HEIGHT);
    } else {
      drawPerfectBackground(ctx);
    }

    // Always reseed the majestic axis system on clear
    generateInitialMasterFramework();

    // Generate colorful irregular warm/pastel dots for the soft bleeding/smudging reset animation
    const dotsCount = 14 + Math.floor(Math.random() * 8); // 14 to 21 dots
    const newDots: ResetDot[] = [];
    for (let i = 0; i < dotsCount; i++) {
      newDots.push({
        x: Math.random() * COMP_WIDTH,
        y: Math.random() * COMP_HEIGHT,
        baseRadius: 35 + Math.random() * 65, // Soft, beautiful sizes
        hue: Math.floor(Math.random() * 360),
        sat: 60 + Math.floor(Math.random() * 15), // Soft pastel saturation
        light: 74 + Math.floor(Math.random() * 10), // Not too dark, beautifully light and airy
        variance: Array.from({ length: 8 }, () => Math.random() * 0.5 - 0.25), // shape irregularity vertices
        speedX: (Math.random() - 0.5) * 1.8, // Elegant drifting speeds
        speedY: (Math.random() - 0.5) * 1.8,
      });
    }
    resetDotsRef.current = newDots;

    setClearImpactProgress(0.01);
  };

  // Assign the clear action trigger ref so the parent App can trigger it via btn
  if (clearTriggerRef) {
    clearTriggerRef.current = clearPaintCanvas;
  }

  // Monitor hand poses for the fist gesture to trigger clearances
  useEffect(() => {
    if (handData && handData.present && handData.isFist) {
      if (!lastStateHandFistRef.current) {
        clearPaintCanvas();
        if (onClearTriggered) onClearTriggered();
      }
    }
    if (handData) {
      lastStateHandFistRef.current = handData.isFist;
    }
  }, [handData]);

  // Clean-up animation frame loop
  useEffect(() => {
    if (clearImpactProgress > 0) {
      const frame = requestAnimationFrame(() => {
        setClearImpactProgress((p) => (p >= 1.0 ? 0 : p + 0.02));
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [clearImpactProgress]);

  // Main Render initialization
  useEffect(() => {
    const pCanvas = paintingCanvasRef.current;
    const hCanvas = hudCanvasRef.current;
    if (!pCanvas || !hCanvas) return;

    // Secure the canvases to look sharp on high DPI screens
    const setupCanvasSizing = () => {
      const dpr = window.devicePixelRatio || 1;
      
      pCanvas.width = COMP_WIDTH * dpr;
      pCanvas.height = COMP_HEIGHT * dpr;
      pCanvas.style.width = '100%';
      pCanvas.style.height = '100%';

      hCanvas.width = COMP_WIDTH * dpr;
      hCanvas.height = COMP_HEIGHT * dpr;
      hCanvas.style.width = '100%';
      hCanvas.style.height = '100%';

      // Setup cache background paper once with matching high-DPI scaling
      if (!bgCanvasRef.current) {
        bgCanvasRef.current = document.createElement('canvas');
      }
      bgCanvasRef.current.width = COMP_WIDTH * dpr;
      bgCanvasRef.current.height = COMP_HEIGHT * dpr;
      const bgCtx = bgCanvasRef.current.getContext('2d');
      if (bgCtx) {
        bgCtx.scale(dpr, dpr);
        drawPerfectBackground(bgCtx);
      }

      // Setup transparent watercolor accumulation layer with matching high-DPI scaling
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      offscreenCanvasRef.current.width = COMP_WIDTH * dpr;
      offscreenCanvasRef.current.height = COMP_HEIGHT * dpr;
      const offCtx = offscreenCanvasRef.current.getContext('2d');
      if (offCtx) {
        offCtx.scale(dpr, dpr);
      }

      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        pCtx.scale(dpr, dpr);
        if (bgCanvasRef.current) {
          pCtx.drawImage(bgCanvasRef.current, 0, 0, COMP_WIDTH, COMP_HEIGHT);
        }
      }
      const hCtx = hCanvas.getContext('2d');
      if (hCtx) {
        hCtx.scale(dpr, dpr);
      }
    };

    setupCanvasSizing();

    const pCtx = pCanvas.getContext('2d');
    const hCtx = hCanvas.getContext('2d');
    if (!pCtx || !hCtx) return;

    let loopId: number;

    const gameLoop = () => {
      frameCountRef.current++;

      // 1. Smoothly map live audio feeds to visual features
      if (audioFeatures && paintActive && !audioFeatures.isBreathingPause) {
        smoothAmpRef.current += (audioFeatures.amplitude - smoothAmpRef.current) * 0.15;
        if (audioFeatures.pitch > 0) {
          smoothPitchRef.current += (audioFeatures.pitch - smoothPitchRef.current) * 0.15;
        }
        smoothTimbreRef.current.warm += (audioFeatures.timbreWarm - smoothTimbreRef.current.warm) * 0.12;
        smoothTimbreRef.current.bright += (audioFeatures.timbreBright - smoothTimbreRef.current.bright) * 0.12;
      } else {
        smoothAmpRef.current += (0 - smoothAmpRef.current) * 0.08;
      }

      const activeAmp = smoothAmpRef.current;
      const activePitch = smoothPitchRef.current;
      const activeWarm = smoothTimbreRef.current.warm;
      const activeBright = smoothTimbreRef.current.bright;

      // 2. Expressionist Watercolor pause damp bleeding (affects offscreen watercolor layer softly)
      if (audioFeatures?.isBreathingPause && paintActive && offscreenCanvasRef.current) {
        const offCtx = offscreenCanvasRef.current.getContext('2d');
        if (offCtx) {
          offCtx.save();
          offCtx.globalCompositeOperation = 'destination-out';
          offCtx.globalAlpha = 0.0018; // Slowly evaporates underlying pigments beautifully
          offCtx.fillStyle = '#000';
          offCtx.fillRect(0, 0, COMP_WIDTH, COMP_HEIGHT);
          offCtx.restore();

          if (frameCountRef.current % 15 === 0) {
            offCtx.save();
            offCtx.filter = 'blur(1.0px)';
            offCtx.drawImage(offscreenCanvasRef.current, 0, 0);
            offCtx.filter = 'none';
            offCtx.restore();
          }
        }
      }

      // 3. Fused Interactive Spawning (watercolor seeps and starry sweeps are accumulated on offscreen)
      if (paintActive && activeAmp > 0.012 && audioFeatures && !audioFeatures.isBreathingPause) {
        
        // Dynamic pitch map parameters (Logical golden spacing octaves)
        const pitchNorm = Math.min(1.0, Math.max(0.0, (Math.log2(activePitch) - 6.5) / 4.0));
        const targetY = COMP_HEIGHT * 0.15 + (1.0 - pitchNorm) * COMP_HEIGHT * 0.7;

        // Elegant geometric back-and-forth sweep coordinates (axial linear symmetry)
        const composerSweepAngle = frameCountRef.current * 0.005;
        const targetX = COMP_WIDTH * 0.15 + (Math.sin(composerSweepAngle) * 0.5 + 0.5) * COMP_WIDTH * 0.7;

        // Harmonize strokes tones
        let elementColor = MASTER_PALETTE.strokes[Math.floor(pitchNorm * MASTER_PALETTE.strokes.length) % MASTER_PALETTE.strokes.length];
        if (activeBright > 0.62) {
          elementColor = MASTER_PALETTE.accents[0]; // Stark Ivory Black anchor stroke
        } else if (activeWarm > 0.6) {
          elementColor = MASTER_PALETTE.strokes[0]; // Saturated Cadmium Crimson
        }

        // A. Swirling starry particle strings (renders cumulatively on offscreen paint layer)
        if (offscreenCanvasRef.current) {
          const strokeQuantity = Math.floor(activeAmp * 16) + 1;
          for (let i = 0; i < strokeQuantity; i++) {
            const spread = Math.max(10, activeAmp * 200);
            const px = targetX + (Math.random() - 0.5) * spread;
            const py = targetY + (Math.random() - 0.5) * spread;

            const scatterAngle = Math.random() * Math.PI * 2;
            const initialSpeed = (0.5 + Math.random() * 2.2) * (1 + activeAmp * 4.5);

            particlesRef.current.push({
              x: px,
              y: py,
              vx: Math.cos(scatterAngle) * initialSpeed,
              vy: Math.sin(scatterAngle) * initialSpeed,
              color: elementColor,
              size: (1.5 + Math.random() * 3.5) * (0.8 + activeAmp * 15),
              alpha: 0.16 + activeAmp * 0.64,
              life: 0,
              maxLife: 35 + Math.floor(Math.random() * 70)
            });
          }
        }

        // B. Large watercolor washes (accumulates on offscreen background layer)
        if (audioFeatures.energyLow > 0.35 && frameCountRef.current % 12 === 0 && offscreenCanvasRef.current) {
          const offCtx = offscreenCanvasRef.current.getContext('2d');
          if (offCtx) {
            offCtx.save();
            const washColor = MASTER_PALETTE.watercolors[Math.floor(Math.random() * MASTER_PALETTE.watercolors.length)];
            offCtx.fillStyle = washColor;

            const rx = targetX + (Math.random() - 0.5) * 200;
            const ry = targetY + (Math.random() - 0.5) * 200;
            const baseRadius = 55 + Math.random() * 160 * audioFeatures.energyLow;

            for (let step = 3; step > 0; step--) {
              offCtx.beginPath();
              offCtx.arc(rx, ry, baseRadius * (step / 3), 0, Math.PI * 2);
              offCtx.globalAlpha = 0.012 * (4 - step);
              offCtx.fill();
            }
            offCtx.restore();
          }
        }

        // C. Clean geometric structure anchoring (Kandinsky Geometry maps)
        // Spawn elements on sudden rhythmic hits, or steadily on louder vocal holds to frame the composition
        const rhythmOnset = audioFeatures.onset;
        // Dynamic adaptive generation cadence: louder/richer entries spawn shapes up to 4x faster (every 8-15 frames)
        const adaptiveInterval = Math.max(8, Math.floor(20 - activeAmp * 25));
        const steadyCadence = frameCountRef.current % adaptiveInterval === 0 && activeAmp > 0.05;

        if (rhythmOnset || steadyCadence) {
          // Prune oldest geometry once we exceed high gallery limit to keep canvas fast but dense
          if (geometriesRef.current.length >= 120) {
            // Locate the first settled, non-framework geometry and remove it
            const idx = geometriesRef.current.findIndex(g => !g.id.startsWith('framework_'));
            if (idx !== -1) {
              geometriesRef.current.splice(idx, 1);
            }
          }

          // Decide size with high randomness and multi-scale hierarchy (halved overall as requested!)
          let baseSize = 17.5;
          const sizeChance = Math.random();
          if (sizeChance < 0.22) {
            // Giant Landmark Backdrops - halved exactly
            baseSize = 90 + Math.random() * 90; // 90 - 180px
          } else if (sizeChance < 0.60) {
            // Bold medium elements - halved exactly
            baseSize = 45 + Math.random() * 40; // 45 - 85px
          } else if (sizeChance < 0.88) {
            // Standard shapes - halved exactly
            baseSize = 22.5 + Math.random() * 20; // 22.5 - 42.5px
          } else {
            // Tiny, rich intricate accent dots & orbits beads - halved exactly
            baseSize = 6 + Math.random() * 10; // 6 - 16px
          }
          const elementSize = baseSize * (1.1 + activeAmp * 1.8);

          // Decide shape based on audio profile to align perfectly with composition moods
          let chosenShape: VisualElement['geometryType'];
          if (rhythmOnset) {
            // Fast rhythmic hits spawn circles, dramatic calligraphic crescents, chess grids, or intersecting planes
            const onsetShapes = ['circle', 'crescent', 'rectGrid', 'intersectingPlanes', 'boatCrescent', 'stripeBlock'] as const;
            chosenShape = onsetShapes[Math.floor(Math.random() * onsetShapes.length)];
          } else {
            // Sustained hums/singing spawn fluid orbits, arches, parallel strings, targets, or constructivist ladders
            const steadyShapes = [
              'orbitLine', 'semicircle', 'parallelHatch', 'concentric', 'ring', 
              'triangle', 'archedLadder', 'hatchedTriangle', 'scallopBowl', 'fanningRays'
            ] as const;
            chosenShape = steadyShapes[Math.floor(Math.random() * steadyShapes.length)];
          }

          const shapeColor = MASTER_PALETTE.strokes[Math.floor(Math.random() * MASTER_PALETTE.strokes.length)];

          // Absolute layout composition engine: Spacing and Airy structural placement!
          let posX = targetX;
          let posY = targetY;

          // Align relative to active shapes to construct elegantly spread coordinates:
          const activeShapes = geometriesRef.current.filter(g => g.type === 'geometry');
          if (activeShapes.length > 0 && Math.random() < 0.38) {
            // Relational spacing offsets to create structured, un-cluttered balances (Kassák & Kandinsky aesthetic spacing)
            const parent = activeShapes[Math.floor(Math.random() * activeShapes.length)];
            const relation = Math.random();

            if (relation < 0.50) {
              // Rule 1: Elegant Spaced Overlap (spread out to preserve visual clarity)
              const angle = Math.random() * Math.PI * 2;
              const dist = (parent.size + baseSize) * (1.1 + Math.random() * 1.5);
              posX = parent.x + Math.cos(angle) * dist;
              posY = parent.y + Math.sin(angle) * dist;
            } else {
              // Rule 2: Cohesive neighbor aligned orthogonally but much more spread out
              const cardinal = Math.floor(Math.random() * 4) * (Math.PI / 2);
              const dist = (parent.size + baseSize) * (1.4 + Math.random() * 1.2);
              posX = parent.x + Math.cos(cardinal) * dist;
              posY = parent.y + Math.sin(cardinal) * dist;
            }
          } else {
            // Rule 3: Airy natural distribution directly mapping live voice triggers beautifully across quadrants
            const padding = 160;
            posX = padding + Math.random() * (COMP_WIDTH - padding * 2);
            posY = padding + Math.random() * (COMP_HEIGHT - padding * 2);
          }

          // Contain coordinates perfectly within active dry-point margin frame limits
          posX = Math.max(COMP_WIDTH * 0.08, Math.min(COMP_WIDTH * 0.92, posX));
          posY = Math.max(COMP_HEIGHT * 0.08, Math.min(COMP_HEIGHT * 0.92, posY));

          geometriesRef.current.push({
            id: `sys_geom_${Date.now()}_${Math.random()}`,
            type: 'geometry',
            x: posX,
            y: posY,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            size: elementSize,
            birth: frameCountRef.current,
            lifespan: 1000000, // Never decay or disappear! Build up permanent artwork
            color: shapeColor,
            alpha: 0.75 + Math.random() * 0.25, // Solid, highly vibrant pigments
            geometryType: chosenShape,
            angle: Math.random() * Math.PI * 2,
            pulseSpeed: 0.012 + Math.random() * 0.016,
            energyResonance: 0
          });
        }
      }

      // 4. Update offscreen swirling starry flow paths
      if (particlesRef.current.length > 0 && offscreenCanvasRef.current) {
        const offCtx = offscreenCanvasRef.current.getContext('2d');
        if (offCtx) {
          offCtx.save();
          offCtx.lineCap = 'round';
          
          flowFieldAngleRef.current += 0.0012;
          const ffAng = flowFieldAngleRef.current;

          particlesRef.current.forEach((p) => {
            p.life++;

            const sc = 0.0045;
            const angularForce = Math.sin(p.x * sc + ffAng) * Math.cos(p.y * sc - ffAng) * Math.PI * 1.6;

            p.vx += Math.cos(angularForce) * 0.14;
            p.vy += Math.sin(angularForce) * 0.14;

            const velocityLimit = 4.2;
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > velocityLimit) {
              p.vx = (p.vx / speed) * velocityLimit;
              p.vy = (p.vy / speed) * velocityLimit;
            }

            const lx = p.x;
            const ly = p.y;
            p.x += p.vx;
            p.y += p.vy;

            offCtx.beginPath();
            offCtx.moveTo(lx, ly);
            offCtx.lineTo(p.x, p.y);

            offCtx.strokeStyle = p.color;
            offCtx.globalAlpha = p.alpha * (1.0 - p.life / p.maxLife);
            offCtx.lineWidth = p.size;
            offCtx.stroke();
          });

          particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
          offCtx.restore();
        }
      }

      // 5. Update and render structural geometries with zero smearing
      // Clear main client-facing canvas and build up depth stack cleanly
      pCtx.clearRect(0, 0, COMP_WIDTH, COMP_HEIGHT);

      // A. Layer 1: Pre-baked Textured Paper Frame
      if (bgCanvasRef.current) {
        pCtx.drawImage(bgCanvasRef.current, 0, 0, COMP_WIDTH, COMP_HEIGHT);
      } else {
        drawPerfectBackground(pCtx);
      }

      // B. Layer 2: Accumulated Soft Offscreen Watercolor Washes & Swirl Trails
      if (offscreenCanvasRef.current) {
        pCtx.drawImage(offscreenCanvasRef.current, 0, 0, COMP_WIDTH, COMP_HEIGHT);
      }

      // C. Layer 3: Solid, Crisp Geometric Shapes & Black Needles Stack
      if (geometriesRef.current.length > 0) {
        geometriesRef.current.forEach((g) => {
          const age = frameCountRef.current - g.birth;

          // Slow down the initial drifting speed until they settle perfectly static on paper composition
          const settleThreshold = 140;
          if (age < settleThreshold && !g.id.startsWith('framework_')) {
            const decay = 1.0 - (age / settleThreshold);
            g.x += g.vx * decay;
            g.y += g.vy * decay;
          }

          // Gently stay in canvas margins
          if (g.x < COMP_WIDTH * 0.05 || g.x > COMP_WIDTH * 0.95) g.vx *= -1;
          if (g.y < COMP_HEIGHT * 0.05 || g.y > COMP_HEIGHT * 0.95) g.vy *= -1;

          // Live audio pulse response holding
          if (paintActive && activeAmp > 0.04) {
            g.energyResonance = Math.sin(frameCountRef.current * (g.pulseSpeed || 0.02)) * activeAmp * 16;
          } else {
            g.energyResonance = 0;
          }
        });

        pCtx.save();
        pCtx.lineCap = 'butt';

        geometriesRef.current.forEach((g) => {
          const age = frameCountRef.current - g.birth;
          
          // Smooth scale-in on birth, then lock perfectly crisp, vibrant and opaque!
          const scaleRatio = age < 45 ? (age / 45) : 1;
          const size = g.size * scaleRatio;
          const resonance = g.energyResonance || 0;

          pCtx.globalAlpha = g.alpha; // SOLID and VIBRANT pigments!
          pCtx.strokeStyle = g.color;
          pCtx.fillStyle = g.color;
          pCtx.lineWidth = 1.5;

          pCtx.save();
          pCtx.translate(g.x, g.y);
          pCtx.rotate(g.angle || 0);

          if (g.type === 'geometry') {
            switch (g.geometryType) {
              case 'circle':
                // Beautiful overlapping solid pigment discs with fine outline hulls
                pCtx.beginPath();
                pCtx.arc(0, 0, Math.max(0.1, size + resonance), 0, Math.PI * 2);
                pCtx.fillStyle = g.color;
                pCtx.fill();
                pCtx.strokeStyle = 'rgba(26,26,26,0.65)';
                pCtx.lineWidth = 1.25;
                pCtx.stroke();
                
                // Fine inner centering point matching references coordinates
                if (size > 15) {
                  pCtx.beginPath();
                  pCtx.arc(0, 0, Math.max(0.1, size * 0.22), 0, Math.PI * 2);
                  pCtx.fillStyle = '#1A1A1A';
                  pCtx.fill();
                }
                break;

              case 'semicircle':
                // Structured arch panels filled with line hashes
                pCtx.beginPath();
                pCtx.arc(0, 0, Math.max(0.1, size + resonance), 0, Math.PI, true);
                pCtx.closePath();
                pCtx.fillStyle = g.color;
                pCtx.fill();
                pCtx.strokeStyle = 'rgba(26,26,26,0.7)';
                pCtx.lineWidth = 1.35;
                pCtx.stroke();

                pCtx.save();
                pCtx.clip();
                pCtx.strokeStyle = 'rgba(26,26,26,0.2)';
                pCtx.lineWidth = 0.6;
                for (let step = -size; step < size; step += 6) {
                  pCtx.beginPath();
                  pCtx.moveTo(step, -size);
                  pCtx.lineTo(step + size, size);
                  pCtx.stroke();
                }
                pCtx.restore();
                break;

              case 'ring':
                pCtx.beginPath();
                pCtx.arc(0, 0, Math.max(0.1, size + resonance), 0, Math.PI * 2);
                pCtx.strokeStyle = g.color;
                pCtx.lineWidth = 1.5;
                pCtx.stroke();
                pCtx.beginPath();
                pCtx.arc(0, 0, Math.max(0.1, (size + resonance) * 0.65), 0, Math.PI * 2);
                pCtx.strokeStyle = g.color;
                pCtx.lineWidth = 1.0;
                pCtx.stroke();
                break;

              case 'concentric':
                // Targets consisting of layered pigments and rings (Reference 2 top corner)
                for (let level = 3; level > 0; level--) {
                  const rad = Math.max(0.1, (size * (level / 3)) + resonance);
                  pCtx.beginPath();
                  pCtx.arc(0, 0, rad, 0, Math.PI * 2);
                  pCtx.strokeStyle = g.color;
                  pCtx.lineWidth = 1.2;
                  pCtx.stroke();
                  if (level === 1) {
                    pCtx.save();
                    pCtx.globalAlpha = 0.25;
                    pCtx.fillStyle = g.color;
                    pCtx.fill();
                    pCtx.restore();
                  }
                }
                break;

              case 'crescent':
                // Stark, heavy calligraphic black arch curved bridges (Reference 2 vertical crescent!)
                pCtx.beginPath();
                pCtx.arc(0, 0, Math.max(0.1, (size + resonance) * 1.3), 0.12, Math.PI * 0.88);
                pCtx.strokeStyle = '#18181A'; // Rich charcoal black
                pCtx.lineWidth = Math.max(4.0, size * 0.28);
                pCtx.lineCap = 'round';
                pCtx.stroke();

                // Dotted sequence of tiny jewel beads aligned along crescent hull
                pCtx.fillStyle = MASTER_PALETTE.strokes[Math.floor(size) % MASTER_PALETTE.strokes.length];
                for (let angle = 0.25; angle < Math.PI * 0.88; angle += 0.35) {
                  const bx = Math.cos(angle) * Math.max(0.1, (size + resonance) * 1.3);
                  const by = Math.sin(angle) * Math.max(0.1, (size + resonance) * 1.3);
                  pCtx.beginPath();
                  pCtx.arc(bx, by, 3.5, 0, Math.PI * 2);
                  pCtx.fill();
                }
                break;

              case 'orbitLine':
                // Elliptical planetary orbits with beads (Composition VII structures)
                pCtx.beginPath();
                pCtx.ellipse(
                  0, 
                  0, 
                  Math.max(0.1, (size + resonance) * 1.7), 
                  Math.max(0.1, (size + resonance) * 0.7), 
                  Math.PI * 0.12, 
                  0, 
                  Math.PI * 2
                );
                pCtx.strokeStyle = 'rgba(26,26,26,0.36)';
                pCtx.lineWidth = 0.95;
                pCtx.stroke();

                pCtx.fillStyle = g.color;
                for (let step = 0; step < 8; step++) {
                  const percent = (step / 8) * Math.PI * 2;
                  const ex = Math.cos(percent) * Math.max(0.1, (size + resonance) * 1.7);
                  const ey = Math.sin(percent) * Math.max(0.1, (size + resonance) * 0.7);
                  const rotX = ex * Math.cos(Math.PI * 0.12) - ey * Math.sin(Math.PI * 0.12);
                  const rotY = ex * Math.sin(Math.PI * 0.12) + ey * Math.cos(Math.PI * 0.12);
                  pCtx.beginPath();
                  pCtx.arc(rotX, rotY, (step % 2 === 0 ? 5.5 : 3.0), 0, Math.PI * 2);
                  pCtx.fill();
                  
                  if (step === 2 || step === 5) {
                    pCtx.strokeStyle = '#1A1A1A';
                    pCtx.lineWidth = 0.8;
                    pCtx.beginPath();
                    pCtx.arc(rotX, rotY, (step % 2 === 0 ? 9.0 : 5.5), 0, Math.PI * 2);
                    pCtx.stroke();
                  }
                }
                break;

              case 'rectGrid':
                // Colorful checker multi-pane matrices
                const cols = 3;
                const rws = 3;
                const gridLength = (size + resonance) * 1.3;
                const cellW = gridLength / cols;
                const cellH = gridLength / rws;

                pCtx.save();
                pCtx.translate(-gridLength / 2, -gridLength / 2);
                for (let r = 0; r < rws; r++) {
                  for (let c = 0; c < cols; c++) {
                    pCtx.fillStyle = MASTER_PALETTE.strokes[(r + c + Math.floor(size)) % MASTER_PALETTE.strokes.length];
                    pCtx.fillRect(c * cellW, r * cellH, cellW - 0.5, cellH - 0.5);
                  }
                }
                pCtx.strokeStyle = '#1A1A1A';
                pCtx.lineWidth = 1.35;
                pCtx.strokeRect(0, 0, gridLength, gridLength);
                pCtx.restore();
                break;

              case 'parallelHatch':
                // Diagonal parallel harp lines cutting diagonally across coordinate space
                pCtx.strokeStyle = g.color;
                pCtx.lineWidth = 1.1;
                for (let offset = -(size + resonance); offset <= (size + resonance); offset += 7.5) {
                  pCtx.beginPath();
                  pCtx.moveTo(offset, -(size + resonance) * 0.72);
                  pCtx.lineTo(offset + (size + resonance) * 0.35, (size + resonance) * 0.72);
                  pCtx.stroke();
                }
                break;

              case 'rect':
                pCtx.strokeRect(-size / 2, -size / 2, size, size);
                if (size > 28) {
                  pCtx.lineWidth = 0.6;
                  pCtx.beginPath();
                  pCtx.moveTo(0, -size / 2); pCtx.lineTo(0, size / 2);
                  pCtx.moveTo(-size / 2, 0); pCtx.lineTo(size / 2, 0);
                  pCtx.stroke();
                }
                break;

              case 'triangle':
                pCtx.beginPath();
                pCtx.moveTo(0, -(size + resonance) / 2);
                pCtx.lineTo((size + resonance) / 2, (size + resonance) / 2);
                pCtx.lineTo(-(size + resonance) / 2, (size + resonance) / 2);
                pCtx.closePath();
                pCtx.fillStyle = g.color;
                pCtx.fill();
                pCtx.strokeStyle = 'rgba(26,26,26,0.6)';
                pCtx.lineWidth = 1.1;
                pCtx.stroke();
                break;

              case 'archedLadder':
                {
                  const length = (size + resonance) * 1.8;
                  // Draw central baseline
                  pCtx.beginPath();
                  pCtx.moveTo(-length / 2, 0);
                  pCtx.lineTo(length / 2, 0);
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.3;
                  pCtx.stroke();
                  // Draw 6 semi-circular arches along the baseline
                  const count = 6;
                  const stepSize = length / (count - 1);
                  const archRad = size * 0.16;
                  for (let i = 0; i < count; i++) {
                    const lx = -length / 2 + i * stepSize;
                    pCtx.beginPath();
                    pCtx.arc(lx, -archRad / 2, Math.max(0.1, archRad), 0, Math.PI, true);
                    pCtx.strokeStyle = g.color;
                    pCtx.lineWidth = 1.5;
                    pCtx.stroke();
                    if (i % 2 === 0) {
                      pCtx.fillStyle = '#1A1A1A';
                      pCtx.beginPath();
                      pCtx.arc(lx, -archRad / 2, 2.5, 0, Math.PI * 2);
                      pCtx.fill();
                    }
                  }
                }
                break;

              case 'hatchedTriangle':
                {
                  const s = size + resonance;
                  // Draw solid background triangle
                  pCtx.beginPath();
                  pCtx.moveTo(0, -s / 2);
                  pCtx.lineTo(s / 2, s / 2);
                  pCtx.lineTo(-s / 2, s / 2);
                  pCtx.closePath();
                  pCtx.fillStyle = g.color;
                  pCtx.fill();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.1;
                  pCtx.stroke();

                  // Draw a companion hatched triangle offset to the side
                  const offsetX = s * 0.25;
                  const offsetY = -s * 0.15;
                  pCtx.save();
                  pCtx.translate(offsetX, offsetY);
                  pCtx.beginPath();
                  pCtx.moveTo(0, -s / 2);
                  pCtx.lineTo(s / 2, s / 2);
                  pCtx.lineTo(-s / 2, s / 2);
                  pCtx.closePath();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 0.9;
                  pCtx.stroke();

                  // Clip to draw diagonal wires inside companion triangle
                  pCtx.clip();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 0.6;
                  for (let x = -s; x <= s * 1.5; x += 5) {
                    pCtx.beginPath();
                    pCtx.moveTo(x - s, -s);
                    pCtx.lineTo(x + s, s);
                    pCtx.stroke();
                  }
                  pCtx.restore();
                }
                break;

              case 'intersectingPlanes':
                {
                  const s = size + resonance;
                  // Large background circle
                  pCtx.beginPath();
                  pCtx.arc(0, 0, Math.max(0.1, s * 0.85), 0, Math.PI * 2);
                  pCtx.fillStyle = g.color;
                  pCtx.fill();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.25;
                  pCtx.stroke();

                  // Intersecting white/cream square mask cutout
                  pCtx.fillStyle = '#FAFAF7';
                  pCtx.fillRect(-s * 0.35, -s * 0.35, s * 0.45, s * 0.45);
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.0;
                  pCtx.strokeRect(-s * 0.35, -s * 0.35, s * 0.45, s * 0.45);

                  // Intersecting sharp contrasting color triangle
                  pCtx.beginPath();
                  pCtx.moveTo(-s * 0.5, s * 0.1);
                  pCtx.lineTo(s * 0.7, -s * 0.7);
                  pCtx.lineTo(s * 0.3, s * 0.6);
                  pCtx.closePath();
                  pCtx.fillStyle = '#C23122'; // Bold tomato red element
                  pCtx.fill();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.2;
                  pCtx.stroke();

                  // A tiny black center coordinate dot
                  pCtx.beginPath();
                  pCtx.arc(0, 0, 3.5, 0, Math.PI * 2);
                  pCtx.fillStyle = '#1A1A1A';
                  pCtx.fill();
                }
                break;

              case 'scallopBowl':
                {
                  const s = size + resonance;
                  // Lower semicircular bowl
                  pCtx.beginPath();
                  pCtx.arc(0, 0, Math.max(0.1, s), 0, Math.PI, false);
                  pCtx.closePath();
                  pCtx.fillStyle = g.color;
                  pCtx.fill();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.8;
                  pCtx.stroke();

                  // Draw layered interior vertical cage lines
                  pCtx.save();
                  pCtx.beginPath();
                  pCtx.arc(0, 0, Math.max(0.1, s), 0, Math.PI, false);
                  pCtx.closePath();
                  pCtx.clip();

                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.0;
                  for (let i = -s; i <= s; i += 7.5) {
                    pCtx.beginPath();
                    pCtx.moveTo(i, 0);
                    pCtx.lineTo(i, s);
                    pCtx.stroke();
                  }

                  // A nested solid inner circle
                  pCtx.beginPath();
                  pCtx.arc(0, 0, Math.max(0.1, s * 0.42), 0, Math.PI * 2);
                  pCtx.fillStyle = '#DCA124'; // Canary Yellow highlight inside
                  pCtx.fill();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.stroke();

                  pCtx.restore();
                }
                break;

              case 'stripeBlock':
                {
                  const w = (size + resonance) * 1.5;
                  const h = (size + resonance) * 0.7;
                  pCtx.save();
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.35;
                  // Draw block boundaries
                  pCtx.strokeRect(-w / 2, -h / 2, w, h);

                  pCtx.beginPath();
                  pCtx.rect(-w / 2, -h / 2, w, h);
                  pCtx.clip();

                  // Alternate colored stripes
                  const stripesCount = 8;
                  const sw = w / stripesCount;
                  for (let i = 0; i < stripesCount; i++) {
                    pCtx.fillStyle = (i % 2 === 0) ? g.color : '#DFD5B9';
                    pCtx.fillRect(-w / 2 + i * sw, -h / 2, sw, h);
                  }

                  // Draw vertical column separators
                  pCtx.strokeStyle = '#1A1A1A';
                  pCtx.lineWidth = 1.0;
                  for (let i = 1; i < stripesCount; i++) {
                    pCtx.beginPath();
                    pCtx.moveTo(-w / 2 + i * sw, -h / 2);
                    pCtx.lineTo(-w / 2 + i * sw, h / 2);
                    pCtx.stroke();
                  }
                  pCtx.restore();
                }
                break;

              case 'boatCrescent':
                {
                  const s = size + resonance;
                  // Sweep thick elegant boat shape using Bezier curves
                  pCtx.beginPath();
                  pCtx.moveTo(-s * 1.3, -s * 0.1);
                  pCtx.quadraticCurveTo(0, s * 1.2, s * 1.3, -s * 0.1);
                  pCtx.quadraticCurveTo(0, s * 0.5, -s * 1.3, -s * 0.1);
                  pCtx.closePath();
                  pCtx.fillStyle = '#1A1A1A'; // Stark Ivory Black hull
                  pCtx.fill();
                  pCtx.strokeStyle = '#18181A';
                  pCtx.lineWidth = 1.5;
                  pCtx.stroke();

                  // Sprout small jewel bead lights of different solid colors along the boat spine
                  const dotColors = ['#FAFAF7', '#C23122', '#DCA124', '#1B447A', '#10865E'];
                  for (let i = -4; i <= 4; i++) {
                    if (i === 1) continue; // irregular rhythm
                    const ratio = i / 5;
                    const bx = ratio * s * 0.95;
                    // Compute quadratic lower curve position
                    const by = (1.0 - ratio * ratio) * s * 0.62;
                    pCtx.beginPath();
                    pCtx.arc(bx, by, Math.max(0.1, Math.max(2.5, 5 - Math.abs(i) * 0.5)), 0, Math.PI * 2);
                    pCtx.fillStyle = dotColors[(Math.abs(i) + Math.floor(s)) % dotColors.length];
                    pCtx.fill();
                    pCtx.strokeStyle = 'rgba(255,255,255,0.15)';
                    pCtx.lineWidth = 0.5;
                    pCtx.stroke();
                  }
                }
                break;

              case 'fanningRays':
                {
                  const s = size + resonance;
                  const rayCount = 8;
                  const spreadAngle = Math.PI * 0.45;
                  pCtx.strokeStyle = g.color;
                  pCtx.lineWidth = 1.0;
                  // Draws converging black ray vectors fanning architecture out
                  for (let i = 0; i < rayCount; i++) {
                    const currAngle = -spreadAngle / 2 + (i / (rayCount - 1)) * spreadAngle;
                    const rx = Math.cos(currAngle) * s * 1.6;
                    const ry = Math.sin(currAngle) * s * 1.6;
                    pCtx.beginPath();
                    pCtx.moveTo(0, 0);
                    pCtx.lineTo(rx, ry);
                    pCtx.stroke();

                    // Optional tiny decorative terminal dots on odd lines
                    if (i % 2 === 1) {
                      pCtx.fillStyle = '#1A1A1A';
                      pCtx.beginPath();
                      pCtx.arc(rx, ry, 3.0, 0, Math.PI * 2);
                      pCtx.fill();
                    }
                  }
                }
                break;
            }
          } else if (g.type === 'axis') {
            // Slicing horizontal/vertical framework axis
            pCtx.beginPath();
            pCtx.moveTo(-size / 2, 0);
            pCtx.lineTo(size / 2, 0);
            pCtx.strokeStyle = g.color;
            // Highlight pre-seeded master structural axes with heavy black strokes
            pCtx.lineWidth = g.id.startsWith('framework_') ? 3.5 : 1.3;
            pCtx.stroke();

            // Accent beads and cross hatch rails for detailed axes
            if (!g.id.startsWith('framework_')) {
              pCtx.lineWidth = 0.7;
              for (let step = -size / 2; step <= size / 2; step += 18) {
                pCtx.beginPath();
                pCtx.moveTo(step, -5);
                pCtx.lineTo(step, 5);
                pCtx.stroke();
              }
              pCtx.fillStyle = MASTER_PALETTE.accents[0];
              pCtx.fillRect(-size / 2 - 2, -2, 4, 4);
              pCtx.fillRect(size / 2 - 2, -2, 4, 4);
            }
          }

          pCtx.restore();
        });
        pCtx.restore();
      }

      // 6. Draw dynamic active HUD (Skeleton tracks and vocal pitch crosshair coordinates)
      hCtx.clearRect(0, 0, COMP_WIDTH, COMP_HEIGHT);

      // Clean interactive hand reset ripple flash (Removed to assess the clean screen transition directly as requested)

      // Live hands skeleton feedback
      if (handData && handData.present && handData.landmarks) {
        hCtx.save();
        hCtx.lineWidth = 0.8;
        hCtx.strokeStyle = 'rgba(0,0,0,0.12)';

        const connectors = [
          [0, 1, 2, 3, 4],
          [0, 5, 6, 7, 8],
          [9, 10, 11, 12],
          [13, 14, 15, 16],
          [0, 17, 18, 19, 20],
          [5, 9, 13, 17]
        ];

        connectors.forEach((cGroup) => {
          hCtx.beginPath();
          cGroup.forEach((idx, step) => {
            const lm = handData.landmarks![idx];
            const cx = (1.0 - lm.x) * COMP_WIDTH;
            const cy = lm.y * COMP_HEIGHT;
            if (step === 0) hCtx.moveTo(cx, cy);
            else hCtx.lineTo(cx, cy);
          });
          hCtx.stroke();
        });

        const pins = [4, 8, 12, 16, 20];
        hCtx.fillStyle = 'rgba(194,49,34,0.45)';
        pins.forEach((pIdx) => {
          const lm = handData.landmarks![pIdx];
          const cx = (1.0 - lm.x) * COMP_WIDTH;
          const cy = lm.y * COMP_HEIGHT;

          hCtx.beginPath();
          hCtx.arc(cx, cy, 3, 0, Math.PI * 2);
          hCtx.fill();

          if (paintActive && activeAmp > 0.04) {
            hCtx.beginPath();
            hCtx.arc(cx, cy, 4 + activeAmp * 26, 0, Math.PI * 2);
            hCtx.stroke();
          }
        });

        hCtx.restore();
      }

      // Draw active vocal coordinate crosshair compass (conveys deep physical precision)
      if (paintActive && activeAmp > 0.01 && audioFeatures && !audioFeatures.isBreathingPause) {
        hCtx.save();
        const scX = COMP_WIDTH * 0.15 + (Math.sin(frameCountRef.current * 0.005) * 0.5 + 0.5) * COMP_WIDTH * 0.7;
        const norm = Math.min(1.0, Math.max(0.0, (Math.log2(activePitch) - 6.5) / 4.0));
        const scY = COMP_HEIGHT * 0.15 + (1.0 - norm) * COMP_HEIGHT * 0.7;

        hCtx.strokeStyle = 'rgba(0,0,0,0.05)';
        hCtx.lineWidth = 0.5;

        // Faint axial projections
        hCtx.beginPath();
        hCtx.moveTo(COMP_WIDTH * 0.04, scY); hCtx.lineTo(COMP_WIDTH * 0.96, scY);
        hCtx.moveTo(scX, COMP_HEIGHT * 0.04); hCtx.lineTo(scX, COMP_HEIGHT * 0.96);
        hCtx.stroke();

        hCtx.beginPath();
        hCtx.arc(scX, scY, 15 + activeAmp * 60, 0, Math.PI * 2);
        hCtx.stroke();

        // Beautifully printed micro values
        hCtx.font = '9px font-mono, JetBrains Mono, monospace';
        hCtx.fillStyle = 'rgba(0,0,0,0.3)';
        hCtx.fillText(`${Math.round(activePitch)}Hz`, scX + 12, scY - 12);
        hCtx.fillText(`V:${Math.round(activeAmp * 100)}%`, scX + 12, scY + 2);

        hCtx.restore();
      }

      loopId = requestAnimationFrame(gameLoop);
    };

    loopId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(loopId);
  }, [paintActive, audioFeatures]);

  return (
    <div 
      id="art-painting-frame"
      ref={containerRef} 
      className="relative w-full h-full bg-[#EDE9D6] overflow-hidden flex items-center justify-center cursor-crosshair border border-stone-300 shadow-xl"
    >
      {/* Absolute canvas stacks */}
      <canvas
        id="generative-accumulative-layer"
        ref={paintingCanvasRef}
        className="absolute inset-0 z-0 bg-transparent"
      />

      <canvas
        id="interactive-feedback-hud"
        ref={hudCanvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />
    </div>
  );
};

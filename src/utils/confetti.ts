import confetti from 'canvas-confetti';

export interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  scalar?: number;
  ticks?: number;
  gravity?: number;
  drift?: number;
  colors?: string[];
}

const defaultColors = [
  '#4f46e5', // indigo-600
  '#6366f1', // indigo-500
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // fuchsia-400
  '#f472b6', // pink-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
];

/**
 * Triggers a celebration confetti explosion
 */
export const celebrate = (options: ConfettiOptions = {}): void => {
  const {
    particleCount = 100,
    spread = 70,
    startVelocity = 45,
    scalar = 1,
    colors = defaultColors,
  } = options;

  confetti({
    particleCount,
    spread,
    startVelocity,
    scalar,
    colors,
    gravity: 1.2,
    drift: 0,
    origin: { y: 0.6 },
  });
};

/**
 * Triggers a massive confetti cannon effect from both sides
 */
export const cannonBlast = (options: ConfettiOptions = {}): void => {
  const {
    particleCount = 150,
    spread = 100,
    startVelocity = 55,
    scalar = 1.2,
    colors = defaultColors,
  } = options;

  const end = Date.now() + 2000;

  const frame = () => {
    confetti({
      particleCount,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      startVelocity,
      scalar,
    });
    confetti({
      particleCount,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      startVelocity,
      scalar,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

/**
 * Creates a continuous confetti rain effect
 */
export const confettiRain = (duration: number = 3000): void => {
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 90,
      spread: 30,
      origin: { x: Math.random(), y: -0.1 },
      colors: defaultColors,
      scalar: Math.random() * 0.5 + 0.5,
      startVelocity: Math.random() * 20 + 10,
      gravity: 0.5,
      drift: Math.random() * 4 - 2,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};

/**
 * Creates a circular confetti burst around a point
 */
export const circleBurst = (
  x: number = 0.5,
  y: number = 0.5,
  options: ConfettiOptions = {}
): void => {
  const {
    particleCount = 80,
    spread = 360,
    startVelocity = 40,
    scalar = 1,
    colors = defaultColors,
  } = options;

  confetti({
    particleCount,
    startVelocity,
    spread,
    origin: { x, y },
    colors,
    scalar,
    gravity: 0.8,
    drift: 0,
  });
};

/**
 * Creates a shape-based confetti effect (heart, star, etc.)
 */
export const shapeConfetti = (
  shape: 'circle' | 'star' | 'heart' = 'circle',
  count: number = 50
): void => {
  const scalarMap = {
    circle: 1,
    star: 1.2,
    heart: 1.1,
  };

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 1,
        origin: {
          x: Math.random(),
          y: Math.random() - 0.2,
        },
        colors: [defaultColors[Math.floor(Math.random() * defaultColors.length)]],
        scalar: scalarMap[shape],
        startVelocity: 30,
        gravity: 1,
        drift: 0,
      });
    }, i * 50);
  }
};

/**
 * Triggers confetti for level up celebrations
 */
export const levelUpCelebration = (): void => {
  // Initial burst
  celebrate({ particleCount: 80, spread: 90 });
  
  // Follow-up bursts
  setTimeout(() => {
    cannonBlast({ particleCount: 100 });
  }, 300);
  
  setTimeout(() => {
    celebrate({ particleCount: 60, spread: 60 });
  }, 600);
};

/**
 * Triggers confetti for quest completion
 */
export const questCompleteCelebration = (): void => {
  celebrate({ particleCount: 50, spread: 60 });
  
  setTimeout(() => {
    circleBurst(0.5, 0.4, { particleCount: 40 });
  }, 200);
};

/**
 * Triggers confetti for achievement unlocked
 */
export const achievementUnlocked = (): void => {
  cannonBlast({ particleCount: 120, spread: 120 });
  
  setTimeout(() => {
    confettiRain(1500);
  }, 500);
};

/**
 * Triggers subtle confetti for small wins
 */
export const miniCelebrate = (): void => {
  celebrate({ 
    particleCount: 30, 
    spread: 40, 
    startVelocity: 25,
    scalar: 0.7 
  });
};

export default {
  celebrate,
  cannonBlast,
  confettiRain,
  circleBurst,
  shapeConfetti,
  levelUpCelebration,
  questCompleteCelebration,
  achievementUnlocked,
  miniCelebrate,
};

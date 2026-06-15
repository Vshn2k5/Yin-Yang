import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Trophy, Star, Flame } from 'lucide-react';

interface Particle {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  velocity: { x: number; y: number };
  life: number;
  maxLife: number;
}

const colors = [
  '#4f46e5', // indigo-600
  '#6366f1', // indigo-500
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // fuchsia-400
  '#f472b6', // pink-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
];

interface AmbientParticlesProps {
  count?: number;
  speed?: number;
  size?: number;
}

export const AmbientParticles: React.FC<AmbientParticlesProps> = ({
  count = 20,
  speed = 0.3,
  size = 3,
}) => {
  const [particles, setParticles] = React.useState<Particle[]>([]);

  useEffect(() => {
    // Initialize particles
    const initialParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: `particle-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * size + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      velocity: {
        x: (Math.random() - 0.5) * speed,
        y: (Math.random() - 0.5) * speed,
      },
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 100,
    }));
    setParticles(initialParticles);

    // Animation loop
    const animate = () => {
      setParticles(prev =>
        prev.map(particle => {
          let newX = particle.x + particle.velocity.x;
          let newY = particle.y + particle.velocity.y;
          let newLife = particle.life + 1;

          // Wrap around screen
          if (newX < 0) newX = 100;
          if (newX > 100) newX = 0;
          if (newY < 0) newY = 100;
          if (newY > 100) newY = 0;

          // Reset particle when life ends
          if (newLife >= particle.maxLife) {
            return {
              ...particle,
              x: Math.random() * 100,
              y: Math.random() * 100,
              life: 0,
              velocity: {
                x: (Math.random() - 0.5) * speed,
                y: (Math.random() - 0.5) * speed,
              },
            };
          }

          return {
            ...particle,
            x: newX,
            y: newY,
            life: newLife,
          };
        })
      );
    };

    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, [count, speed, size]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map(particle => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            opacity: (particle.life / particle.maxLife) * 0.6,
            filter: `blur(${particle.size}px)`,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2 + Math.random(),
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

interface FloatingIconsProps {
  icons?: Array<{ icon: React.ReactNode; color: string }>;
  count?: number;
}

export const FloatingIcons: React.FC<FloatingIconsProps> = ({
  icons = [
    { icon: <Sparkles className="w-4 h-4" />, color: '#6366f1' },
    { icon: <Zap className="w-4 h-4" />, color: '#fbbf24' },
    { icon: <Trophy className="w-4 h-4" />, color: '#f472b6' },
    { icon: <Star className="w-4 h-4" />, color: '#34d399' },
    { icon: <Flame className="w-4 h-4" />, color: '#ef4444' },
  ],
  count = 8,
}) => {
  const [floatingItems, setFloatingItems] = React.useState<
    Array<{ id: string; icon: React.ReactNode; color: string; x: number; y: number }>
  >([]);

  useEffect(() => {
    const items = Array.from({ length: count }, (_, i) => {
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];
      return {
        id: `floating-${i}`,
        icon: randomIcon.icon,
        color: randomIcon.color,
        x: Math.random() * 100,
        y: Math.random() * 100,
      };
    });
    setFloatingItems(items);
  }, [icons, count]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {floatingItems.map(item => (
        <motion.div
          key={item.id}
          className="absolute"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            color: item.color,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, -10, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {item.icon}
        </motion.div>
      ))}
    </div>
  );
};

interface EnergyWavesProps {
  color?: string;
  count?: number;
}

export const EnergyWaves: React.FC<EnergyWavesProps> = ({
  color = 'rgba(99, 102, 241, 0.1)',
  count = 3,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            borderColor: color,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{
            width: ['0%', '150%'],
            height: ['0%', '150%'],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: 4 + i * 1.5,
            repeat: Infinity,
            delay: i * 1.5,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

interface GradientOrbsProps {
  count?: number;
}

export const GradientOrbs: React.FC<GradientOrbsProps> = ({ count = 4 }) => {
  const orbColors = [
    'from-indigo-600/20 via-purple-600/20 to-pink-600/20',
    'from-blue-600/20 via-cyan-600/20 to-teal-600/20',
    'from-violet-600/20 via-fuchsia-600/20 to-rose-600/20',
    'from-emerald-600/20 via-green-600/20 to-lime-600/20',
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-96 h-96 rounded-full bg-gradient-radial ${orbColors[i % orbColors.length]} blur-3xl`}
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            scale: 0.5,
          }}
          animate={{
            x: [
              Math.random() * window.innerWidth,
              Math.random() * window.innerWidth,
              Math.random() * window.innerWidth,
            ],
            y: [
              Math.random() * window.innerHeight,
              Math.random() * window.innerHeight,
              Math.random() * window.innerHeight,
            ],
            scale: [0.5, 1.2, 0.8, 1],
          }}
          transition={{
            duration: 20 + i * 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

export default {
  AmbientParticles,
  FloatingIcons,
  EnergyWaves,
  GradientOrbs,
};

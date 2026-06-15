import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Star } from 'lucide-react';

interface PowerUpEffectProps {
  type?: 'sparkle' | 'zap' | 'star' | 'confetti';
  duration?: number;
  onComplete?: () => void;
}

const PowerUpEffect: React.FC<PowerUpEffectProps> = ({
  type = 'sparkle',
  duration = 2000,
  onComplete
}) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const icons = {
    sparkle: Sparkles,
    zap: Zap,
    star: Star,
    confetti: Star
  };

  const Icon = icons[type];

  const variants = {
    initial: { scale: 0, opacity: 0, rotate: -180 },
    animate: { 
      scale: [0, 1.2, 1], 
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
      y: [0, -100, -200]
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {Array.from({ length: type === 'confetti' ? 20 : 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          variants={variants}
          initial="initial"
          animate="animate"
          transition={{
            duration: duration / 1000,
            delay: i * 0.1,
            ease: [0.6, -0.05, 0.01, 0.99]
          }}
        >
          <Icon
            className={`w-6 h-6 ${
              type === 'zap' ? 'text-yellow-400' :
              type === 'star' ? 'text-amber-400' :
              'text-indigo-400'
            }`}
            style={{
              filter: 'drop-shadow(0 0 10px currentColor)',
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default PowerUpEffect;

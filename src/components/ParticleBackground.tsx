import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ParticleBackgroundProps {
  particleCount?: number;
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleCount = 30,
  color = '#6366f1',
  speed = 'normal'
}) => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
  }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, [particleCount]);

  const speedMap = {
    slow: 1.5,
    normal: 1,
    fast: 0.6
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              backgroundColor: color,
              opacity: 0.3,
              filter: 'blur(1px)',
              boxShadow: `0 0 ${particle.size * 2}px ${color}`
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{
              y: -200,
              opacity: [0, 0.5, 0.3, 0]
            }}
            transition={{
              duration: particle.duration * speedMap[speed],
              delay: particle.delay,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ParticleBackground;

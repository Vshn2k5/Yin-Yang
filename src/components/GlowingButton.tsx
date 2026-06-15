import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface GlowingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'gold' | 'legendary';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}

const GlowingButton: React.FC<GlowingButtonProps> = ({
  variant = 'primary',
  size = 'md',
  glow = true,
  pulse = false,
  children,
  className,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples(prev => [...prev, { x, y, id: Date.now() }]);
    setIsPressed(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    setTimeout(() => {
      setRipples(prev => prev.slice(1));
    }, 600);
  }, []);

  const variants = {
    primary: 'from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-indigo-500/50',
    secondary: 'from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white shadow-slate-500/50',
    success: 'from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/50',
    danger: 'from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white shadow-red-500/50',
    gold: 'from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-white shadow-amber-500/50',
    legendary: 'from-purple-500 via-pink-500 to-rose-500 hover:from-purple-400 hover:via-pink-400 hover:to-rose-400 text-white shadow-purple-500/50'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  return (
    <motion.button
      className={twMerge(
        clsx(
          'relative overflow-hidden rounded-xl font-bold uppercase tracking-wider',
          'bg-gradient-to-r transition-all duration-300',
          'transform hover:scale-105 active:scale-95',
          'border border-white/20 backdrop-blur-sm',
          sizes[size],
          variants[variant],
          glow && 'shadow-lg hover:shadow-xl',
          pulse && 'animate-pulse',
          isPressed && 'scale-95',
          className
        )
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      whileHover={{ 
        scale: 1.05,
        boxShadow: glow ? '0 20px 60px rgba(99, 102, 241, 0.5)' : undefined
      }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 opacity-0 hover:opacity-30"
        style={{
          background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
          backgroundSize: '200% 200%'
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%']
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear'
        }}
      />

      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full bg-white/30"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: 0,
              height: 0,
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        ))}
      </AnimatePresence>

      {/* Glow overlay */}
      {glow && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `linear-gradient(45deg, rgba(255,255,255,0.1), transparent)`,
            filter: 'blur(10px)',
          }}
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>

      {/* Border shine */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          border: '2px solid transparent',
          background: 'linear-gradient(45deg, #4f46e5, #6366f1, #818cf8, #a78bfa, #4f46e5) border-box',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          backgroundSize: '300% 300%',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
    </motion.button>
  );
};

export default GlowingButton;

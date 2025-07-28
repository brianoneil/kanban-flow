import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ExplosionAnimationProps {
  trigger: boolean;
  onComplete: () => void;
  children: React.ReactNode;
}

export function ExplosionAnimation({ trigger, onComplete, children }: ExplosionAnimationProps) {
  const [isExploding, setIsExploding] = useState(false);

  useEffect(() => {
    if (trigger) {
      setIsExploding(true);
    }
  }, [trigger]);

  if (!isExploding) {
    return <>{children}</>;
  }

  // Create explosion particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30) * (Math.PI / 180); // Convert to radians
    const distance = 100 + Math.random() * 50;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    
    return { x, y, delay: Math.random() * 0.1 };
  });

  return (
    <motion.div
      className="relative"
      initial={{ scale: 1, rotate: 0 }}
      animate={{ 
        scale: [1, 1.1, 0.8, 0],
        rotate: [0, -5, 5, 0],
        opacity: [1, 1, 0.8, 0]
      }}
      transition={{ 
        duration: 0.6,
        ease: "easeOut"
      }}
      onAnimationComplete={onComplete}
    >
      {children}
      
      {/* Explosion particles */}
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-2 h-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
          initial={{ 
            x: 0, 
            y: 0, 
            scale: 0,
            opacity: 1
          }}
          animate={{ 
            x: particle.x,
            y: particle.y,
            scale: [0, 1, 0.5, 0],
            opacity: [1, 1, 0.8, 0]
          }}
          transition={{ 
            duration: 0.8,
            delay: particle.delay,
            ease: "easeOut"
          }}
        />
      ))}
      
      {/* Central flash */}
      <motion.div
        className="absolute inset-0 bg-white rounded-lg"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: [0, 0.8, 0],
          scale: [0.8, 1.2, 1.5]
        }}
        transition={{ 
          duration: 0.3,
          ease: "easeOut"
        }}
      />
    </motion.div>
  );
}
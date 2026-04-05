import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="py-24 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium mb-8 backdrop-blur-sm"
      >
        <span className="flex h-2 w-2 rounded-full bg-foreground mr-2"></span>
        Introducing the new standard
      </motion.div>
      
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-5xl md:text-7xl font-semibold tracking-tighter max-w-3xl mb-6"
      >
        Simplicity is the ultimate sophistication.
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
      >
        A beautifully crafted, neutral interface designed to let your content shine. 
        Built with high-performance animations and seamless dark mode support.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-foreground text-background px-8 font-medium transition-colors hover:bg-foreground/90"
        >
          Get Started
          <ArrowRight className="ml-2 h-4 w-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-8 font-medium transition-colors hover:bg-muted"
        >
          Documentation
        </motion.button>
      </motion.div>
    </section>
  );
}

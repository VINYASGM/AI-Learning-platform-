import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, useState } from 'react';

export function InteractiveSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Design', 'Development', 'Deployment'];

  return (
    <section ref={containerRef} className="py-24 overflow-hidden relative">
      <motion.div style={{ y, opacity }} className="max-w-4xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12 shadow-sm">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-semibold tracking-tight">Seamless Workflow</h2>
              <p className="text-muted-foreground">
                Experience a fluid transition between different stages of your product lifecycle.
                Our interface adapts to your needs.
              </p>
              
              <div className="flex space-x-2 border-b border-border pb-2">
                {tabs.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(i)}
                    className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === i ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {activeTab === i && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-md bg-muted"
                        initial={false}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>
              
              <div className="relative h-32">
                {tabs.map((tab, i) => (
                  activeTab === i && (
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0"
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {i === 0 && "Craft beautiful interfaces with our comprehensive design system. Utilize neutral tones and precise typography to create a timeless look."}
                        {i === 1 && "Build robust applications with modern frameworks. Our components are highly optimized and accessible out of the box."}
                        {i === 2 && "Deploy your projects globally in seconds. Enjoy seamless integration with top-tier hosting providers and CI/CD pipelines."}
                      </p>
                    </motion.div>
                  )
                ))}
              </div>
            </div>
            
            <div className="flex-1 w-full">
              <div className="relative aspect-square rounded-full border border-border border-dashed flex items-center justify-center p-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-foreground/10 border-t-foreground/40"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4 rounded-full border border-foreground/10 border-b-foreground/40"
                />
                <div className="relative z-10 text-center">
                  <motion.div
                    key={activeTab}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="text-4xl font-light tracking-tighter"
                  >
                    0{activeTab + 1}
                  </motion.div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mt-2">Stage</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

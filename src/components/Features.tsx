import { motion } from 'motion/react';
import { Zap, Shield, Smartphone, Globe, Cpu, Layers } from 'lucide-react';

const features = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Lightning Fast',
    description: 'Optimized for speed and performance across all devices.',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Secure by Default',
    description: 'Built with best practices to keep your data safe.',
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: 'Fully Responsive',
    description: 'Looks great on desktops, tablets, and mobile phones.',
  },
  {
    icon: <Globe className="h-5 w-5" />,
    title: 'Global Reach',
    description: 'Accessible and localized for users around the world.',
  },
  {
    icon: <Cpu className="h-5 w-5" />,
    title: 'Smart Processing',
    description: 'Leverages AI to automate your most tedious tasks.',
  },
  {
    icon: <Layers className="h-5 w-5" />,
    title: 'Modular Design',
    description: 'Easily customize and extend functionality as needed.',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function Features() {
  return (
    <section className="py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Everything you need</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          A comprehensive suite of tools designed to help you build better products, faster.
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {features.map((feature, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
              {feature.icon}
            </div>
            <h3 className="mb-2 font-medium">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
            
            {/* Subtle background gradient effect on hover */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-foreground/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

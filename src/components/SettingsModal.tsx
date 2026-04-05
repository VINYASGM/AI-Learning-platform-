import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Palette, Monitor, Accessibility, Check, Sun, Moon, 
  Laptop, Type, Eye, Contrast, SplitSquareHorizontal, 
  SplitSquareVertical, Sparkles
} from 'lucide-react';
import { useTheme, THEMES, ThemeName, ThemeDefinition } from './ThemeProvider';

type SettingsTab = 'appearance' | 'accessibility';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Accessibility settings (local state — could be moved to context later)
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={16} /> },
  ];

  const darkThemes = THEMES.filter(t => t.isDark);
  const lightThemes = THEMES.filter(t => !t.isDark);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 
                       sm:w-[680px] sm:max-h-[520px] z-[101]
                       bg-card border border-border/60 rounded-2xl shadow-2xl 
                       flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-accent/10">
                  <Sparkles size={16} className="text-accent" />
                </div>
                <h2 className="text-base font-semibold text-foreground tracking-tight">Settings</h2>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </motion.button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Tab Sidebar */}
              <nav className="w-44 flex-shrink-0 border-r border-border/30 py-3 px-2 bg-muted/20 space-y-0.5">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all
                      ${activeTab === tab.id 
                        ? 'bg-accent/10 text-accent shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <AnimatePresence mode="wait">
                  {activeTab === 'appearance' && (
                    <motion.div
                      key="appearance"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {/* System Theme Option */}
                      <div>
                        <button
                          onClick={() => setTheme('system')}
                          className={`
                            w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
                            ${theme === 'system' 
                              ? 'border-accent/50 bg-accent/5 shadow-sm ring-1 ring-accent/20' 
                              : 'border-border/40 hover:border-border hover:bg-muted/30'}
                          `}
                        >
                          <div className="p-2 rounded-lg bg-muted/60">
                            <Laptop size={16} className="text-muted-foreground" />
                          </div>
                          <div className="text-left flex-1">
                            <p className="text-sm font-medium text-foreground">System</p>
                            <p className="text-[11px] text-muted-foreground">Follow your OS preference</p>
                          </div>
                          {theme === 'system' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="p-1 rounded-full bg-accent text-accent-foreground"
                            >
                              <Check size={10} strokeWidth={3} />
                            </motion.div>
                          )}
                        </button>
                      </div>

                      {/* Dark Themes */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Moon size={13} className="text-muted-foreground" />
                          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dark Themes</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {darkThemes.map(t => (
                            <ThemeCard
                              key={t.id}
                              theme={t}
                              isActive={theme === t.id}
                              onSelect={() => setTheme(t.id)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Light Themes */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sun size={13} className="text-muted-foreground" />
                          <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Light Themes</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {lightThemes.map(t => (
                            <ThemeCard
                              key={t.id}
                              theme={t}
                              isActive={theme === t.id}
                              onSelect={() => setTheme(t.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'accessibility' && (
                    <motion.div
                      key="accessibility"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <p className="text-xs text-muted-foreground mb-2">
                        Optimize the interface for your comfort and reading preferences.
                      </p>

                      <AccessibilityToggle
                        icon={<Type size={16} />}
                        label="Dyslexia-Friendly Font"
                        description="Use OpenDyslexic for improved readability"
                        checked={dyslexiaFont}
                        onChange={(v) => {
                          setDyslexiaFont(v);
                          document.documentElement.classList.toggle('font-dyslexic', v);
                        }}
                      />

                      <AccessibilityToggle
                        icon={<Contrast size={16} />}
                        label="High Contrast"
                        description="Increase color contrast for better visibility"
                        checked={highContrast}
                        onChange={(v) => {
                          setHighContrast(v);
                          document.documentElement.classList.toggle('high-contrast', v);
                        }}
                      />

                      <AccessibilityToggle
                        icon={<Eye size={16} />}
                        label="Reduced Motion"
                        description="Minimize animations and transitions"
                        checked={reducedMotion}
                        onChange={(v) => {
                          setReducedMotion(v);
                          document.documentElement.classList.toggle('motion-reduce', v);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   Theme Preview Card Component
   ═══════════════════════════════════════════════════════════ */
function ThemeCard({ 
  theme, isActive, onSelect 
}: { 
  theme: ThemeDefinition; 
  isActive: boolean; 
  onSelect: () => void;
}) {
  const { bg, fg, accent, card } = theme.preview;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`
        relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left
        ${isActive 
          ? 'border-accent/50 ring-1 ring-accent/20 shadow-md' 
          : 'border-border/40 hover:border-border/80 hover:shadow-sm'}
      `}
    >
      {/* Color Swatches - Mini Preview */}
      <div className="flex items-center gap-1.5 w-full">
        {/* Background circle */}
        <div 
          className="w-7 h-7 rounded-lg border border-black/10 shadow-inner flex items-center justify-center"
          style={{ backgroundColor: bg }}
        >
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
        </div>
        {/* Text line previews */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex gap-1">
            <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: fg, opacity: 0.8 }} />
            <div className="h-1.5 w-4 rounded-full" style={{ backgroundColor: accent, opacity: 0.6 }} />
          </div>
          <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: fg, opacity: 0.3 }} />
        </div>
      </div>

      {/* Label */}
      <div className="w-full">
        <p className="text-[12px] font-semibold text-foreground leading-tight">{theme.label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{theme.description}</p>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 p-0.5 rounded-full bg-accent text-accent-foreground"
        >
          <Check size={10} strokeWidth={3} />
        </motion.div>
      )}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Accessibility Toggle Switch
   ═══════════════════════════════════════════════════════════ */
function AccessibilityToggle({ 
  icon, label, description, checked, onChange 
}: { 
  icon: React.ReactNode;
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left
        ${checked 
          ? 'border-accent/40 bg-accent/5' 
          : 'border-border/40 hover:border-border/80 hover:bg-muted/20'}
      `}
    >
      <div className={`p-2 rounded-lg transition-colors ${checked ? 'bg-accent/15 text-accent' : 'bg-muted/60 text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      {/* Toggle Switch */}
      <div
        className={`
          relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0
          ${checked ? 'bg-accent' : 'bg-muted-foreground/30'}
        `}
      >
        <motion.div
          animate={{ x: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
        />
      </div>
    </button>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ONBOARDING_KEY = 'jinx_onboarded';

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

function markOnboarded() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

interface Props {
  onDone: () => void;
}

const steps = [
  {
    emoji: '👀',
    title: "You'll see two words",
    desc: 'Each round shows a pair of words side by side.',
  },
  {
    emoji: '🧠',
    title: 'Type ONE word',
    desc: 'Enter the word you think most other players will also say.',
    example: { a: 'DOG', b: 'BEACH', answer: 'SAND' },
  },
];

export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const finish = () => {
    markOnboarded();
    onDone();
  };

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else finish();
  };

  const current = steps[step];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center px-6"
    >
      <button
        onClick={finish}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2"
        aria-label="Skip"
      >
        <X className="h-5 w-5" />
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="text-center max-w-sm w-full"
        >
          <p className="text-4xl mb-4">{current.emoji}</p>
          <h2 className="text-xl font-bold text-foreground mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{current.desc}</p>

          {current.example && (
            <div className="game-card inline-block px-8 py-5 mb-6">
              <div className="flex flex-col items-center gap-0.5 font-display">
                <span className="text-lg font-bold text-foreground">{current.example.a}</span>
                <span className="text-primary text-sm font-bold">+</span>
                <span className="text-lg font-bold text-foreground">{current.example.b}</span>
                <span className="text-muted-foreground text-xs mt-2">→</span>
                <span className="text-primary text-base font-bold mt-1">{current.example.answer}</span>
              </div>
            </div>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i === step ? 'w-5 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <Button
            onClick={next}
            className="rounded-lg px-8 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {step === steps.length - 1 ? "Got it — let's play" : 'Next'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

          <button onClick={finish} className="block mx-auto mt-3 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            Skip intro
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

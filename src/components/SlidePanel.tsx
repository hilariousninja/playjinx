import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  zIndex?: number;
}

export default function SlidePanel({ open, onClose, title, subtitle, children, zIndex = 40 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-foreground/20 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute inset-y-0 right-0 w-full max-w-lg bg-background shadow-xl transition-transform duration-300 ease-out flex flex-col ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            {title && <p className="text-sm font-bold text-foreground truncate">{title}</p>}
            {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

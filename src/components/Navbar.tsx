import React from 'react';

interface NavbarProps {
  onGoHome: () => void;
  onOpenModal?: (type: 'about' | 'howto' | 'stem') => void;
  onStartMission?: () => void;
  showLandingNav?: boolean;
  stepText?: string;
}

export default function Navbar({
  onGoHome,
  onOpenModal,
  onStartMission,
  showLandingNav = true,
  stepText,
}: NavbarProps) {
  return (
    <header className="w-full border-b border-sky-300/20 astra-glass-dock sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={onGoHome}
          className="font-display text-lg font-bold tracking-wider text-white whitespace-nowrap shrink-0 hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
        >
          ASTRA
        </button>

        {/* Zone 2: Clean Single-Line Nav Links or Step Progress */}
        {showLandingNav && onOpenModal ? (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-200">
            <button
              type="button"
              onClick={() => onOpenModal('about')}
              className="hover:text-cyan-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('howto')}
              className="hover:text-cyan-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How to Play
            </button>
            <button
              type="button"
              onClick={() => onOpenModal('stem')}
              className="hover:text-cyan-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Learn STEM
            </button>
          </nav>
        ) : (
          <div className="hidden sm:block text-xs font-mono text-cyan-200/80 whitespace-nowrap truncate">
            {stepText || 'Junior Astronaut Mission Trainer'}
          </div>
        )}

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {showLandingNav && onStartMission ? (
            <button
              type="button"
              onClick={onStartMission}
              className="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display font-semibold text-sm transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(34,211,238,0.28)]"
            >
              Start Mission
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoHome}
              className="px-4 py-2 rounded-lg astra-glass-subtle hover:border-cyan-400/50 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

import { Zap, Github, Sparkles, Settings } from 'lucide-react';

interface NavbarProps {
  onSettingsClick: () => void;
}

export function Navbar({ onSettingsClick }: NavbarProps) {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md border-b" style={{ background: 'rgba(10, 10, 15, 0.7)', borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6C63FF, #00D4FF)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-[#F0F0FF]" style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            SEO<span className="gradient-text" style={{ fontWeight: 700 }}>Boost</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
            style={{ background: 'rgba(108, 99, 255, 0.1)', color: '#8B8BAD', border: '1px solid rgba(108, 99, 255, 0.2)' }}
          >
            <Sparkles className="w-3 h-3" style={{ color: '#6C63FF' }} />
            Powered by AI
          </span>
          <button
            onClick={onSettingsClick}
            className="p-2 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
            style={{ color: '#8B8BAD' }}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <a
            href="https://github.com/House-of-Coco/seo-content-optimizer"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#8B8BAD' }}
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      </div>
    </nav>
  );
}

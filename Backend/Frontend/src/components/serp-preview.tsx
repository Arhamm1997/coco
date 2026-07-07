import { Globe } from 'lucide-react';

interface SerpPreviewProps {
  title: string;
  description: string;
}

export function SerpPreview({ title, description }: SerpPreviewProps) {
  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{
        background: '#ffffff',
        border: '1px solid #dadce0',
      }}
    >
      <p className="text-xs mb-0.5" style={{ color: '#4d5156', fontWeight: 400 }}>
        <span className="inline-flex items-center gap-1">
          <Globe className="w-3 h-3" style={{ color: '#4d5156' }} />
          <span style={{ color: '#202124', fontSize: '0.75rem' }}>houseofcoco.net</span>
          <span style={{ color: '#4d5156' }}>&rsaquo; blog</span>
        </span>
      </p>
      <p
        className="mb-0.5 cursor-pointer"
        style={{
          color: '#1a0dab',
          fontSize: '1.125rem',
          fontWeight: 400,
          lineHeight: '1.3',
          textDecoration: 'none',
        }}
      >
        {title || 'Meta Title Preview'}
      </p>
      <p
        className="text-sm"
        style={{
          color: '#4d5156',
          lineHeight: '1.5',
          fontSize: '0.8125rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}
      >
        {description || 'Meta description will appear here as a preview of how the result looks in Google search.'}
      </p>
    </div>
  );
}

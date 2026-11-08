// Logo JVS (mesmo desenho de build/icon.svg, que também gera o ícone do app).
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} role="img" aria-label="JVS">
      <defs>
        <linearGradient id="logo-jvs" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="68" fill="url(#logo-jvs)" />
      <text x="128" y="152" textAnchor="middle" fontFamily="Segoe UI, Arial, sans-serif" fontWeight="800" fontSize="104" letterSpacing="-4" fill="#fff">JVS</text>
      <rect x="64" y="176" width="128" height="10" rx="5" fill="#fff" opacity="0.55" />
    </svg>
  );
}

interface Props {
  size?: number;
  className?: string;
}

export function DaemonLogo({ size = 28, className = '' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Daemon Personal"
      className={`shrink-0 ${className}`}
    >
      <rect width="512" height="512" rx="116" fill="#15171C" />
      <path
        d="M208 92 H304 L368 196 L312 408 H236 L190 456 V408 H200 L144 196 Z"
        fill="none"
        stroke="#8C95AA"
        strokeWidth="18"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="256" cy="236" r="28" fill="#8C95AA" />
      <g opacity="0.72" stroke="#8C95AA" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <g transform="rotate(-10 84 238)">
          <path d="M58 216 C58 176 110 176 110 216 C110 242 84 246 84 270" />
          <circle cx="84" cy="304" r="1" />
        </g>
        <g transform="rotate(10 428 238)">
          <path d="M428 176 V270" />
          <circle cx="428" cy="304" r="1" />
        </g>
      </g>
    </svg>
  );
}

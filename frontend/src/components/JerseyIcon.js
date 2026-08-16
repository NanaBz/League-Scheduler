import React, { useId } from 'react';

/**
 * Kit icon: optional linear gradient (gradientFrom + gradientTo), else flat `primary`.
 * Sleeves use a darker shade of the end colour for depth.
 */
export default function JerseyIcon({
  size = 56,
  primary = '#888',
  stroke = '#1f2937',
  gradientFrom,
  gradientTo,
  className,
}) {
  const uid = useId().replace(/:/g, '');
  const gradId = `jersey-fill-${uid}`;
  const useGradient = Boolean(gradientFrom && gradientTo);
  const fill = useGradient ? `url(#${gradId})` : primary;
  const sleeveTone = useGradient ? gradientTo : primary;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {useGradient && (
        <defs>
          <linearGradient id={gradId} x1="12%" y1="0%" x2="88%" y2="100%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>
      )}
      {/* Main shirt */}
      <path
        d="M20 11 L24 7 L40 7 L44 11 L54 15 L50 23 L46 21 L46 53 L18 53 L18 21 L14 23 L10 15 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      {/* Sleeves — slightly darker */}
      <path
        d="M10 15 L14 23 L18 21 L18 17 L13 18 Z"
        fill={sleeveTone}
        opacity={useGradient ? 0.45 : 0.28}
      />
      <path
        d="M54 15 L50 23 L46 21 L46 17 L51 18 Z"
        fill={sleeveTone}
        opacity={useGradient ? 0.45 : 0.28}
      />
      {/* Collar / neck */}
      <path
        d="M24 7 L32 12 L40 7 L36 10 L28 10 Z"
        fill={stroke}
        opacity="0.92"
      />
      {/* Hem highlight */}
      <path
        d="M22 48 L42 48"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

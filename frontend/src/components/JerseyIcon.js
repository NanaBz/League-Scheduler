import React from 'react';

// Flat-color SVG jersey. Props: size, primary, stroke
export default function JerseyIcon({ size = 56, primary = '#888', stroke = '#1f2937' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Shirt body */}
      <path
        d="M20 10 L24 6 L40 6 L44 10 L54 14 L50 22 L46 20 L46 54 L18 54 L18 20 L14 22 L10 14 Z"
        fill={primary}
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Sleeves shading (same hue, subtle depth) */}
      <path d="M10 14 L14 22 L18 20 L18 16 L14 18 Z" fill={primary} opacity="0.25" />
      <path d="M54 14 L50 22 L46 20 L46 16 L50 18 Z" fill={primary} opacity="0.25" />
      {/* Collar */}
      <path d="M24 6 L32 6 L40 6 L36 10 L28 10 Z" fill={stroke} />
    </svg>
  );
}

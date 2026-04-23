import React from 'react';

interface PathAnimationProps {
  text?: string;
  fontSize?: number;
  duration?: string;
  strokeColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  repeatCount?: string;
  strokeWidth?: number;
  width?: number;
  height?: number;
  viewBox?: string;
  fontFamily?: string;
  className?: string;
}

const PathAnimation: React.FC<PathAnimationProps> = ({
  text = 'VISAION',
  fontSize = 88,
  duration = '3s',
  strokeWidth = 2,
  gradientFrom = '#c98f0a',
  gradientTo = '#f5c842',
  repeatCount = '1',
  width = 1000,
  height = 200,
  viewBox = '0 0 800 160',
  fontFamily = 'Outfit, sans-serif',
  className,
}) => {
  return (
    <div className={`flex justify-center items-center ${className ?? ''}`}>
      <svg width={width} height={height} viewBox={viewBox} className="max-w-full">
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradientFrom} />
            <stop offset="100%" stopColor={gradientTo} />
          </linearGradient>
        </defs>

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="none"
          stroke="url(#pathGradient)"
          strokeWidth={strokeWidth}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily={fontFamily}
          strokeDasharray="1000"
          strokeDashoffset="1000"
          letterSpacing="0.25em"
        >
          {text}
          <animate
            attributeName="stroke-dashoffset"
            values="1000;0"
            dur={duration}
            repeatCount={repeatCount}
            fill="freeze"
            calcMode="spline"
            keySplines="0.25 0.1 0.25 1"
          />
        </text>
      </svg>
    </div>
  );
};

export default PathAnimation;

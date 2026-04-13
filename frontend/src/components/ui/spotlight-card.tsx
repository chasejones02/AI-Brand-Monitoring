import React, { useEffect, useRef, ReactNode } from 'react';

// Brand orange — matches --accent: #c98f0a in globals.css
const BRAND = '201, 143, 10';

interface GlowCardProps {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
  /** Border radius in px. Drives both the card corner and the glow border radius. */
  radius?: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96'
};

const GlowCard: React.FC<GlowCardProps> = ({
  children,
  className = '',
  style: externalStyle,
  size = 'md',
  width,
  height,
  customSize = false,
  radius,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      if (!cardRef.current) return;
      // Card-relative coords — works correctly under backdrop-filter/transform
      const rect = cardRef.current.getBoundingClientRect();
      cardRef.current.style.setProperty('--x', (e.clientX - rect.left).toFixed(2));
      cardRef.current.style.setProperty('--y', (e.clientY - rect.top).toFixed(2));
    };
    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const getSizeClasses = () => (customSize ? '' : sizeMap[size]);

  const getInlineStyles = (): React.CSSProperties & Record<string, string | number> => {
    const r = radius ?? 14;

    const baseStyles: React.CSSProperties & Record<string, string | number> = {
      '--radius': String(r),
      '--border': '2',
      '--size': '300',
      '--border-size': 'calc(var(--border, 2) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      borderRadius: `${r}px`,
      // Subtle orange fill that follows the cursor — adds warmth behind the content
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, -9999) * 1px)
        calc(var(--y, -9999) * 1px),
        rgba(${BRAND}, 0.07), transparent
      )`,
      backgroundColor: `rgba(${BRAND}, 0.015)`,
      backgroundAttachment: 'scroll',
      backgroundSize: '100% 100%',
      backgroundPosition: '0 0',
      // Transparent — the visible border is painted entirely by ::before / ::after
      border: 'var(--border-size) solid transparent',
      position: 'relative',
      touchAction: 'none',
    };

    if (width !== undefined) {
      (baseStyles as Record<string, string | number>).width =
        typeof width === 'number' ? `${width}px` : width;
    }
    if (height !== undefined) {
      (baseStyles as Record<string, string | number>).height =
        typeof height === 'number' ? `${height}px` : height;
    }

    return { ...externalStyle, ...baseStyles };
  };

  // Mask technique for "border strip only":
  //   Two white gradients — one clipped to content-box, one to border-box.
  //   XOR (exclude) shows only the area in exactly one: the border ring.
  //
  // ::before  — persistent orange border, always visible on every edge
  // ::after   — orange spotlight that intensifies near the cursor
  //
  // Nested [data-glow] divs (the inner element) have their pseudo-elements
  // suppressed so they don't produce a second border ring.
  const styles = `
    [data-glow]::before {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      padding: var(--border-size);
      border-radius: calc(var(--radius) * 1px);
      background: rgba(${BRAND}, 0.38);
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
    }

    [data-glow]::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      padding: var(--border-size);
      border-radius: calc(var(--radius) * 1px);
      background: radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, -9999) * 1px)
        calc(var(--y, -9999) * 1px),
        rgba(${BRAND}, 1)   0%,
        rgba(${BRAND}, 0.5) 30%,
        transparent         65%
      );
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
    }

    [data-glow] [data-glow]::before,
    [data-glow] [data-glow]::after {
      display: none;
    }

    [data-glow] [data-glow] {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: none;
      border: none;
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div
        ref={cardRef}
        data-glow
        onClick={onClick}
        style={getInlineStyles()}
        className={`
          ${getSizeClasses()}
          ${!customSize ? 'aspect-[3/4]' : ''}
          rounded-2xl
          relative
          grid
          grid-rows-[1fr_auto]
          shadow-[0_1rem_2rem_-1rem_black]
          p-4
          gap-4
          backdrop-blur-[5px]
          ${className}
        `.trim().replace(/\s+/g, ' ')}
      >
        <div ref={innerRef} data-glow></div>
        {children}
      </div>
    </>
  );
};

export { GlowCard };

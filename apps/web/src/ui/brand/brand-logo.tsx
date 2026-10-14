import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'lockup' | 'mark';
  /** White wordmark for the dark sidebar. */
  onDark?: boolean;
  className?: string;
  alt?: string;
};

const ASSETS = {
  lockup: { src: '/brand/lobi-logo-ink-v5.png', width: 962, height: 521 },
  lockupOnDark: { src: '/brand/lobi-logo-v5.png', width: 962, height: 521 },
  mark: { src: '/brand/lobi-mark-v8.png', width: 1024, height: 1024 },
} as const;

/** lobi CRM wordmark. The mark is the pea pod for the narrow sidebar. */
export function BrandLogo({
  variant = 'lockup',
  onDark = false,
  className,
  alt = 'lobi CRM',
}: BrandLogoProps) {
  const asset = variant === 'lockup' && onDark ? ASSETS.lockupOnDark : ASSETS[variant];
  return (
    <span className={className}>
      <Image
        src={asset.src}
        alt={alt}
        width={asset.width}
        height={asset.height}
        unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </span>
  );
}

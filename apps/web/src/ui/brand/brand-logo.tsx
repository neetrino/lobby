import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'lockup' | 'mark';
  className?: string;
  alt?: string;
};

const ASSETS = {
  lockup: { src: '/brand/lobi-logo-v2.png', width: 965, height: 547 },
  mark: { src: '/brand/lobi-mark-v3.png', width: 444, height: 547 },
} as const;

/** lobi CRM wordmark. The mark is the pea pod for the narrow sidebar. */
export function BrandLogo({ variant = 'lockup', className, alt = 'lobi CRM' }: BrandLogoProps) {
  const asset = ASSETS[variant];
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

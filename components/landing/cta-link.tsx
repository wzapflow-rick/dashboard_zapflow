'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MetaEvents } from '@/components/meta-pixel';
import { SIGNUP_URL } from './content';

type Props = {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  href?: string;
};

const sizes = {
  sm: 'h-10 px-4 text-sm',
  md: 'h-12 px-6 text-base',
  lg: 'h-14 px-8 text-lg',
};

export function CtaLink({ children, size = 'md', className = '', href = SIGNUP_URL }: Props) {
  return (
    <Link
      href={href}
      onClick={() => MetaEvents.startTrial()}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 font-semibold text-emerald-950 shadow-[0_0_0_1px_rgba(16,185,129,0.4),0_10px_40px_-10px_rgba(16,185,129,0.7)] transition-[box-shadow,filter] hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.6),0_14px_50px_-8px_rgba(16,185,129,0.9)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 ${sizes[size]} ${className}`}
    >
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackType = 'success' | 'error' | 'warning' | 'loading';

interface ActionFeedbackProps {
  show: boolean;
  type: FeedbackType;
  message: string;
  onHide?: () => void;
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
}

const feedbackConfig = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-500/90',
    glow: 'shadow-emerald-500/30',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-500/90',
    glow: 'shadow-red-500/30',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-500/90',
    glow: 'shadow-amber-500/30',
  },
  loading: {
    icon: Loader2,
    bg: 'bg-blue-500/90',
    glow: 'shadow-blue-500/30',
  },
};

export function ActionFeedback({
  show,
  type,
  message,
  onHide,
  duration = 2500,
  position = 'bottom',
}: ActionFeedbackProps) {
  const config = feedbackConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (show && type !== 'loading' && onHide) {
      const timer = setTimeout(onHide, duration);
      return () => clearTimeout(timer);
    }
  }, [show, type, duration, onHide]);

  const positionClasses = {
    top: 'top-4',
    bottom: 'bottom-4',
    center: 'top-1/2 -translate-y-1/2',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: position === 'top' ? -20 : 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position === 'top' ? -20 : 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-full backdrop-blur-md',
            'flex items-center gap-2 text-white text-sm font-medium',
            'shadow-lg',
            config.bg,
            config.glow,
            positionClasses[position]
          )}
        >
          <Icon className={cn('size-4', type === 'loading' && 'animate-spin')} />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook para facilitar uso do feedback
export function useActionFeedback() {
  const [feedback, setFeedback] = useState<{
    show: boolean;
    type: FeedbackType;
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedback({ show: true, type, message });
  };

  const hideFeedback = () => {
    setFeedback((prev) => ({ ...prev, show: false }));
  };

  const success = (message: string) => showFeedback('success', message);
  const error = (message: string) => showFeedback('error', message);
  const warning = (message: string) => showFeedback('warning', message);
  const loading = (message: string) => showFeedback('loading', message);

  return {
    feedback,
    showFeedback,
    hideFeedback,
    success,
    error,
    warning,
    loading,
    FeedbackComponent: () => (
      <ActionFeedback
        show={feedback.show}
        type={feedback.type}
        message={feedback.message}
        onHide={hideFeedback}
      />
    ),
  };
}

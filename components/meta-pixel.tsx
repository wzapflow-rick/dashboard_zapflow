'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PIXEL_ID = '1993504354377402';

// Declare fbq for TypeScript
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function MetaPixel() {
  const pathname = usePathname();

  // Track page views on route change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// Helper function to track custom events
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
}

// Common events for ZapFlow
export const MetaEvents = {
  // When someone clicks to start free trial
  startTrial: () => trackEvent('StartTrial', { value: 0, currency: 'BRL' }),
  
  // When someone clicks WhatsApp button
  contact: () => trackEvent('Contact'),
  
  // When someone submits a lead form
  lead: (value?: number) => trackEvent('Lead', { value: value || 0, currency: 'BRL' }),
  
  // When someone views pricing
  viewContent: (contentName: string) => trackEvent('ViewContent', { content_name: contentName }),
  
  // When someone completes registration
  completeRegistration: () => trackEvent('CompleteRegistration'),
  
  // When someone subscribes
  subscribe: (value: number, plan: string) => trackEvent('Subscribe', { 
    value, 
    currency: 'BRL',
    predicted_ltv: value * 12,
    content_name: plan
  }),
};

"use client";

import React, { useEffect, useRef } from "react";

interface AdSlotProps {
  position: "left" | "right";
  adSlotId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AdSlot({ position, adSlotId, className = "", style }: AdSlotProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const isAdConfigured = Boolean(clientId && adSlotId);

  useEffect(() => {
    if (isAdConfigured && typeof window !== "undefined") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (err) {
        console.warn("[AdSense] ad push error:", err);
      }
    }
  }, [isAdConfigured, adSlotId]);

  if (!isAdConfigured) {
    return null;
  }

  return (
    <aside
      className={`ad-sidebar ad-sidebar-${position} ${className}`}
      style={style}
      aria-label={`Advertisement ${position} sidebar`}
    >
      <div className="ad-sticky-wrapper">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "inline-block", width: 160, height: 600 }}
          data-ad-client={clientId}
          data-ad-slot={adSlotId}
          data-ad-format="vertical"
          data-full-width-responsive="false"
        />
      </div>
    </aside>
  );
}


interface AdSidebarContainerProps {
  children: React.ReactNode;
  leftSlotId?: string;
  rightSlotId?: string;
}

export function AdSidebarContainer({ children, leftSlotId, rightSlotId }: AdSidebarContainerProps) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const defaultLeft = leftSlotId ?? process.env.NEXT_PUBLIC_ADSENSE_LEFT_SLOT;
  const defaultRight = rightSlotId ?? process.env.NEXT_PUBLIC_ADSENSE_RIGHT_SLOT;

  if (!clientId || (!defaultLeft && !defaultRight)) {
    return <>{children}</>;
  }

  return (
    <div className="ad-layout-root">
      <AdSlot position="left" adSlotId={defaultLeft} />
      <div className="ad-layout-content">{children}</div>
      <AdSlot position="right" adSlotId={defaultRight} />
    </div>
  );
}


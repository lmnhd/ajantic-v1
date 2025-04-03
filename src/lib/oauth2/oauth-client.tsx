"use client";

import { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const createGenericAuthPopup = (platform: string) => {
  return new Promise<{ code: string }>((resolve, reject) => {
    // Client-side popup handling
    const popup = window.open(
      `/api/oauth2/${platform}/auth`,
      `${platform}Auth`,
      "width=500,height=600"
    );

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'OAUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        resolve({ code: event.data.code });
        popup?.close();
      }
    };

    window.addEventListener('message', handleMessage);
  });
};
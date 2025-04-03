"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { createRoot } from 'react-dom/client';

// Browser-safe version of auth type (only what's needed for auth flow)
export interface GmailAuthBrowser {
  clientId: string;
  accessToken?: string;
  refreshToken?: string;
}

// Helper function for auth modal
export const createAuthPopup = (authUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const modalContainer = document.createElement('div');
    document.body.appendChild(modalContainer);

    const Modal = () => {
      const [isOpen, setIsOpen] = useState(true);

      const handleAuth = () => {
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          `/api/oauth2/gmail/auth`,
          'GmailAuth',
          `width=${width},height=${height},left=${left},top=${top}`
        );
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'OAUTH_SUCCESS' && event.data.platform === 'gmail') {
            console.log("gmail-client: OAUTH_SUCCESS:", event.data);
            cleanup();
            resolve(event.data.code);
            popup?.close();
            setIsOpen(false);
          }
        };

        const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          setTimeout(() => document.body.removeChild(modalContainer), 100);
        };

        window.addEventListener('message', handleMessage);
      };

      return (
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            reject({ 
              cancelled: true, 
              message: 'Authentication was cancelled by the user' 
            });
            setTimeout(() => document.body.removeChild(modalContainer), 100);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gmail Authentication</DialogTitle>
            </DialogHeader>
            <Button onClick={handleAuth}>
              Sign in with Google
            </Button>
          </DialogContent>
        </Dialog>
      );
    };

    const root = createRoot(modalContainer);
    root.render(<Modal />);
  });
}; 
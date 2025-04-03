import React from 'react'
import { authConfig } from '@/src/config/auth'
import {  SignInPopupButton } from '../src/lib/oauth2/components/sign-in-popup-button'
import { Label } from '@/components/ui/label'
export default function OauthPanel({userId}: {userId: string}) {
  return (
    // <MultiPlatformAuthStatus platforms={authConfig.providers.map((provider) => provider.name)} userId={userId} />
    // <SignInPopupButton platforms={authConfig.providers.map((provider) => provider.name)} userId={userId} />
    <div className='flex flex-wrap px-4 items-center justify-center bg-black/60 rounded-md p-2 gap-2'>
        {authConfig.providers.map((provider) => (
            <div 
            key={provider.name}
            className='flex flex-col gap-2 text-indigo-500 bg-indigo-800 rounded-md p-2'
            
            >
                <Label>{provider.name}</Label>
                <SignInPopupButton key={provider.name} platform={provider.name} userId={userId} />
            </div>
        ))}
    </div>

  )
}


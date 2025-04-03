import { cn } from '@/src/lib/utils'
import React from 'react'

export default function HorizontalDivider({reverseColor}:{reverseColor?: boolean}) {
  return (
    <div className={cn("h-2 border-b-2 animate-pulse shadow-lg? shadow-white/20 shadow-inner rounded-xl w-2/3 my-3", reverseColor ? "bg-gradient-to-r from-indigo-500/50 to-violet-500/50 via-pink-500" : "bg-gradient-to-r from-pink-500/50 to-pink-500/50 via-indigo-500")}></div>
  )
}

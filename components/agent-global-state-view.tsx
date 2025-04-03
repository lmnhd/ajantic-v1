import { useGlobalStore } from '@/src/lib/store/GloabalStoreState'
import { cn, UTILS_getGenericData } from '@/src/lib/utils'
import React from 'react'

export default function AgentGlobalStateView() {
    const {globalMessages} = useGlobalStore()
    const obj = globalMessages.currentState.genericData.AGENT_GLOBAL_STATE
  return (
    <div className={cn("flex flex-col items-start p-6 justify-start w-full h-full bg-black/50")}>
    <div className="text-xl m-4 p-2 border-b-2 border-white/20 font-bold">Agent Object Storage</div>
        <div className="flex flex-col rounded-md shadow-sm p-12 border-r border-pink-500 bg-white/5 items-start justify-start w-full h-full">
            {obj && Object.keys(obj).map((key) => {
                return <div className="flex flex-row items-start justify-start border border-white/20 p-2 rounded-md" key={key}>
                    <span className="font-bold">{key}</span>:
                    <span>{JSON.stringify(obj[key])}</span>
                </div>
            })}
        </div>
    </div>
  )
}

import React, { useState } from 'react'

export default function TempoControl({tempoChanged,inputTempo}:{tempoChanged:any, inputTempo:number}) {
    const [tempo, setTempo] = useState<number>(inputTempo);
const updateTempo = (e:any) => {
    console.log('tempo (control)', e.target.value);
    setTempo(e.target.value);
    
    tempoChanged(e.target.value);
}
const incrementTempo = (upordown:string) => {
    console.log('tempo (control)', tempo)
    if(tempo < 51 || tempo > 239){return}
    if(upordown == 'up'){
        setTempo(Math.round(tempo + 1));
        tempoChanged(tempo + 1);
    }else{
        setTempo(Math.round(tempo - 1));
        tempoChanged(tempo - 1);
    }
}

  return (
    <div className='flex flex-col gap-1 w-20'>
        <button className='bg-violet-900/30 border-[1px] border-lime-600' onClick={() => incrementTempo('up')}>+</button>
        <input type="number" title="tempo" value={inputTempo} min={50} max={240}
    onInput={updateTempo} className='text-xl text-black align-middle text-center bg-lime-500 rounded-lg' />
        <button className='bg-violet-900/30 border-[1px] border-lime-600' onClick={() => incrementTempo('down')}>-</button>
    </div>
  )
}

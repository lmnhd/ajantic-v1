import React, { useEffect, useRef } from 'react'

export default function useCanvas(draw:any,waveForm:any, options:{context:string} = {context:"2d"}) {
    const canvasRef = useRef(null);

    useEffect(() => {

    
        const canvas: any = canvasRef.current;
    
        const context = canvas.getContext(options.context || "2d");
        let frameCount = 0
        let animationFrameId:number
        
        //Our draw came here
        const render = () => {
          frameCount++
          draw(waveForm,context, frameCount)
          animationFrameId = window.requestAnimationFrame(render)
        }
        render()
        
        return () => {
          window.cancelAnimationFrame(animationFrameId)
        }
        
      }, [draw]);
    
      return canvasRef
 
}

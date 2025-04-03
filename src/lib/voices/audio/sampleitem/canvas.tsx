"use client"
import React, { useEffect, useRef } from "react";



const useCanvas = (draw:any,waveForm:any, options:{context:string} = {context:"2d"}) => {
  
  const canvasRef = useRef(null);

//   const draw = (ctx:any, frameCount:number) => {
//     ctx.fillStyle = "#000000";
//     ctx.beginPath();
//     ctx.arc(50, 100, 20*Math.sin(frameCount*0.05)**2, 0, 2*Math.PI);
//     ctx.fill();
//   };
function resizeCanvasToDisplaySize(canvas:any) {
    
    const { width, height } = canvas.getBoundingClientRect()

    if (canvas.width !== width || canvas.height !== height) {
        const { devicePixelRatio:ratio=1 } = window
        const context = canvas.getContext('2d')
        canvas.width = width*ratio
        canvas.height = height*ratio
        context.scale(ratio, ratio)
      return true // here you can return some usefull information like delta width and delta height instead of just true
      // this information can be used in the next redraw...
    }

    return false
  }
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
};

export default useCanvas;

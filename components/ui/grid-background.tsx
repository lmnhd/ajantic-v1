import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { TextGenerateEffect } from "./text-generate-effect";
import { TypewriterEffect, TypewriterEffectSmooth } from "./typewriter-effect";

export default function GridBackground({
  children,
  text
}: {
  children?: React.ReactNode;
  text?: string;
}) {
  // const [textDisplay, setTextDisplay] = React.useState(<motion.p 
  //   initial={{ opacity: 0, y: 20 }}
  //   animate={{ opacity: 1, y: 0 }}
  //   transition={{ duration: 0.5 }}
  //   className="text-4xl text-center sm:text-6xl font-bold relative z-20 bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-500 py-8"
  //   >
  //     {text}
  //   </motion.p>);
  useEffect(() => {
    
    // setTextDisplay(<motion.p 
    //   initial={{ opacity: 0, y: Math.floor(Math.random() * 20) }}
    //   animate={{ opacity: 1, y: 0 }}
    //   transition={{ duration: 0.5 }}
    //   className="text-3xl text-center sm:text-5xl font-bold relative z-20 bg-clip-text text-transparent bg-gradient-to-b from-neutral-200 to-neutral-500 py-8"
    //   >
    //     {text}
    //   </motion.p>)
  },[text])
 
  return (
    <div className="h-[10rem] w-2/3 ml-auto my-6 dark:bg-black bg-white  dark:bg-grid-white/[0.2] bg-grid-black/[0.2] relative flex items-center justify-center">
      {/* Radial gradient for the container to give a faded look */}
      <div className="absolute ml-auto pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
      {children && children}
      </div>
      {/* <TypewriterEffectSmooth words={[{text: text!, className:"font-bold text-3xl sm:text-5xl text-center"}]} /> */}
     <motion.p 
      initial={{ opacity: 0, y: Math.floor(Math.random() * 20) }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-3xl text-center sm:text-5xl font-bold relative z-20 bg-clip-text text-transparent text-violet-300 bg-gradient-to-b from-neutral-200 to-neutral-500 py-8"
      >
       {text}
      </motion.p>
    </div>
  );
}

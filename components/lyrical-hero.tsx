import React, { useEffect } from "react";
import GridBackground from "./ui/grid-background";
import { SkullIcon } from "lucide-react";

export default function LyricalHero() {
  const messages = [
    //"AI Killed the songwriter :(",
    "Combine styles and get creative!",
    "Get it 'Write' from the source!",
   
    "Build your collection!",
  ];
  const [message, setMessage] = React.useState(messages[0]);

  useEffect(() => {
    // select random message from array every 5 seconds
    const interval = setInterval(() => {
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 5000);
    //console.log(message)
    return () => clearInterval(interval);

  }, []);
  return (
    <div>
      {" "}
      <GridBackground text={message}>
        <SkullIcon />
      </GridBackground>
    </div>
  );
}

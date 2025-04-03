import { SERVER_getLotsOfDilemmas } from "@/src/lib/server";
import React, { ChangeEventHandler, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DilemmaInput({
  value,
  handleInputChange,
  handlePresetChange,
}: {
  value: string;
  handleInputChange: ChangeEventHandler<HTMLTextAreaElement>;
  handlePresetChange: (dilemma: string) => void;
}) {
  const [dilemmas, setDilemmas] = useState<Array<string>>([
    "A fun and flirty invitation to a night of dancing and revelry.",
    "Struggling to cope with heartbreak and longing for a lost love during the bleak winter season in Vermont.",
    "A woman standing her ground and warning Karen not to come for her man.",
    "Being possessive and obsessed with wanting every part of someone, despite the negative impact it has on mental health.",
    "Feeling liberated and free after cutting off a toxic relationship.",
    "Describing the pleasure of being physically intimate without emotional attachment.",
    "Expressing gratitude for the good things in life, but also fears of losing them.",
    "Finding solace and escape in a bar after heartbreak.",
    "This song expresses the desire to publicly display affection for a partner and demonstrate pride in the relationship.",
    "A chill and carefree vibe enjoying gin and juice while cruising down the street.",
    " A boastful anthem about making it big and living a luxurious lifestyle.",
    "A young woman confidently asserts her individuality and warns a potential suitor not to underestimate her.",
    "Spoiling a high-maintenance woman and giving her anything she desires, even when she frustrates and annoys.",
    "Reflect on leaving home at a young age and the sacrifices made to pursue dreams.",
    "Embracing my confidence and sexiness, I am living my best life without relying on anyone else.",
  ]);

  const [placeHolder, setPlaceHolder] = useState(dilemmas[0]);

  useEffect(() => {
    // select random dilemma from array every 10 seconds
    const interval = setInterval(() => {
      setPlaceHolder(dilemmas[Math.floor(Math.random() * dilemmas.length)]);
    }, 10000);
    return () => clearInterval(interval);
  }, [dilemmas]);

  useEffect(() => {
    const start = async () => {
      const moreDilemmas = await SERVER_getLotsOfDilemmas();
      setDilemmas(prevDilemmas => [...prevDilemmas, ...moreDilemmas]);
    };

    start();
  }, []);

  return (
    <div className={`m-20`}>
      <div className="flex justify-center items-center bg-transparent">
        <h1 className="my-6 bg-transparent w-1/3">What is this song about?</h1>
        <Select
          //onChange={(e) => console.log(e.target.value)}
          onValueChange={(e) => handlePresetChange(e)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue>{value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {dilemmas.map((dilemma, index) => (
              <SelectItem
                value={dilemma}
                className="w-1/3 bg-black"
                key={index}
              >
                {dilemma}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-center">
        <textarea
          placeholder={placeHolder}
          className="w-full rounded-lg p-4 text-2xl bg-blue-600/20 border-indigo-600"
          onChange={handleInputChange}
          rows={20}
          value={value}
        />
      </div>
    </div>
  );
}

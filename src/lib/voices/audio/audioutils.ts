import * as SampleTypes from "@/src/lib/voices/audio/audiotypes";
export const DrumColorArray = [
    "bg-gradient-to-br from-violet-900 via-purple-950 to-violet-800",
    "bg-gradient-to-br from-red-900 via-fuchsia-800 to-red-800",
    "bg-gradient-to-br from-yellow-900 via-amber-800 to-yellow-800",
    "bg-gradient-to-br from-green-900 via-lime-800 to-green-800",
    "bg-gradient-to-br from-blue-900 via-blue-800 to-blue-800",
    "bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-800",
    "bg-gradient-to-br from-pink-900 via-rose-800 to-pink-800",
    "bg-gradient-to-br from-gray-900 via-slate-800 to-gray-800",
    "bg-gradient-to-br from-slate-900 via-gray-800 to-slate-800",
    "bg-gradient-to-br from-violet-900 via-purple-950 to-violet-800",
    "bg-gradient-to-br from-red-900 via-fuchsia-800 to-red-800",
    "bg-gradient-to-br from-yellow-900 via-amber-800 to-yellow-800",
    "bg-gradient-to-br from-green-900 via-lime-800 to-green-800",
    "bg-gradient-to-br from-blue-900 via-blue-800 to-blue-800",
    "bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-800",
    "bg-gradient-to-br from-pink-900 via-rose-800 to-pink-800",
    "bg-gradient-to-br from-gray-900 via-slate-800 to-gray-800",
    "bg-gradient-to-br from-slate-900 via-gray-800 to-slate-800",
    "bg-gradient-to-br from-violet-900 via-purple-950 to-violet-800",
  ];
  export const getDrumColor = (drum: string) => {
    const drumArray = Object.keys(SampleTypes.Drum);
    const index = drumArray.findIndex((item) => item === drum);
    return DrumColorArray[index];
  };
  
  export const getDateAsIDString = () => {
    const date = new Date();
    const dateString = `${date.getFullYear()}${date.getMonth()}${date.getDay()}${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
    return dateString;
  };
  
  export const landingPageHeaders = [
    {text: "Quickly create drum kits for your next track!"},
    {text: "Audition drum samples and SFX in your browser!"},
    {text: "Industry quality samples collected from producers throughout the decades!"},
    {text: "Largest sound library on the internet!"},
    {text: "Package and download kits for use in your DAW!"},
    {text: "AI powered beat generation!"},
  ]
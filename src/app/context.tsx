import { createContext } from 'react';
import { AudioURL } from '@/lib/speech/voices-types';

interface AppContextType {
  audioURLs: AudioURL[];
  setAudioURLs: React.Dispatch<React.SetStateAction<AudioURL[]>>;
}

export const AppContext = createContext<AppContextType>({
  audioURLs: [],
  setAudioURLs: () => {},
}); 
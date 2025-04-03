import { Artist } from "@/src/lib/types";
import { suggestMoreArtistsMessage } from "@/src/lib/webdata";
import React, { useContext } from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storeResearchSet } from "@/app";
import Image from "next/image";
import { useToast } from "../ui/use-toast";
import { KitzContext } from "@/src/lib/voices/audio/kitzcontext";

const ArtistSelectOptions = ({
  sets,
  handleSetSelected,
}: {
  sets: {id: number, name:string}[];
  handleSetSelected: (id: number) => void;
}) => {
  
  const { toast } = useToast();
  
  const { selectedArtists,setSelectedArtists, setResearchSetLinks, researchSetLinks } = useContext(KitzContext)
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Inspirations...</MenubarTrigger>
        <MenubarContent>
          {/* <MenubarItem>
            New Tab <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem> */}
          <MenubarItem
            onClick={async () => {
              // prompt user for a title
              const title = (await window.prompt(
                "Enter a title for this research set:",
                new Date().toISOString()
              )) as string;
              const id = await storeResearchSet(selectedArtists, title);
              setResearchSetLinks([
                ...researchSetLinks,
                { name: title, id: id },
              ]);
              toast({
                title: "Research set saved!",
              });
            }}
          >
            Save set
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem>
            
            <Select
            onValueChange={async (value: string) => {
              //console.log("value", value);
              if (value) {
                const id = parseInt(value);
               await handleSetSelected(id);
                //setSelectedArtists([...selectedArtists, ...newArtists!]);
              }
            }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Load Set" />
              </SelectTrigger>
              <SelectContent>
               {sets.map((set) => (
                <SelectItem
                  key={set.id}
                  onClick={async () => {
                    // const newArtists = await handleSetSelected(set.id);
                    // setSelectedArtists([...selectedArtists, ...newArtists!]);
                  }}
                  value={String(set.id)}
                >
                  {set.name}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
          onClick={() => setSelectedArtists([])}
          >Clear</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
};
export default function SelectedArtists({
  artists,
  removeArtist,
  sets,
  handleSetSelected
}: {
  artists: Artist[];
  removeArtist: (index: number) => void;
  sets: {id: number, name:string}[];
  handleSetSelected: (id: number) => void;
}) {
  return (
    <div className="m-20? max-w-lg lg:max-w-3xl mx-auto mt-32">
      {/* <h1>Inspirations...</h1> */}
      <ArtistSelectOptions 
      handleSetSelected={handleSetSelected}
      sets={sets}
      
      />
      <div className="flex flex-col text-lg gap-4 text-violet-500 font-bold h-[600px] overflow-y-auto">
        {artists.map((artist, index) => {
          return (
            <div
              key={index}
              className="grid columns-4 items-center gap-4 h-28 border-b-[1px] hover:cursor-pointer hover:bg-red-500/40 "
              onClick={() => removeArtist(index)}
            >
              {artist.songs.length > 0 &&
                artist.songs.map((song) => (
                  <div
                    className="flex items-center justify-between gap-4 col-span-3"
                    key={song.title}
                  >
                    <span className="flex items-center gap-8" key={song.title}>
                      {artist.name}
                      {" - "}
                      {song.title}
                    </span>
                    {song.img && (
                      <Image
                        className="float-left object-fill rounded-full"
                        alt={song.title}
                        src={song.img}
                        width={80}
                        height={80}
                      />
                    )}
                  </div>
                ))}
            </div>
          );
        })}
        {artists.length > 0 && artists.length < 3 && (
          <div className="text-sm text-gray-500 w-2/3 mx-auto italic p-4">
            {suggestMoreArtistsMessage}
          </div>
        )}
      </div>
    </div>
  );
}

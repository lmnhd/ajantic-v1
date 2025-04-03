"use client";
import {
  Top100Songs,
  FoundAlbum,
  FoundArtist,
  FoundSong,
  FoundTopHit,
} from "@/src/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "../ui/label";
import { motion } from "framer-motion";
import React, { useState } from "react";
import { Input } from "../ui/input";
import { BackgroundGradient } from "../ui/background-gradient";
import { Button } from "../ui/button";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

//CHANGE NAME OF INSPRIRATION COMPONENT TO INSPIRATIONSEARCH AND ARTIST SELECT COMPONENT TO SELECTEDINSPIRATIONS

export type ItemVal = {
  type: "song" | "album" | "artist" | "hit" | "top100";
  value: FoundSong | FoundAlbum | FoundArtist | FoundTopHit | { title: string; artist: string; img: string };
};
export const SearchedItem = ({
  song,
  album,
  artist,
  hit,
  index,
  clickHandler,
}: {
  song?: FoundSong;
  album?: FoundAlbum;
  artist?: FoundArtist;
  hit?: FoundTopHit;
  index: number;
  clickHandler: (value: ItemVal) => void;
}) => {
  const itemValue = song || album || artist || hit;
  if (!itemValue) return null;

  return (
    <div
      key={index}
      className="flex  mx-auto items-center justify-between w-48 h-24 gap-6 m-2 rounded-md shadow-lg  border-t-[1px] border-blue-300 bg-gradient-to-br from-blue-700/10 to-black/5 hover:scale-105 duration-300 ease-in-out"
      onClick={() =>
        clickHandler({
          type: song ? "song" : album ? "album" : artist ? "artist" : "hit",
          value: itemValue,
        })
      }
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="relative flex gap-3 w-full items-center">
          <p className=" top-0 w-full ">
            {song?.artist || album?.artist || artist?.name || hit?.artist}
          </p>
          <Image
            src={itemValue.img}
            alt={song?.title || album?.name || artist?.name || hit?.title || ""}
            width={80}
            height={80}
            className="mt-6 object-cover rounded-full"
          />
        </div>

        <p className="text-xs overflow-hidden">
          {song?.title || album?.name || artist?.name || hit?.title}
        </p>
      </div>
    </div>
  );
};
export default function InspirationsComponent({
  topSongs,
  foundSongs,
  handleSearchInputChanged,
  foundAlbums,
  foundArtists,
  foundHits,
  handleSearchItemClicked,
  createResearchSet,
 
}: {
  topSongs: Top100Songs;
  foundSongs: FoundSong[];
  foundHits: FoundTopHit[];
  foundAlbums: FoundAlbum[];
  foundArtists: FoundArtist[];
  handleSearchInputChanged: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  handleSearchItemClicked: (item: ItemVal) => void;
  createResearchSet: (researchArtistName: string, batchSize: number) => void;
 
}) {
  const [researchArtistName, setResearchArtistName] = useState("");
  const [batchSize, setBatchSize] = useState(10);
  return (
    <Tabs defaultValue="top" className="w-full h-full ">
      <TabsList>
        <TabsTrigger value="top">Top Hits</TabsTrigger>
        <TabsTrigger value="search">Search</TabsTrigger>
        <TabsTrigger value="analyze">Bulk</TabsTrigger>
      </TabsList>
      <TabsContent value="top">
        <div
          className={`flex flex-wrap items-center justify-around w-full  bg-white/10 mx-auto rounded-md p-4 shadow-md`}
        >
          {topSongs.map((song, index) => {
            return (
              <div
                key={index}
                onClick={() =>
                  handleSearchItemClicked({
                    type: "top100",
                    value: {
                      artist: song.artist,
                      title: song.title,
                      img: song.img,
                    },
                  })
                }
              >
                <BackgroundGradient>
                  <motion.div
                    key={index}
                    className="relative flex items-center justify-between w-48 h-24 gap-6 m-2  shadow-lg mx-1 rounded-3xl border-t-[1px] border-blue-300 hover:scale-105 hover:border-[1px] hover:cursor-pointer cursor-none hover:border-pink-300 duration-300 ease-in-out"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.9, type: "bounce" }}
                  >
                    <p className="absolute flex font-extralight items-start justify-start text-center top-0 w-full h-full text-xs bg-gradient-to-br rounded-3xl p-2 from-black to-black/0">
                      {song.artist.slice(0, 32)}
                    </p>
                    <Image
                      src={song.img}
                      alt={song.title}
                      width={80}
                      height={80}
                      className="object-cover rounded-full"
                    />
                    <p className="absolute bottom-0 right-0 text-xs font-bold text-right w-2/3">
                      {song.title}
                    </p>
                  </motion.div>
                </BackgroundGradient>
              </div>
            );
          })}
        </div>
      </TabsContent>
      <TabsContent value="search" className="h-full space-y-10 mx-auto w-full">
        <div className="flex sticky flex-col px-8 items-center justify-center h-full my-7">
          <Input
            type="text"
            placeholder="Search songs, albums, artists..."
            className="w-full p-2 rounded-md"
            onChange={(event) => handleSearchInputChanged(event)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center space-y-20  mx-6 ">
          {foundSongs.length > 0 && (
            <div className="inset-10 bg-violet-600/10 p-10 rounded-md shadow-md">
              <Label className="m-10 text-xl">Songs</Label>
              <div className="flex flex-wrap items-center justify-evenly gap-4 w-full mx-auto">
                {foundSongs.map((song, index) => {
                  return (
                    <SearchedItem
                      clickHandler={handleSearchItemClicked}
                      key={index}
                      index={index}
                      song={song}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-start space-y-20  mx-6 ">
          {foundArtists.length > 0 && (
            <div className="inset-10 bg-violet-600/10 p-10 rounded-md shadow-md">
              <Label className="m-10 text-xl">Artists</Label>
              <div className="flex flex-wrap items-center justify-evenly gap-4 w-full mx-auto">
                {foundArtists.map((artist, index) => {
                  return (
                    <SearchedItem
                      clickHandler={handleSearchItemClicked}
                      key={index}
                      index={index}
                      artist={artist}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end space-y-20  mx-6 ">
          {foundAlbums.length > 0 && (
            <div className="inset-10 bg-violet-600/10 p-10 rounded-md shadow-md">
              <Label className="m-10 text-xl">Albums</Label>
              <div className="flex flex-wrap items-center justify-evenly gap-4 w-full mx-auto">
                {foundAlbums.map((alb, index) => {
                  return (
                    <SearchedItem
                      clickHandler={handleSearchItemClicked}
                      key={index}
                      index={index}
                      album={alb}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center space-y-20  mx-6 ">
          {topSongs.length > 0 && (
            <div className="inset-10 bg-violet-600/10 p-10 rounded-md shadow-md">
              <Label className="m-10 text-xl">Top Hits</Label>
              <div className="flex flex-wrap items-center justify-evenly gap-4 w-full mx-auto">
                {foundHits.map((hit, index) => {
                  return (
                    <SearchedItem
                      clickHandler={handleSearchItemClicked}
                      key={index}
                      index={index}
                      hit={hit}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </TabsContent>
      <TabsContent
        value="analyze"
        className="h-full space-y-10 mx-auto px-10 w-full"
      >
        <div className="flex sticky flex-col px-8 items-center justify-center h-full my-7">
          <Input
            type="text"
            placeholder="Search artist researchArtistName for song list..."
            className="w-full p-2 rounded-md"
            value={researchArtistName}
            onChange={(event) => setResearchArtistName(event.target.value)}
            //onChange={createResearchSet}
          />
          <div className="flex flex-wrap items-center justify-center text-xs gap-4 w-full mx-auto">
            <Label className="m-10 ">Batch Size</Label>
            <Select
            value={batchSize.toString()}
            onValueChange={(value) => setBatchSize(Number(value))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="10"  />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="40">40</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
          className="bg-blue-900 text-pink-200 rounded-md m-8 p-2"
          
          onClick={() => createResearchSet(researchArtistName, batchSize)}>Start</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

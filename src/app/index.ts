"use server";
import { getFetchUrl } from "@/lib/getFetchUrl";
import { Artist, ResearchSet, ResearchSong, Song, WordPlay } from "@/lib/types";

import { db } from "@/lib/db";

import { HumanMessage } from "@langchain/core/messages"
import { checkForOrPrepareSongForUse } from "./api/presongprep";


export async function storeResearchSet(
  listOfArtistSongs: Artist[],
  nameOfSet: string
) {
  console.log(
    `Storing research set: ${listOfArtistSongs[0].songs[0].chorus} - ${nameOfSet}`
  );

  try {
    
    const set: ResearchSet = { name: nameOfSet, songs: [] };
    for (const artist of listOfArtistSongs) {
      for (const song of artist.songs) {
        const { title, lyrics, summary, chorus, img, wordplays } = song;
       // console.log("song: ", song, "artist: ", artist.name, "title: ", title);
        // FIRST CHECK IF SONG EXISTS
        let sng:ResearchSong = await db.researchSong.findFirst({
          where: {
            title,
            artist: artist.name,
          },
          select: {
            title: true,
            artist: true,
            lyrics: true,
            summary: true,
            chorus: true,
            img: true,
            wordplays: true,
          },
        }) as ResearchSong;

        //.log("sng: ", sng);
       // return
        // IF NOT IN DATABASE - CREATE IT
        if (!sng) {
          let wpIDArray: number[] = wordplays.length > 0 ? [] : [-1];
          // FIRST, SAVE WORDPLAY OBJECTS TO DB
          if (wordplays.length > 0) {
            for (const wp of wordplays) {
              const id = await db.wordplay.create({
                data: {
                  name: (wp as WordPlay).name,
                  description: (wp as WordPlay).description,
                  example: (wp as WordPlay).example,
                },
              });
              //STORE THE WORDPLAY ID/s
              wpIDArray.push(id.id);
            }
          }
          // NOW CREATE SONG IN DB
          sng = await db.researchSong.create({
            data: {
              title: title,
              artist: artist.name,
              lyrics: lyrics,
              chorus: chorus,
              img: img,
              summary: summary,
              wordplays: wpIDArray,
            },
            select: {
              id: true,
              title: true,
              artist: true,
              lyrics: true,
              summary: true,
              chorus: true,
              img: true,
              wordplays: true,
            }
          });
        }
        //IF THIS IS A NEW SONG - ID IS NOT RETURNED WHEN CREATED SO WE NEED TO RETRIEVE IT MANUALLY
        let sngId = sng!.id
        if( !sngId)  {
          sngId = (await db.researchSong.findFirst({
            where: {
              title: sng.title,
              artist: sng.artist
            },
            select: {
              id:true
            }
          }) as ResearchSong).id
        }
         
       // PUSH THE SONGS INTO THE SET WITH THE NEW ID
        set.songs.push({
          ...sng, id: sngId!
        });
      }
      
    }
    // CREATE THE SONG SET IN DB
    let id = await db.songSets.create({
      data: {
        name: set.name,
        songs: set.songs.map((song) => song.id as number),
      },
    });
    return id.id;
  } catch (error) {
    console.error(error);
    return 0;
  }

  
}

// export async function getResearchSet(id: number) {
//   const set = await db.songSets.findFirst({
//     where: {
//       id: id,
//     },
//     select: {
//       songs: true,
//     },
//   });
//   // if (set) {
//   //   const songs = await Promise.all(
//   //     set.songs.map(async (id: number) => {
//   //       const song = await db.researchSong.findUnique({
//   //         where: {
//   //           id: id,
//   //         },
//   //         select: {
//   //           title: true,
//   //           artist: true,
//   //           lyrics: true,
//   //           summary: true,
//   //           chorus: true,
//   //         },
//   //       });
//   //       return {
//   //         name: song?.artist,
//   //         songs: [
//   //           {
//   //             title: song?.title,
//   //             lyrics: song?.lyrics,
//   //             summary: song?.summary,
//   //             chorus: song?.chorus,
//   //           },
//   //         ],
//   //       } as Artist;
//   //     })
//   //   );
//   //   return songs;
//   // }
// }

export async function getAllResearchSetIDs() {
  return [];
  const sets = await db.songSets.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return sets;
}

// export async function getLyricsFromDB(song: string, artist: string) {
//   const results = await db.formattedLyrics.findMany({
//     where: {
//       artist: artist,
//       title: song,
//     },
//     select: {
//       lyrics: true,
//       summary: true,
//       title: true,
//       artist: true,
//       img: true,
//       id: true,
//     },
//     orderBy: {
//       createdAt: "asc",
//     },
//   });

//   return results.length > 0 ? results[0] : null ;
// }

// export async function checkForOrPrepareSongForUse(
//   artist: string,
//   title: string,
//   img: string
// ) {
//   try {
//     //console.log(`About to clean these lyrics... ${lyric}, ${artist}, ${title}`);
//     const url = getFetchUrl("api/presongprep");
//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       cache: "no-cache",
//       body: JSON.stringify({ artist, title, img }),
//     });
//     const cleanedLyrics: ResearchSong = await response.json();
//     console.log('cleanedLyrics: ', cleanedLyrics)
//     return cleanedLyrics;
//   } catch (error) {
//     console.log(error);
//     return {
//       lyrics: "",
//       summary: error,
//       title: "Error",
//       artist: "",
//       img: "",
//       wordplays: [],
//       chorus: "",
//       id: -1,
//     } as ResearchSong;
//   }
// }

export async function getLyricsSongObject(
  song: string,
  artist: string,
  img: string
) {
  console.log("getLyricsSongObject called...");
  return await checkForOrPrepareSongForUse({
    artist: artist,
    title: song,
    img: img,
  });
}

async function saveLyricsToDb(lyrics: any, song: string, artist: string) {
  try {
    await db.formattedLyrics.create({
      data: {
        title: song,
        artist: artist,
        lyrics: lyrics.lyrics,
        summary: lyrics.summary,
      },
    });
  } catch (error) {
    console.error("Error saving lyrics to database:", error);
    return "Error saving lyrics to database";
  }
}

export async function loadAllLyrics(artists: Artist[]) {
  const result:Artist[] = []
  for (const artist of artists) {
    const songs = artist.songs
    const newSongs:ResearchSong[] = []
    for (const song of songs) {
      const lyrics = await getLyricsSongObject(song.title, artist.name, song.img || "");
      newSongs.push(lyrics!)
    }
    result.push({
      name: artist.name,
      songs: newSongs
    })
  }
  return result;
}

export async function createNewSongLyricsUsingReferences(
  artists: Artist[],
  dilemma: string,
  userName?: string,
  userId?: string
) {
  try {
    const url = getFetchUrl("api/songwriter");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName: userName ? userName : "",
        artists,
        systemPrompt: dilemma,
        messages: [new HumanMessage({ content: dilemma })],
        userId: userId? userId : "",
      }),
    });
    const newSong = (await response.json()) as string;
    return newSong;
  } catch (error) {
    console.error("Error creating new song:", error);
    return {
      error:
        "There was an issue while trying to write your song. I have logged and flagged it for the team to investigate. Maybe...just try again?.",
    };
  }
}

export async function handleSetSelected(id: number) {
  console.log("handleSetSelected called...");
 // return
  try {
    const _set = await db.songSets.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        songs: true,
      },
    });
    console.log("_set ", _set);
    let artists: Artist[] = [];
    if (_set && _set.songs) {
      const researchSongs = await Promise.all(
        _set.songs.map(async (song) => {
          const researchSong = await db.researchSong.findUnique({
            where: {
              id: song,
            },
            select: {
              artist: true,
              title: true,
              chorus: true,
              lyrics: true,
              summary: true,
              img: true,
              wordplays: true,
              id: true,
            },
          });
          return researchSong;
        })
      );
      //console.log('researchSongs', researchSongs)
      if (researchSongs) {
        //console.log('artists ', artists)

        for (const rsSong of researchSongs) {
          let wps: WordPlay[] = [];
          for (const wordplay of rsSong!.wordplays) {
            const wp = await db.wordplay.findUnique({
              where: {
                id: wordplay,
              },
              select: {
                description: true,
                example: true,
                name: true,
              },
            });
            wps.push(wp!);
          }
          artists.push({
            name: rsSong!.artist,
            songs: [
              {
                title: rsSong!.title,
                chorus: rsSong!.chorus,
                lyrics: rsSong!.lyrics,
                summary: rsSong!.summary,
                img: rsSong!.img,
                wordplays: wps,
              },
            ],
          } as Artist);
        }
      }
      console.log("artists ", artists);
      return artists;
    }
  } catch (err) {
    console.log(err);
  }
}

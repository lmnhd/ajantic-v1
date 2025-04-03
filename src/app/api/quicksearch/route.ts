import { NextResponse } from "next/server";
const { load } = require("cheerio");

export async function POST(request: Request) {
  //console.log('request', request)

  const { query, type } = await request.json();
  //console.log("type = ", type);
  let call = "";

  let page = 1;

  if (type) {
    if (type == "songsForArtist") {
      call = `/api/search/song?q=${query}&page=${page}`;
    }
  } else {
    call = `/api/search/multi?q=${query}`;
  }

  const base = "https://genius.com";

  //console.log("query:", query);

  const url = `${base}${call}`;
  //console.log("url", url);

  try {
    const response = await fetch(url);

    const res = await response.json();
  
    //console.log("res:", res.response.sections[0].hits);
    if (type) {
      if (type == "songsForArtist") {
          console.log('songsForArtist')
          // const results = res.response.sections[0].hits.map((hit) => hit.)
        return NextResponse.json(
          res.response.sections[0].hits.map((hit: any, index: number) => {
            return { title: hit.result.title, lyrics: `${base}${hit.result.path}`, img: hit.result.song_art_image_url };
          })
          //res.response.sections[0].hits
        );
      }
    }
  
    return NextResponse.json({ body: res });
  } catch (error) {
    console.log(error)
  }

  return NextResponse.json({ error: "Error fetching data" });
 
}

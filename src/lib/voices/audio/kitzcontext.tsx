"use client";
import { Context, createContext, useContext, useEffect, useState } from "react";
//import { Sample } from "@/API";
import * as SampleTypes from "@/src/lib/voices/audio/audiotypes";

//import { dynamoQueryScanProps, getAllUserKits, getListFromDynamo } from "@/lib/s3";

import { useRouter, usePathname } from "next/navigation";
import { DrumKit } from "./saves/kitsaves";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";




// export async function getServerSideProps(context:any) {
//   const { req } = context;
//   const the_url = await getURL({ req: context.req });
  
//   return {
//   props: {
//   the_url,
//   },
//   };
//   }
export const KitzContext:Context<SampleTypes.SoundListProps | any> = createContext({items:[],drumType: undefined,lastEvaluatedKey:undefined});

export const KitzProvider = ({ children }: { children: React.ReactNode }) => {
  const [soundList, setSoundList] = useState<SampleTypes.SoundListProps>({
    items: [],
    drumType: undefined,
  });
  
  // const [currentSavedKitID, setCurrentSavedKitID] = useState<string>("");
  // const [currentSavedKitName, setCurrentSavedKitName] = useState<string>("");
  const [currentKit, setCurrentKit] = useState<DrumKit>();
  const [savedKits, setSavedKits] = useState<DrumKit[]>();
  const pathName = usePathname();
  const router = useRouter();
  const {appState, setAppState, globalMessages, setGlobalMessages} = useGlobalStore()

  const getAllUserKits = async (userID: string) => {
    console.log("getAllUserKits userID", userID)
    // const command = new ScanCommand({
    //   TableName: "Kitsaves",
    //   FilterExpression: "#userID = :userID",
    //   ExpressionAttributeValues: {
    //     ":userID": userID,
    //   },
    //   ExpressionAttributeNames: {
    //     "#userID": "userID",
    //   },
    //   Select: "ALL_ATTRIBUTES",
    // });
    // const results = await dynamo.send(command);
    // console.log(results);
    // console.log(results.Items);
    return [] as DrumKit[]
  }

  const globalSetKitLabCurrentKit = (kitID: string) => {
    console.log("globalSetKitLabCurrentKit", kitID);
    
    console.log("routeName", pathName);
    if (pathName && pathName.includes("/kitlab")) {
      const curKit = savedKits?.find((kit) => kit.id === kitID);
      setCurrentKit(curKit);
      return;
    }
    
      router.push(`/kitlab?kitID=${kitID}`);
    
  }
  // useEffect(() => {
    
  //   const load = async () => {
  //     // const sampleList: SoundListProps = await getUnCategorizedList(50);
      
  //     //if(soundList.items.length > 0){return}
  //     const props: dynamoQueryScanProps = {
  //       drumType: SampleTypes.Drum.kick,
  //       //limit: 50,
  //     };

  //     const sampleList: SoundListProps = await getListFromDynamo();


  //     setSoundList(sampleList);

  //     console.log("sampleList", sampleList);

  //     if (sampleList.items.length === 0) {
  //       return;
  //     }
  //   };
  //   load();
  // }, []);
  useEffect(() => {
    console.log("get appState.currentUser kits...",`appState.currentUser = ${appState.currentUser}`);
    if (!appState.currentUser) {
      return;
    }
    const load = async () => {
      console.log("get appState.currentUser kits loading appState.currentUser", appState.currentUser);
      const kits = await getAllUserKits(appState.currentUser.id);
      console.log("get appState.currentUser kits kits", kits);
      if (kits.length > 0) {
        //setcurrentKit(kits[0]);
        setSavedKits(kits);
      }
    };
    load();
  }, [appState.currentUser]);
  return <KitzContext.Provider value={{
    soundList,
    setSoundList,
    globalSetKitLabCurrentKit,
    currentKit,
    setCurrentKit,
    savedKits,
    setSavedKits,
    
  }}>{children}</KitzContext.Provider>;
};

export function useKitzContext() {
  return useContext(KitzContext);
}


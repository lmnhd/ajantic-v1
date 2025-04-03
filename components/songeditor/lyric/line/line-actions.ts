"use server"

import { LineLyricType } from "../line";
import { db } from "@/src/lib/db";

const generalPurposeDataName = "myLineAsides";
export const LINEACTION_storeLineAsides = async ({lineLyrics, userId}:{lineLyrics: LineLyricType[], userId: string}) => {
    
    console.log('LINEACTION_storeLineAsides: ', lineLyrics, userId);

    const existing = await db.generalPurpose.findFirst({
        where: {
            name: generalPurposeDataName,
            meta1: userId
        },
        select: {
            content: true,
            id: true,
            meta1: true,
            meta2: true,
            meta3: true,
            name: true
        }
    
    })
    console.log('LINEACTION_storeLineAsides existing: ', existing);
    if(existing){
        const updated = await db.generalPurpose.update({
            where: {
                id: existing.id
            },
            data: {
                content: JSON.stringify(lineLyrics)
            }
        })
        console.log('LINEACTION_storeLineAsides updated: ', updated);
        return lineLyrics
     }else{
        const newAside = await db.generalPurpose.create({
            data: {
                content: JSON.stringify(lineLyrics),
                meta1: userId,
                meta2: "",
                meta3: "",
                name: generalPurposeDataName
            
            }
        })
        console.log('LINEACTION_storeLineAsides newAside: ', newAside);
        return lineLyrics
     }
    //return {}
    
  };

export const LINEACTION_getLineAsides = async ({userId}:{userId: string}) => {
    
    try {
        console.log('LINEACTION_getLineAsides: ', userId);

    const existing = await db.generalPurpose.findFirst({
        where: {
            name: generalPurposeDataName,
            meta1: userId
        },
        select: {
            content: true,
            id: true,
            meta1: true,
            meta2: true,
            meta3: true,
            name: true
        }
    
    })
    console.log('LINEACTION_getLineAsides existing: ', existing);
    if(existing){
        return JSON.parse(existing.content)
     }else{
        return []
     }
    } catch (error) {
        console.log('LINEACTION_getLineAsides error: ', error);
        return []
    }
    //return {}
    
  };
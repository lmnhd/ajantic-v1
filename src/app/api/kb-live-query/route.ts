import { KB_LiveQueryResult } from "@/src/lib/types";
import { PINECONE_query_docs } from "../pinecone";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { query, namespace } = await req.json();
        const results = await PINECONE_query_docs(query, namespace);

        if (!results || !results.length) {
            return NextResponse.json([]);
        }

        const kbResults: KB_LiveQueryResult[] = results.map((result: any) => ({
            groupId: result.metadata?.groupId,
            documentId: result.metadata?.documentId,
            pageContent: result.pageContent
        }));
        return NextResponse.json(kbResults);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to process query' }, { status: 500 });
    }
}
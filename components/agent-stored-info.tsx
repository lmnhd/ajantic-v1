import { PLAYGROUND_testAgentStoredInfo } from "@/src/app/api/playground";
import {
  SERVER_deleteGeneralPurposeData,
  SERVER_getGeneralPurposeDataMany,
} from "@/src/lib/server";
import { AgentComponentProps } from "@/src/lib/types";
import { GeneralPurpose } from "@prisma/client";
import React, { useEffect, useState } from "react";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { toast } from "@/components/ui/use-toast";
import { ANALYSIS_TOOLS_fetchAllDataInNameSpace } from "@/src/lib/analysis_server";
import {
  FetchResponse,
  PineconeRecord,
  RecordMetadata,
} from "@pinecone-database/pinecone";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import HorizontalDivider from "@/components/global/horizontal-divider";

export default function AgentStoredInfo({
  agent,
  teamName,
  userId,
}: {
  agent: AgentComponentProps;
  teamName: string;
  userId: string;
}) {
  const [clinetInfos, setClientInfos] = useState<GeneralPurpose[]>([]);
  const [knowledgeBaseItems, setKnowledgeBaseItems] = useState<{
    [key: string]: PineconeRecord<RecordMetadata>;
  }>();

  const deleteClientInfo = async (id: number) => {
    await SERVER_deleteGeneralPurposeData(id);
    setClientInfos(clinetInfos.filter((info) => info.id !== id));
    toast({
      title: "Client Info Deleted",
      description: "The client info has been deleted",
    });
  };

  useEffect(() => {
    const loadClientInfos = async () => {
      console.log("USEEFEECT-LoadClientInfo");
      const dbName = DYNAMIC_NAMES.db_client_info(agent.name, userId);
      const result = await SERVER_getGeneralPurposeDataMany(dbName);
      console.log("loadClientInfos...", result);
      setClientInfos(result);
    };
    loadClientInfos();
  }, [userId]);

  useEffect(() => {
    const loadKnowledgeBaseItems = async () => {
      const namespace = DYNAMIC_NAMES.semantic_knowledge_base(userId);
      const result = await ANALYSIS_TOOLS_fetchAllDataInNameSpace(
        namespace
      );
      console.log("loadKnowledgeBaseItems...", result);
      setKnowledgeBaseItems(result.vectors);
    };
    loadKnowledgeBaseItems();
  }, [clinetInfos]);
  return (
    <div className="w-full h-full overflow-scroll flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold">{agent.name} Stored Info</h1>
      <div className="w-full h-full flex flex-col p-2 border-[1px] border-violet-500/50 rounded-md items-center bg-black/30 bg-blend-color-burn justify-center">
        <div className="w-full h-full gap-6 flex flex-col items-center justify-center py-3">
          <h2 className="font-bold text-xl">Client notes</h2>
          <Accordion className="w-full" type="single" collapsible>
            {clinetInfos.map((info) => (
              <AccordionItem value={info.id.toString()} key={info.id}>
                <AccordionTrigger className="flex flex-col items-center justify-center p-4 w-full bg-pink-500/50">
                  {info.meta1}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col items-center justify-center gap-4">
                    {info.content}
                    <Button
                      variant="destructive"
                      onClick={async () => await deleteClientInfo(info.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* {clinetInfos.map((info) => (
            <div
              className="flex flex-col gap-4 p-2 items-center justify-center w-1/3 h-full border-2 border-gray-300/50 rounded-md bg-yellow-400/10"
              key={info.id}
            >
              {info.content}
              <Button
                variant="destructive"
                onClick={async () => await deleteClientInfo(info.id)}
              >
                Delete
              </Button>
            </div>
          ))} */}
        </div>
        {/* <div>
          <h4>Knowledge Base Items</h4>
          <div className="w-full h-full flex flex-col gap-4 items-center justify-center">
            {knowledgeBaseItems &&
              Object.keys(knowledgeBaseItems).map((key) => (
                <div
                  className="w-48 h-12 "
                  key={key}
                >
                  {knowledgeBaseItems[key].metadata?.teamName}-
                  {knowledgeBaseItems[key].metadata?.text}
                </div>
              ))}
          </div>
        </div> */}
        <HorizontalDivider reverseColor={true} />
        <div className="w-full h-full gap-6 flex flex-col items-center justify-center">
          <h2 className="font-bold text-xl">Knowledge Base</h2>
          <Accordion className="w-full" type="single" collapsible>
            {knowledgeBaseItems &&
              Object.keys(knowledgeBaseItems).map((key) => (
                <AccordionItem value={key} key={key} className="w-full">
                  <AccordionTrigger className="flex flex-col items-center justify-center p-4 w-full bg-indigo-500/80">
                    {knowledgeBaseItems[key].metadata?.teamName}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col w-full items-center justify-center gap-4">
                      {knowledgeBaseItems[key].metadata?.text}
                      {/* <Button
                      variant="destructive"
                      
                    >
                      Delete
                    </Button> */}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

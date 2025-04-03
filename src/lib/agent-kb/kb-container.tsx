// "use client"

// import { useEffect, useState } from "react";
// import { getKnowledgeBaseEntries } from "./kb-wrapper";
// import KnowledgeBaseComponent from "./kb-component";
// import { KnowledgeBaseEntry } from "./types";

// interface KnowledgeBaseContainerProps {
//   agentName: string;
//   userId: string;
//   onKnowledgeBaseUpdate?: () => void;
//   setHasKnowledgeBase?: (value: boolean) => void;
//   isEnabled?: boolean;
// }

// export default function KnowledgeBaseContainer(props: KnowledgeBaseContainerProps) {
//   const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     const loadEntries = async () => {
//       setIsLoading(true);
//       const data = await getKnowledgeBaseEntries(props.userId, props.agentName);
//       setEntries(data);
//       setIsLoading(false);
//     };
//     loadEntries();
//   }, [props.userId, props.agentName]);

//   return (
//     <KnowledgeBaseComponent
//       {...props}

//       namespace={`agent-kb-${props.userId}-${props.agentName}`}
//       agentName={props.agentName}
//       userId={props.userId}
//       onKnowledgeBaseUpdate={props.onKnowledgeBaseUpdate}
//       setHasKnowledgeBase={props.setHasKnowledgeBase}
//       isEnabled={props.isEnabled || false}
   
//     />
//   );
// }

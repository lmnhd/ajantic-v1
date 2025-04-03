// "use server";
// import { Amplify } from "aws-amplify";

// import { list, getUrl, downloadData, uploadData } from "aws-amplify/storage";
// import { generateClient } from "aws-amplify/api";
// import { getSample, listSamples } from "@/graphql/queries";
// import { SampleType } from "../../ADMINISTRATION/src/interfaces";
// import { updateSample } from "@/graphql/mutations";
// import { DeleteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   QueryCommand,
//   ScanCommand,
//   PutCommand,
// } from "@aws-sdk/lib-dynamodb";
// import * as SampleTypes from "../../ADMINISTRATION/src/interfaces";
// import { ListSamplesQueryVariables, Sample } from "@/API";
// import fs from "fs";

// import { STSClient } from "@aws-sdk/client-sts";
// import { AssumeRoleCommand } from "@aws-sdk/client-sts";
// import { SoundListProps } from "./kitzcontext";
// import { Song, Step } from "@/components/sequencer/sequencertypes";
// import { getDateAsIDString } from "./utils";
// import { StepPatternSave, StepPatternSaves } from "@/saves/steppatternsaves";
// import { DrumKit } from "@/saves/kitsaves";
// import { SavedSequence } from "@/saves/Songsaves";
// // Set the AWS Region.
// const REGION = "us-east-1";
// // Create an AWS STS service client object.
// const sts = new STSClient({ region: REGION });

// export const assumeRole = async () => {
//   try {
//     // Returns a set of temporary security credentials that you can use to
//     // access Amazon Web Services resources that you might not normally
//     // have access to.
//     const command = new AssumeRoleCommand({
//       // The Amazon Resource Name (ARN) of the role to assume.
//       RoleArn: "arn:aws:iam::622703699030:role/Amplify-Backend-Deployment",
//       // An identifier for the assumed role session.
//       RoleSessionName: "session1",
//       // The duration, in seconds, of the role session. The value specified
//       // can range from 900 seconds (15 minutes) up to the maximum session
//       // duration set for the role.
//       DurationSeconds: 900,
//     });
//     // const response = await sts.send(command);
//     // console.log(response);
//   } catch (err) {
//     console.error(err);
//   }
// };
// //assumeRole();

// Amplify.configure({
//   Auth: {
//     Cognito: {
//       userPoolId: "us-east-1_Kp6ZfnG0v",
//       allowGuestAccess: true,
//       identityPoolId: "us-east-1:54569dbe-1dcf-4deb-a6d3-d5b799ecc637",
//       userPoolClientId: "7dcgmdsj20jgfdhuk3egso5huo",
//       loginWith: { username: true, email: true },
//     },
//   },
//   API: {
//     GraphQL: {
//       endpoint:
//         "https://m27uptzxtzav7cooltu26qfdpa.appsync-api.us-east-1.amazonaws.com/graphql",
//       //endpoint: "wss://m27uptzxtzav7cooltu26qfdpa.appsync-realtime-api.us-east-1.amazonaws.com/graphql",
//       region: "us-east-1",
//       defaultAuthMode: "apiKey",
//       apiKey: "da2-x5h2lmi54jbnfk6znwohqweqou",
//     },
//   },
//   Storage: {
//     S3: {
//       bucket: "subrepo-samples-bucket",
//       region: "us-east-1",
//       //dangerouslyConnectToHttpEndpointForTesting: 'true',
//     },
//   },
// });

// const client = generateClient();
// const dynamo = new DynamoDBClient({
//   region: "us-east-1",

//   credentials: {
//     accessKeyId: process.env.NEXT_PUBLIC_ACCESS_KEY_ID || "",
//     secretAccessKey: process.env.NEXT_PUBLIC_SECRET_KEY || "",
//     //sessionToken
//   },
//   // , endpoint: "",
// });
// const docClient = DynamoDBDocumentClient.from(dynamo);

// const TABLE_NAME = "Sample-iv37v7a55nd6tknm6gbqwfzcym-NONE";

// let SamplesCache: Sample[] = [];
// export const SetSamplesCache = (samples: Sample[]) => {
//   SamplesCache = samples;
// };
// export const GetSamplesCache = () => {
//   return SamplesCache;
// };
// export const listSamplesS3FolderContents = async (folderPath: string) => {
//   const result = await list({
//     prefix: folderPath, //"Base/Classic Kits/",
//     options: { accessLevel: "guest", listAll: true },
//   });
//   console.log("result", result);
//   return result.items.map((item) => {
//     return item.key;
//   });
// };
// export const getSampleFromS3 = async (s3Path: string) => {
//   const result = await list({
//     prefix: s3Path, //"Base/Classic Kits/",
//     options: { accessLevel: "guest", listAll: true },
//   });
//   console.log("result", result);
//   if (result.items.length == 0) {
//     fs.appendFile(
//       "missing.wav",
//       s3Path + ",",
//       { encoding: "utf8" },
//       function (err) {}
//     );
//   }

//   return result.items.map((item) => {
//     return item.key;
//   });
// };
// export const getUnCategorizedList = async (limit: number = 10) => {
//   const variables: ListSamplesQueryVariables = {};
//   // Find all samples that have no drum attribute
//   const results = await client.graphql({
//     query: listSamples,

//     variables: {
//       limit: 300,

//       filter: {
//         drum: {
//           attributeExists: false,
//           //eq: "snare",
//         },
//         invalid: {
//           eq: false,
//           //attributeExists:true
//         },
//         // drumMachine:{
//         //   eq: "tr808"
//         // }
//       },
//     },
//     authMode: "apiKey",
//   });
//   console.log(results.data.listSamples?.items.length);

//   const filteredList = results.data.listSamples?.items
//     ?.filter((item) => {
//       // if(item?.drum?.includes("kick") || item?.drum?.includes("snare") || item?.drum?.includes("hat") || item?.drum?.includes("cymbal") || item?.drum?.includes("tom") || item?.drum?.includes("perc") || item?.drum?.includes("sam") || item?.drum?.includes("loop") || item?.drum?.includes("cl") || item?.drum?.includes("sub") || item?.drum?.includes("vox") || item?.drum?.includes("instrument")){
//       //   console.log("null?", item)
//       //   return false
//       //   //return item
//       // }else{return true}
//       return true;
//     })
//     .splice(0, limit);
//   return {
//     items: filteredList,
//     drumType: SampleTypes.Drum.sample,
//   };
// };

// export const getModifiedSamplesList = async (limit: number = 100) => {
//   const variables: ListSamplesQueryVariables = {};
//   // Find all samples that have no drum attribute
//   const results = await client.graphql({
//     query: listSamples,

//     variables: {
//       limit: limit,

//       filter: {
//         sourceGen1: {
//           attributeExists: true,
//         },
//       },
//     },
//     authMode: "apiKey",
//   });
//   console.log(results.data.listSamples?.items);
//   return {
//     items: results.data.listSamples?.items,
//     drumType: SampleTypes.Drum.kick,
//   };
// };

// export type dynamoQueryScanProps = {
//   drumType?: SampleTypes.Drum;
//   limit?: number;
//   hygiene?: SampleTypes.Hygiene;
//   decadeStyle?: SampleTypes.DecadeStyle;
//   sourceGen1?: SampleTypes.SourceGen1;
//   sourceGen2?: SampleTypes.SourceGen2;
//   reversed?: boolean;
//   invalid?: boolean;
//   owner?: string;
//   genre?: SampleTypes.Genre;
//   tags?: [];
//   pitchRange?: SampleTypes.PitchRange;
//   mix?: SampleTypes.Mix;
//   loudness?: SampleTypes.Loudness;
//   length?: SampleTypes.Length;
//   drumMachine?: SampleTypes.DrumMachine;
//   name?: string;
// };
// export const getListFromDynamo = async (lastEvaluatedKey: string = "") => {
//   const command = new ScanCommand({
//     TableName: TABLE_NAME,
//     Select: "ALL_ATTRIBUTES",
//     Limit: 1000,
//     ExclusiveStartKey: lastEvaluatedKey ? { id: lastEvaluatedKey } : undefined,
//   });

//   const results = await dynamo.send(command);

//   console.log(`results = ${results.Count}`);

//   return {
//     items: results.Items as Sample[],
//     lastEvaluatedKey: results.LastEvaluatedKey?.id,
//   } as SoundListProps;
// };

// export const getListFromDynamoByNullValue = async (fieldToCheck: string) => {
//   const command = new ScanCommand({
//     //filter expression where drum not exists
//     TableName: TABLE_NAME,
//     FilterExpression: "attribute_not_exists(#field)",

//     // ExpressionAttributeValues: {
//     //   ":drum": drumType,
//     //   //":drumMachine": SampleTypes.DrumMachine.tr808,
//     // },
//     ExpressionAttributeNames: {
//       "#field": fieldToCheck,
//       //"#drumMachine": "drumMachine",
//       // "#name": "name",
//       // "#id": "id",
//       // "#description": "description",
//     },
//     // ProjectionExpression: "#id, #name, #description, #drum",
//     // AttributesToGet: ["id", "name", "description", "drum"],

//     Select: "ALL_ATTRIBUTES",

//     //Limit: limit,
//   });
//   const results = await dynamo.send(command);
//   console.log(`results = ${results.Count}`);
//   // const props:SoundListProps = {items:[], drumType:drumType};
//   return {
//     items: results.Items as Sample[],
//     drumType: SampleTypes.Drum.sample,
//   } as SoundListProps;
// };
// export const getListFromDynamoByDrumValue = async (
//   props: dynamoQueryScanProps
// ) => {
//   const command = new ScanCommand({
//     TableName: TABLE_NAME,
//     FilterExpression: "#drum = :drum",

//     ExpressionAttributeValues: {
//       ":drum": props.drumType,
//       //":drumMachine": SampleTypes.DrumMachine.tr808,
//     },
//     ExpressionAttributeNames: {
//       "#drum": "drum",
//     },

//     Select: "ALL_ATTRIBUTES",

//     Limit: props.limit,
//   });
//   const results = await dynamo.send(command);
//   console.log(`results = ${results.Count}`);
//   // const props:SoundListProps = {items:[], drumType:drumType};
//   return {
//     items: results.Items as Sample[],
//     drumType: props.drumType,
//   } as SoundListProps;
// };
// export const getList = async (
//   drumType: SampleTypes.Drum = SampleTypes.Drum.kick,
//   limit: number = 100,
//   hygiene?: SampleTypes.Hygiene,
//   decadeStyle?: SampleTypes.DecadeStyle,
//   sourceGen1?: SampleTypes.SourceGen1,
//   sourceGen2?: SampleTypes.SourceGen2,
//   reversed?: boolean,
//   invalid?: boolean,
//   owner?: string,
//   genre?: SampleTypes.Genre,
//   tags?: SampleTypes.Tag[],
//   pitchRange?: SampleTypes.PitchRange,
//   mix?: SampleTypes.Mix,
//   loudness?: SampleTypes.Loudness,
//   length?: SampleTypes.Length,
//   drumMachine?: SampleTypes.DrumMachine,
//   name?: string
// ) => {
//   const command = new ScanCommand({
//     TableName: TABLE_NAME,
//     FilterExpression: "#drum = :drum AND #drumMachine = :drumMachine",
//     ExpressionAttributeValues: {
//       ":drum": drumType,
//       ":drumMachine": SampleTypes.DrumMachine.tr808,
//     },
//     ExpressionAttributeNames: {
//       "#drum": "drum",
//       "#drumMachine": "drumMachine",
//       // "#name": "name",
//       // "#id": "id",
//       // "#description": "description",
//     },
//     // ProjectionExpression: "#id, #name, #description, #drum",
//     // AttributesToGet: ["id", "name", "description", "drum"],

//     Select: "ALL_ATTRIBUTES",
//     // ScanFilter: {

//     //   // id:{
//     //   //   ComparisonOperator: "CONTAINS",
//     //   //   AttributeValueList:[{S:"a744be57-01f1-4308-902f-ec33657c08b9"}]

//     //   // },
//     //   // drum: {
//     //   //   ComparisonOperator: "CONTAINS",
//     //   //   AttributeValueList: [{ S: drumType }],

//     //   // },

//     // },

//     //Limit: limit,
//   });
//   const results = await dynamo.send(command);
//   console.log(`results = ${results.Count}`);
//   // const props:SoundListProps = {items:[], drumType:drumType};
//   return {
//     items: results.Items as Sample[],
//     drumType: drumType,
//   } as SoundListProps;
//   const samples = results?.Items?.map((item) => {
//     return {
//       id: item.id.S,
//       name: item.name.S,
//       description: item.description.S || null,
//       genre: item.genre.SS || null,
//       tags: item.tags.SS || null,
//       drum: item.drum.S,
//       hygiene: item.hygiene.S,
//       length: item.length.S,
//       pitchRange: item.pitchRange.S,
//       mix: item.mix.S,
//       loudness: item.loudness.S,
//       decadeStyle: item.decadeStyle.S,
//       sourceGen1: item.sourceGen1.S,
//       sourceGen2: item.sourceGen2.S,
//       reversed: item.reversed.BOOL,
//       invalid: item.invalid.BOOL,
//       sampleLength: item.sampleLength.N,
//       owner: item.owner.S,
//     };
//   });

//   // const results = await client.graphql({
//   //     query: listSamples,

//   //     variables: {
//   //         limit:limit ,
//   //         filter: {
//   //             drum: {
//   //                 eq: drumType
//   //             }
//   //         }
//   //     },
//   //     authMode: "apiKey",

//   // })
//   console.log(results.Items);
//   return { items: [], drumType: drumType };
// };

// export const getSampleByID = async (id: string) => {
//   //const client = generateClient();
//   const results = await client.graphql({
//     query: getSample,

//     variables: {
//       id: id,
//     },

//     authMode: "apiKey",
//   });
//   console.log(results.data.getSample);
//   return results.data.getSample;
// };
// export const getSampleByIDWithDynamo = async (id: string) => {
//   //const client = generateClient();
//   const command = new QueryCommand({
//     TableName: TABLE_NAME,
//     KeyConditionExpression: "#id = :id",
//     //FilterExpression: "#id = :id",
//     ExpressionAttributeValues: {
//       ":id": id,
//     },
//     ExpressionAttributeNames: {
//       "#id": "id",
//     },
//     Select: "ALL_ATTRIBUTES",
//   });
//   const results = await dynamo.send(command);
//   console.log(results.Items);
//   return results.Items![0] as Sample;
// };
// export const getSamplesByName = async (name: string) => {
//   //const client = generateClient();
//   const results = await client.graphql({
//     query: listSamples,

//     variables: {
//       filter: {
//         name: {
//           eq: name,
//         },
//       },
//     },
//     authMode: "apiKey",
//   });
//   console.log(results.data.listSamples?.items[0]?.name);
//   return results.data.listSamples?.items;
// };

// export async function updateSampleData(sample: Sample) {
//   console.log(`attempting to update => ${sample.drum} `);

//   const results = await client.graphql({
//     query: updateSample,

//     variables: {
//       input: {
//         id: sample.id,
//         name: sample.name,
//         description: sample.description,
//         genre: sample.genre,
//         tags: sample.tags,
//         drum: sample.drum,
//         hygiene: sample.hygiene,
//         length: sample.length,
//         pitchRange: sample.pitchRange,
//         mix: sample.mix,
//         loudness: sample.loudness,
//         decadeStyle: sample.decadeStyle,
//         sourceGen1: sample.sourceGen1,
//         sourceGen2: sample.sourceGen2,
//         reversed: sample.reversed,
//         invalid: sample.invalid,
//         sampleLength: sample.sampleLength,
//         owner: sample.owner,
//         //createdAt: sample.createdAt,
//         //updatedAt: sample.updatedAt,
//       },
//     },
//     authMode: "apiKey",
//   });
//   console.log(results.data.updateSample.id);
//   return results.data.updateSample.id;
// }
// export async function downloadToMemory(s3Path: string) {
//   const { body, eTag } = await downloadData({
//     key: "9th Wonder Kit/hat1.wav",
//     options: {
//       accessLevel: "guest",
//     },
//   }).result;

//   return (await body.blob()).arrayBuffer();
// }

// export async function getS3URL(s3Path: string) {
//   try {
//     const { url } = await getUrl({
//       key: s3Path,
//       options: {
//         accessLevel: "guest",
//         validateObjectExistence: true,
//       },
//     });
//     return url.href;
//   } catch (error) {
//     return null;
//   }
// }

// export async function check() {
//   // const _list = await list({
//   //     prefix: '9th Wonder Kit/',

//   //     options: {accessLevel: 'guest', listAll: true},
//   // });
//   // console.log(_list);

//   //return

//   const path = "public/606cymb.wav";
//   const path2 = "9th Wonder Kit/hat1.wav";

//   const getUrlResult = await getUrl({
//     key: path2,
//     options: {
//       accessLevel: "guest",
//       validateObjectExistence: true,
//     },
//   });
//   console.log(getUrlResult);

//   // try {
//   //     const result = await uploadData({
//   //         key: '606cymb.wav',
//   //         data: path,
//   //         options: {
//   //             accessLevel: 'guest',
//   //         }
//   //     }).result;
//   //     console.log(result);
//   // } catch (error) {
//   //     console.log(error);
//   // }
//   // console.log("Server");
// }
// export const uploadDataInBrowser = async (event: any) => {
//   console.log("event =", event);
//   try {
//     if (event?.target?.files) {
//       const file = event.target.files[0];
//       uploadData({
//         key: "test.wav",
//         data: file,
//       });
//       console.log("file uploaded");
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// //STEP PATTERN SAVES
// export const saveStepPatternToDynamo = async (
//   stepPattern: Step[],
//   drumType: string,
//   userID?: string
// ) => {
//   const command = new PutCommand({
//     TableName: "StepPatternSaves",
//     Item: {
//       id: getDateAsIDString(),
//       drumType: drumType,
//       userID: userID,
//       global: true,
//       stepPattern: JSON.stringify(stepPattern),
//     },
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   return results.Attributes as StepPatternSave
// };
// export const getAllStepPatternSaves = async () => {
//   const command = new ScanCommand({
//     TableName: "StepPatternSaves",
//     Select: "ALL_ATTRIBUTES",
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   return results.Items;
// };
// export const saveKitToDynamo = async (kit: DrumKit) => {
//   const command = new PutCommand({
//     TableName: "Kitsaves",
//     Item: {
//       id: getDateAsIDString(),
//       name: kit.name,
//       userID: kit.userID,
//       drumType: kit.drumType,
//       global: kit.global,
//       drumSamples: kit.drumSamples,
//     },
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   return results.Attributes as DrumKit;
// }
// export const getSavedKit = async (id: string) => {
//   const command = new ScanCommand({
//     TableName: "Kitsaves",
//     FilterExpression: "#id = :id",
//     ExpressionAttributeValues: {
//       ":id": id,
//     },
//     ExpressionAttributeNames: {
//       "#id": "id",
//     },
//     Select: "ALL_ATTRIBUTES",
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   return results.Items;
// }
// export const getAllUserKits = async (userID: string) => {
//   console.log("getAllUserKits userID", userID)
//   const command = new ScanCommand({
//     TableName: "Kitsaves",
//     FilterExpression: "#userID = :userID",
//     ExpressionAttributeValues: {
//       ":userID": userID,
//     },
//     ExpressionAttributeNames: {
//       "#userID": "userID",
//     },
//     Select: "ALL_ATTRIBUTES",
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   console.log(results.Items);
//   return results.Items as DrumKit[]
// }
// export const storeKitLabSequencesToDB = async (sequences:SavedSequence) => {
//   const command = new PutCommand({
//     TableName: "KitLabSequences",
//     Item: {
//       id: sequences.id,
//       userID: sequences.userID,
//       name: sequences.name,
//       sequences: JSON.stringify(sequences),
//     },
//   });
//   const results = await dynamo.send(command);
//   console.log(results);
//   return results.Attributes as Song[]

// }

// export const getKitLabSequences = async (userID: string) => {
//   const command = new ScanCommand({
//     TableName: "KitLabSequences",
//     FilterExpression: "#userID = :userID",
//     ExpressionAttributeValues: {
//       ":userID": userID,
//     },
//     ExpressionAttributeNames: {
//       "#userID": "userID",
//     },
//     Select: "ALL_ATTRIBUTES",
//   });
//   const results = await dynamo.send(command);
//   console.log("loadSequence getKitLabSequences results => ",results);
//   return results.Items?.map((item) => {
//     return JSON.parse(item.sequences) as SavedSequence
//   })
// }
// export const deleteKitLabSequence = async (id: string) => {
//   const command = new DeleteItemCommand({
//     TableName: "KitLabSequences",
//     Key: {
//       id: { S: id },
//     },
//   });
//   const results = await dynamo.send(command);
//   console.log("deleteKitLabSequence =>",results);
//   return results;
// }

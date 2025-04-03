import { GeneralPurpose } from "@prisma/client";


import { AISessionState, ContextContainerProps,  ServerMessage, Team } from "./types";

declare global {
  var indexedDB_client: IDBDatabase | undefined;
  var indexedDB_request: IDBOpenDBRequest | undefined;
}

const _getIndexedDBClient = async () => {
  if (globalThis.indexedDB_client) {
    return globalThis.indexedDB_client;
  } else {
    return indexedDB.open("myDatabase", 1);
  }
};

export interface GenericData {
  id: string;
  data: any;
}

export interface PlaygroundState {
  messages: ServerMessage[];
  messageHistory: GeneralPurpose[];
  messageHistoryNames: string[];
  contextSets: ContextContainerProps[];
  state: AISessionState;
  team: Team | undefined;
}

export enum Stores {
  GenericData = "GenericData",
}

export const INDEXEDDB_initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    globalThis.indexedDB_request = indexedDB.open("myDatabase", 1);

    globalThis.indexedDB_request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(Stores.GenericData)) {
        db.createObjectStore(Stores.GenericData, { keyPath: "id" });
      }
    };

    globalThis.indexedDB_request.onsuccess = (event) => {
      globalThis.indexedDB_client = (event.target as IDBOpenDBRequest).result;
      const db = globalThis.indexedDB_client;
      const version = db.version;

      console.log("DB initialized");
      resolve(true);
    };

    globalThis.indexedDB_request.onerror = (event) => {
      console.log("DB initialization failed");
      reject(false);
    };
  });
};

export const INDEXEDDB_checkIfDBAvailable = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (globalThis.indexedDB_client) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const INDEXEDDB_storeGenericData = (
  data: GenericData
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const transaction = globalThis.indexedDB_client?.transaction(
      [Stores.GenericData],
      "readwrite"
    );
    const store = transaction?.objectStore(Stores.GenericData);
    const request = store?.put(data);

    if (request) {
      request.onsuccess = () => {
        resolve(true);
      };
    }

    if (transaction) {
      transaction.oncomplete = () => {
        console.log(`${data.id} stored in DB`);
      };
    }

    if (transaction) {
      transaction.onerror = () => {
        reject(false);
      };
    }
  });
};

export const INDEXEDDB_storePlaygroundState = async (
  data: PlaygroundState
): Promise<boolean> => {
  try{
    await INDEXEDDB_deleteGenericData("Playground-State-" + data.state.userId);
  } catch (error) {
    //console.log("Error deleting existing Playground-State: ", error);
  }
  return new Promise((resolve, reject) => {
    const dataToStore = {
      id: "Playground-State-" + data.state.userId,
      data: data,
    };
    INDEXEDDB_storeGenericData(dataToStore).then((success) => {
      resolve(success);
    });
  });
};

export const INDEXEDDB_retrievePlaygroundState = (
  userId: string
): Promise<PlaygroundState | null> => {
  return INDEXEDDB_retrieveGenericData("Playground-State-" + userId).then((data) => {
    if (data) {
      return data.data;
    }
    return null;
  });
};

export const INDEXEDDB_retrieveGenericData = (
  id: string
): Promise<GenericData | null> => {
  return new Promise((resolve, reject) => {
    const transaction = globalThis.indexedDB_client?.transaction(
      [Stores.GenericData],
      "readonly"
    );
    const store = transaction?.objectStore(Stores.GenericData);
    const request = store?.get(id);

    if (request) {
      request.onsuccess = () => {
        resolve(request.result);
      };
    }

    if (transaction) {
      transaction.onerror = () => {
        reject(false);
      };
    }
  });
};

export const INDEXEDDB_deleteGenericData = (id: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const transaction = globalThis.indexedDB_client?.transaction(
      [Stores.GenericData],
      "readwrite"
    );
    const store = transaction?.objectStore(Stores.GenericData);
    const request = store?.delete(id);

    if (request) {
      request.onsuccess = () => {
        resolve(true);
      };
      if (transaction) {
        transaction.oncomplete = () => {
          console.log(`${id} deleted from DB`);
        };
      }

      if (transaction) {
        transaction.onerror = () => {
          reject(false);
        };
      }
    } else {
      reject(false);
    }
  });
};

// let request: IDBOpenDBRequest;
// let db: IDBDatabase;
// let version: number;

// export interface GenericData {
//   id: string;
//   data: any;
// }

// export enum Stores {
//   GenericData = "GenericData",
// }

// export const INDEXEDDB_initDB = (): Promise<boolean> => {
//   return new Promise((resolve, reject) => {
//      request = indexedDB.open("myDatabase", 1);

//      request.onupgradeneeded = (event) => {
//         db = (event.target as IDBOpenDBRequest).result;

//         if (!db.objectStoreNames.contains(Stores.GenericData)) {
//             db.createObjectStore(Stores.GenericData, { keyPath: "id" });
//         }
//      };

//      request.onsuccess = (event) => {
//         db = (event.target as IDBOpenDBRequest).result;
//         version = db.version;

//         console.log("DB initialized");
//         resolve(true);
//      };

//      request.onerror = (event) => {
//         console.log("DB initialization failed");
//         reject(false);
//      };
//   });
// };

// export const INDEXEDDB_checkIfDBAvailable = (): Promise<boolean> => {
//   return new Promise((resolve, reject) => {
//     if(db) {
//       resolve(true);
//     } else {
//       resolve(false);
//     }
//   });
// };

// export const INDEXEDDB_storeGenericData = (data: GenericData): Promise<boolean> => {
//   return new Promise((resolve, reject) => {
//     const transaction = db.transaction([Stores.GenericData], "readwrite");
//     const store = transaction.objectStore(Stores.GenericData);
//     const request = store.put(data);

//     request.onsuccess = () => {
//       resolve(true);
//     };

//     transaction.oncomplete = () => {
//       console.log(`${data.id} stored in DB`);
//     };

//     transaction.onerror = () => {
//       reject(false);
//     };
//   });
// };


// export const INDEXEDDB_retrieveGenericData = (id: string): Promise<GenericData | null> => {
//   return new Promise((resolve, reject) => {
//     const transaction = db.transaction([Stores.GenericData], "readonly");
//     const store = transaction.objectStore(Stores.GenericData);
//     const request = store.get(id);

//     request.onsuccess = () => {
//       resolve(request.result);
//     };
//   });
// };

// export const INDEXEDDB_deleteGenericData = (id: string): Promise<boolean> => {
//   return new Promise((resolve, reject) => {
//     const transaction = db.transaction([Stores.GenericData], "readwrite");
//     const store = transaction.objectStore(Stores.GenericData);
//     const request = store.delete(id);

//     request.onsuccess = () => {
//       resolve(true);
//     };

//     transaction.oncomplete = () => {
//       console.log(`${id} deleted from DB`);
//     };

//     transaction.onerror = () => {
//       reject(false);
//     };
//   });
// };


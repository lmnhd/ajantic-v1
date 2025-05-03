// Helper function to read a chunk from the stream
export async function readStreamChunk(stream: ReadableStream<Uint8Array> | null, maxSize: number): Promise<string> {
    if (!stream) {
        return '';
    }
    const reader = stream.getReader();
    let receivedLength = 0;
    let chunks: Uint8Array[] = [];
    const decoder = new TextDecoder(); // Default UTF-8 decoder

    try {
        while (receivedLength < maxSize) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (value) { // Add check for value existence
                chunks.push(value);
                receivedLength += value.length;
            }
        }
    } finally {
        reader.releaseLock(); // Ensure the lock is released
    }

    // Concatenate chunks and decode
    const allChunks = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
    }

    // Decode only the required part (up to maxSize)
    const text = decoder.decode(allChunks.slice(0, maxSize), { stream: false }); // stream: false for final decode

    return text;
} 
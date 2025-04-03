import React, { useState } from 'react';
import { PINECONE_query_docs } from '@/src/app/api/pinecone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KB_LiveQueryResult } from '@/src/lib/types';
import { UTILS_cleanNewlines } from '@/src/lib/utils';

export default function KB_LiveQueryComponent({agentName, userId}: {agentName: string, userId: string}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KB_LiveQueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);


  const getSource = (result: KB_LiveQueryResult) => {
    if (result.groupId) {
      return result.groupId;
    }
    return result.documentId || 'Unknown';
  }

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      console.log("query", query);
      const namespace = `agent-kb-${userId}-${agentName}`;
      const response = await fetch('/api/kb-live-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, namespace }),
      });
      const searchResults = await response.json();

      console.log("searchResults", searchResults);
      if (searchResults && searchResults.length){
        setResults(searchResults);
      }
      
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-b min-w-[500px] from-violet-500/80 to-pink-500/20 rounded-lg">
        <h1 className="text-lg font-bold text-white">Knowledge base tester...</h1>
      <div className="flex gap-2">
        <Input
          placeholder="Enter your query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button 
          onClick={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      <ScrollArea className="max-h-[500px] min-h-[100px] overflow-y-auto">
        {results.map((result, index) => (
          <Card key={index} className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">
                Source: {getSource(result)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div className="font-semibold mb-2">Content:</div>
                <div className="whitespace-pre-wrap">{UTILS_cleanNewlines(result.pageContent)}</div>
                <div className="mt-4 text-xs text-muted-foreground">
                  <div>Document ID: {result.documentId}</div>
                  {result.isChunk && result.chunkIndex !== undefined && result.totalChunks !== undefined && (
                    <div>
                      Chunk {result.chunkIndex + 1} of {result.totalChunks}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {results.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">
            No results found
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

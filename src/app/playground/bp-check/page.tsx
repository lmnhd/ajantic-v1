'use client';

import React, { useState } from 'react';

export default function BreakpointTestPage() {
  const [count, setCount] = useState<number>(5);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleTestBreakpoint = async () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    // You can set a breakpoint here
    try {
      const res = await fetch('/api/playground/bp-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count }),
      });

      const data = await res.json();

      if (res.ok) {
        setResponse(data.message);
      } else {
        setError(data.error || 'An unknown error occurred.');
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to connect to the server.');
    }
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Breakpoint Test Page</h1>
      
      <div className="mb-4">
        <label htmlFor="loopCount" className="block text-sm font-medium text-gray-700 mb-1">
          Loop Iterations:
        </label>
        <input
          type="number"
          id="loopCount"
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value, 10) || 0)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Enter number of iterations"
        />
      </div>

      <button
        onClick={handleTestBreakpoint}
        disabled={isLoading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Testing...' : 'Test Breakpoint Loop'}
      </button>

      {response && (
        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
          <p><strong>Success:</strong> {response}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
    </div>
  );
}

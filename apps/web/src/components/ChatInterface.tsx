// apps/web/src/components/ChatInterface.tsx
// AGPLv3 — OpenMind Collective

import React, { useState, useRef } from 'react';
import { extractWorkshopPlan, WorkshopRow } from '../lib/excel-parser/hyperlink-extractor';
import { OllamaPeerConnection, discoverPeers } from '../lib/p2p/webrtc-ollama-bridge';

export function ChatInterface() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);
  const [input, setInput] = useState('');
  const [workshopData, setWorkshopData] = useState<WorkshopRow[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [connectedPeer, setConnectedPeer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const data = await extractWorkshopPlan(file);
    setWorkshopData(data);
    
    const linkCount = data.filter(d => d.linkUrl).length;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `✅ Loaded workshop plan. Found ${data.length} topics, ${linkCount} hyperlinks. Ask me about any week or topic.`
    }]);
  };

  const scanForPeers = async () => {
    const availablePeers = await discoverPeers();
    setPeers(availablePeers);
  };

  const connectToPeer = async (peerId: string) => {
    const conn = new OllamaPeerConnection(peerId);
    await conn.connect();
    setConnectedPeer(peerId);
    // Store connection in window for generation
    (window as any).activePeerConnection = conn;
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Check workshop context
    let context = '';
    if (workshopData.length > 0 && input.toLowerCase().includes('week')) {
      const weekMatch = input.match(/week\s*(\d+)/i);
      if (weekMatch) {
        const week = weekMatch[1];
        const weekRows = workshopData.filter(row => row.week === week);
        context = `Workshop week ${week}:\n${weekRows.map(r => 
          `- ${r.topic}: ${r.linkText} (${r.linkUrl || 'no link'})`
        ).join('\n')}\n\n`;
      }
    }
    
    // Generate response
    let response = '';
    if (connectedPeer && (window as any).activePeerConnection) {
      // Use P2P
      response = await (window as any).activePeerConnection.generate(
        context + input
      );
    } else {
      // Fallback to Gemini
      response = `⚠️ No peer connected. Using fallback.\n\nWorkshop planning ready. ${workshopData.length} topics loaded.`;
    }
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="mb-4 flex gap-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Upload Workshop Plan
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".xlsx,.xls" 
          className="hidden" 
        />
        <button 
          onClick={scanForPeers}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Scan for Peers
        </button>
      </div>
      
      {peers.length > 0 && (
        <div className="mb-4 p-2 border rounded">
          <p className="font-bold">Available peers:</p>
          {peers.map(peer => (
            <button
              key={peer}
              onClick={() => connectToPeer(peer)}
              className="mr-2 px-2 py-1 bg-gray-200 rounded text-sm"
            >
              {peer} {connectedPeer === peer ? '✅' : ''}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto border rounded p-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <span className={`inline-block p-2 rounded ${
              msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {msg.content}
            </span>
          </div>
        ))}
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 border rounded px-4 py-2"
          placeholder="Ask about workshop planning..."
        />
        <button 
          onClick={sendMessage}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}

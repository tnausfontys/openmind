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
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    const data = await extractWorkshopPlan(file);
    setWorkshopData(data);
    
    const linkCount = data.filter(d => d.linkUrl).length;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `📎 Loaded \`${file.name}\` — ${data.length} topics, ${linkCount} hyperlinks. Ask me anything.`
    }]);
  };

  const scanForPeers = async () => {
    const availablePeers = await discoverPeers();
    setPeers(availablePeers);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `🔍 Found ${availablePeers.length} peers. Click peer name to connect.`
    }]);
  };

  const connectToPeer = async (peerId: string) => {
    const conn = new OllamaPeerConnection(peerId);
    await conn.connect();
    setConnectedPeer(peerId);
    (window as any).activePeerConnection = conn;
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `✅ Connected to peer: ${peerId}`
    }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    let context = '';
    if (workshopData.length > 0) {
      context = `File data loaded:\n${workshopData.map(r => 
        `- Week ${r.week}: ${r.topic} (${r.linkText})${r.linkUrl ? ` - ${r.linkUrl}` : ''}`
      ).join('\n')}\n\n`;
    }
    
    let response = '';
    if (connectedPeer && (window as any).activePeerConnection) {
      try {
        response = await (window as any).activePeerConnection.generate(
          context + input
        );
      } catch (e) {
        response = `⚠️ Peer connection failed. Using fallback.\n\nYour question: ${input}`;
      }
    } else {
      response = `🤖 OpenMind is ready.\n\n${workshopData.length > 0 
        ? `I see ${workshopData.length} topics loaded. Ask about any week.` 
        : 'Upload an file with 📎 to start.'}`;
    }
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Peer connection bar - Claude style subtle */}
      {peers.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm overflow-x-auto">
            <span className="text-gray-500 text-xs uppercase tracking-wider">Peers</span>
            {peers.map(peer => (
              <button
                key={peer}
                onClick={() => connectToPeer(peer)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  connectedPeer === peer 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {peer.slice(0, 8)}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Messages - Claude style */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-16">
              <div className="text-7xl mb-6 animate-pulse">🧠</div>
              <h1 className="text-2xl font-normal text-gray-900 mb-3">OpenMind</h1>
              <p className="text-gray-500 max-w-md mb-8">
                P2P AI Commons · AGPLv3
              </p>
              <div className="rounded-2xl p-5 max-w-sm text-gray-500">
                
                  <div className="chat-input flex items-center px-4 py-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Upload file"
            >
              📎
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv,.pdf,.txt"
              className="hidden"
            />
            
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={fileName ? `Ask about ${fileName}...` : "Message OpenMind..."}
              className="flex-1 border-0 focus:ring-0 outline-none px-3 py-2 text-sm bg-transparent"
            />
            
            <div className="flex items-center gap-1">
              <button
                onClick={scanForPeers}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                title="Scan for peers"
              >
                🔍
              </button>
              
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className={`p-2 rounded-full transition-colors ${
                  input.trim() 
                    ? 'text-blue-600 hover:bg-blue-50' 
                    : 'text-gray-300'
                }`}
              >
                ⬆️
              </button>
            </div>
          </div>
          
          {/* Status bar - Claude style subtle */}
          <div className="flex justify-between items-center mt-2 px-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${connectedPeer ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-400">
                {connectedPeer ? `Connected to ${connectedPeer.slice(0, 8)}` : 'No peer connected'}
              </span>
            </div>
            {fileName && (
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span>📎</span> {fileName}
              </div>
            )}
          </div>

              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] whitespace-pre-wrap break-words ${
                    msg.role === 'user' 
                      ? 'user-message' 
                      : 'assistant-message'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Input area - Claude style */}
      <div className="border-t border-gray-100 bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
         
        </div>
      </div>
    </div>
  );
}
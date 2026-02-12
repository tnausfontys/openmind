// apps/web/src/lib/p2p/webrtc-ollama-bridge.ts
// AGPLv3 — OpenMind Collective

/**
 * This file is why OpenMind has no servers.
 * 
 * It connects your browser directly to someone else's computer.
 * They run Ollama. You run a prompt. Tokens flow peer-to-peer.
 * 
 * No API keys. No billing. Just neighbors.
 */

export class OllamaPeerConnection {
  private pc: RTCPeerConnection;
  private dataChannel: RTCDataChannel;
  private pendingResolve: ((value: string) => void) | null = null;
  private accumulatedResponse = '';

  constructor(
    public peerId: string,
    public signalingUrl: string = 'https://openmind-signaling.openmind-signaling.workers.dev'
  ) {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.dataChannel = this.pc.createDataChannel('ollama-stream');
    this.setupDataChannel();
  }

  private setupDataChannel() {
    this.dataChannel.onopen = () => {
      console.log(`🟢 Connected to peer: ${this.peerId}`);
    };

    this.dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.token) {
        // Stream chunk
        this.accumulatedResponse += data.token;
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('ollama-token', {
          detail: { token: data.token, full: this.accumulatedResponse }
        }));
      }

      if (data.done) {
        // Generation complete
        if (this.pendingResolve) {
          this.pendingResolve(this.accumulatedResponse);
          this.pendingResolve = null;
          this.accumulatedResponse = '';
        }
      }
    };
  }

  async connect(): Promise<void> {
    // Create offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Send to signaling server
    const response = await fetch(`${this.signalingUrl}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peerId: this.peerId,
        sdp: this.pc.localDescription
      })
    });

    const { sdp: answerSdp } = await response.json();
    await this.pc.setRemoteDescription(answerSdp);
  }

  async generate(prompt: string, model: string = 'deepseek-r1:7b'): Promise<string> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.accumulatedResponse = '';
      
      this.dataChannel.send(JSON.stringify({
        type: 'generate',
        model,
        prompt,
        stream: true
      }));
    });
  }

  close() {
    this.dataChannel.close();
    this.pc.close();
  }
}

/**
 * Peer discovery - finds available GPU donors
 */
export async function discoverPeers(): Promise<string[]> {
  try {
    const response = await fetch('https://signaling.openmind.pages.dev/peers');
    const { peers } = await response.json();
    return peers.filter((p: string) => p !== getMyPeerId()); // Don't list self
  } catch (e) {
    console.warn('Peer discovery failed, falling back to central APIs', e);
    return [];
  }
}

// Generate a stable anonymous peer ID
export function getMyPeerId(): string {
  // In production: derive from hardware fingerprint + salt
  // For MVP: random ID stored in localStorage
  let id = localStorage.getItem('openmind-peer-id');
  if (!id) {
    id = `peer-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('openmind-peer-id', id);
  }
  return id;
}

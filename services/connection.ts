
import Peer from 'peerjs';
import { User } from '../types';

// Fix: Updated onCommand type to accept payload
export const initializeHost = (
  user: User, 
  onCommand: (cmd: string, payload?: any) => boolean | Promise<boolean>, 
  onFetch: () => User
): Promise<{ peer: any; peerId: string }> => {
  return new Promise((resolve) => {
    // Generate a random ID to avoid "ID Taken" errors on refresh
    const peer = new Peer({ debug: 1 });

    peer.on('open', (peerId) => resolve({ peer, peerId }));

    peer.on('connection', (conn) => {
      // Fix: Changed data listener to async and added await for onCommand result
      conn.on('data', async (data: any) => {
        if (data.type === 'GET_PROFILE') {
          conn.send({ type: 'PROFILE_DATA', user: onFetch() });
        } else if (data.type === 'ADD_STAMP') {
          // Pass the count from the payload (default to 1 if missing)
          const success = await onCommand('ADD_STAMP', { count: data.count || 1 });
          conn.send({ type: 'STAMP_ACK', success });
        } else if (data.type === 'SCAN_ALERT') {
          // Notify the host that they have been scanned
          onCommand('SCAN_ALERT');
        }
      });
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      // Even if error, resolve so UI doesn't hang (it will show offline)
      resolve({ peer: null, peerId: '' });
    });
  });
};

export const fetchRemoteUser = (targetPeerId: string): Promise<User | null> => {
    return new Promise((resolve) => {
        const peer = new Peer();
        // Increased timeout to 10s
        let timeout = setTimeout(() => { peer.destroy(); resolve(null); }, 10000);

        peer.on('open', () => {
            const conn = peer.connect(targetPeerId, { reliable: true });
            
            conn.on('open', () => {
                conn.send({ type: 'GET_PROFILE' });
            });

            conn.on('data', (data: any) => {
                if (data.type === 'PROFILE_DATA') {
                    clearTimeout(timeout);
                    resolve(data.user);
                    // Give it a moment to flush data before destroying
                    setTimeout(() => peer.destroy(), 500);
                }
            });

            // Handle connection errors specifically
            conn.on('error', (err) => {
                console.error("Conn Error", err);
                clearTimeout(timeout);
                peer.destroy();
                resolve(null);
            });
            
            conn.on('close', () => {
                 // If closed before data, it's a fail
            });
        });

        peer.on('error', (err) => {
            console.error("Peer Error", err);
            clearTimeout(timeout);
            resolve(null);
        });
    });
};

export const sendStampSignal = (targetPeerId: string, count: number = 1): Promise<boolean> => {
    return new Promise((resolve) => {
        const peer = new Peer();
        // Increased timeout to 10s
        let timeout = setTimeout(() => { peer.destroy(); resolve(false); }, 10000);

        peer.on('open', () => {
            const conn = peer.connect(targetPeerId, { reliable: true });
            
            conn.on('open', () => {
                // Send the count in the payload
                conn.send({ type: 'ADD_STAMP', count });
            });

            conn.on('data', (data: any) => {
                if (data.type === 'STAMP_ACK') {
                    clearTimeout(timeout);
                    resolve(data.success);
                    setTimeout(() => peer.destroy(), 500);
                }
            });

            conn.on('error', () => { 
                clearTimeout(timeout); 
                peer.destroy();
                resolve(false); 
            });
        });

        peer.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
};

export const sendScanSignal = (targetPeerId: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const peer = new Peer();
        // Short timeout for scan alerts (fire and forget)
        let timeout = setTimeout(() => { peer.destroy(); resolve(false); }, 5000);

        peer.on('open', () => {
            const conn = peer.connect(targetPeerId, { reliable: true });
            
            conn.on('open', () => {
                conn.send({ type: 'SCAN_ALERT' });
                // We don't wait for ACK, just send and close
                setTimeout(() => {
                    clearTimeout(timeout);
                    peer.destroy();
                    resolve(true);
                }, 500);
            });

            conn.on('error', () => { 
                clearTimeout(timeout); 
                peer.destroy();
                resolve(false); 
            });
        });

        peer.on('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });
    });
};

import { useEffect, useRef, useState, useCallback } from "react";

export type ChessSocketStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

interface UseChessSocketReturn {
  status: ChessSocketStatus;
  gameId: string | null;
  lastOpponentMove: ChessMove | null;
  sendMove: (move: ChessMove) => void;
  disconnect: () => void;
  reconnect: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

// Exponential backoff configuration
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useChessSocket(gameId: string | null): UseChessSocketReturn {
  const [status, setStatus] = useState<ChessSocketStatus>("idle");
  const [lastOpponentMove, setLastOpponentMove] = useState<ChessMove | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const moveQueueRef = useRef<ChessMove[]>([]);
  const isManualDisconnectRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, attempt);
    return Math.min(delay, MAX_RECONNECT_DELAY);
  }, []);

  const createWebSocket = useCallback((attemptReconnect = false): WebSocket | null => {
    if (!gameId) return null;

    try {
      const ws = new WebSocket(`${WS_BASE}/v1/games/${gameId}/ws`);
      wsRef.current = ws;

      if (attemptReconnect) {
        setStatus("reconnecting");
      } else {
        setStatus("connecting");
      }

      ws.onopen = () => {
        console.log(`WebSocket ${attemptReconnect ? 'reconnected' : 'connected'} for game ${gameId}`);
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
        
        // Send queued moves immediately upon reconnection
        if (moveQueueRef.current.length > 0) {
          console.log(`Dispatching ${moveQueueRef.current.length} queued moves`);
          moveQueueRef.current.forEach(move => {
            ws.send(JSON.stringify({ 
              type: "move", 
              gameId, 
              from: move.from, 
              to: move.to, 
              promotion: move.promotion 
            }));
          });
          moveQueueRef.current = [];
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "move") {
            setLastOpponentMove({
              from: data.from,
              to: data.to,
              promotion: data.promotion,
            });
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed for game ${gameId}. Code: ${event.code}, Reason: ${event.reason}`);
        
        if (!isManualDisconnectRef.current) {
          setStatus("disconnected");
          // Inline reconnection logic to avoid circular dependency
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = calculateReconnectDelay(reconnectAttemptsRef.current);
            console.log(`Attempting reconnection ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              createWebSocket(true);
            }, delay);
          } else {
            console.log("Max reconnection attempts reached");
            setStatus("error");
          }
        } else {
          setStatus("idle");
          isManualDisconnectRef.current = false;
        }
      };

      return ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setStatus("error");
      return null;
    }
  }, [gameId, calculateReconnectDelay]);

  const sendMove = useCallback((move: ChessMove) => {
    // If WebSocket is open, send immediately
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: "move", 
        gameId, 
        from: move.from, 
        to: move.to, 
        promotion: move.promotion 
      }));
      console.log("Move sent immediately:", move);
    } else {
      // Queue the move for when we reconnect
      moveQueueRef.current.push(move);
      console.log("Move queued (disconnected):", move);
      
      // Start reconnection if not already attempting
      if (status === "disconnected" || status === "idle") {
        reconnectAttemptsRef.current = 0;
        createWebSocket(true);
      }
    }
  }, [gameId, status, createWebSocket]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();
    
    if (wsRef.current) {
      wsRef.current.close(1000, "Manual disconnect");
      wsRef.current = null;
    }
    
    // Clear move queue on manual disconnect
    moveQueueRef.current = [];
    reconnectAttemptsRef.current = 0;
  }, [clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    isManualDisconnectRef.current = false;
    clearReconnectTimeout();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    createWebSocket(true);
  }, [clearReconnectTimeout, createWebSocket]);

  // Initialize WebSocket when gameId changes
  useEffect(() => {
    if (gameId) {
      const ws = createWebSocket();
      return () => {
        isManualDisconnectRef.current = true;
        clearReconnectTimeout();
        if (ws) {
          ws.close();
        }
      };
    } else {
      setStatus("idle");
      setLastOpponentMove(null);
    }
  }, [gameId, createWebSocket, clearReconnectTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearReconnectTimeout]);

  return {
    status,
    gameId,
    lastOpponentMove,
    sendMove,
    disconnect,
    reconnect,
  };
}

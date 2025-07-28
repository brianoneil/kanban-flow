import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@shared/schema';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);
      console.log('Current location:', window.location.href);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'INITIAL_DATA':
              // Set initial cards data
              queryClient.setQueryData(['/api/cards'], message.data);
              break;
              
            case 'CARD_CREATED':
              // Add new card to the cache
              queryClient.setQueryData(['/api/cards'], (oldData: Card[] = []) => {
                return [...oldData, message.data];
              });
              break;
              
            case 'CARD_UPDATED':
              // Update existing card in cache
              queryClient.setQueryData(['/api/cards'], (oldData: Card[] = []) => {
                return oldData.map(card => 
                  card.id === message.data.id ? message.data : card
                );
              });
              break;
              
            case 'CARD_DELETED':
              // Remove card from cache
              queryClient.setQueryData(['/api/cards'], (oldData: Card[] = []) => {
                return oldData.filter(card => card.id !== message.data.id);
              });
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    ws: wsRef.current
  };
}
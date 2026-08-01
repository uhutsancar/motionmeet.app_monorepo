import { createContext, type RefObject } from "react";
import type { ClientToServerEvents, ServerToClientEvents } from "@motionmeet/shared";
import type { Socket } from "socket.io-client";

export type MotionMeetSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export interface SocketContextValue {
  socket: MotionMeetSocket | null;
  socketRef: RefObject<MotionMeetSocket | null>;
  connected: boolean;
  onlineUsers: Set<string>;
  sendMessage: (toUserId: string, text: string, operationId?: string | null) => boolean;
  sendTypingStart: (toUserId: string) => void;
  sendTypingStop: (toUserId: string) => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export interface ChatMessagePayload {
  message: string;
}

export interface BroadcastMessage {
  senderId: number;
  senderEmail: string;
  message: string;
  timestamp: string;
}

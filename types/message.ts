import { Timestamp } from 'firebase/firestore'

export type MessageType = 'text' | 'image' | 'voice'

export interface Message {
  id: string
  senderId: string
  text: string
  audioUrl?: string
  durationSeconds?: number
  type: MessageType
  readBy: string[]
  createdAt: Timestamp
}

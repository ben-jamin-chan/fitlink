import { Timestamp } from 'firebase/firestore'

import type { UserProfile } from '@/types/user'

export interface Match {
  id: string
  users: [string, string]
  createdAt: Timestamp
  lastMessage?: string
  lastMessageAt?: Timestamp
  [key: string]: unknown
}

export interface MatchWithProfile extends Match {
  otherUser: UserProfile
}

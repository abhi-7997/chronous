export type Role = 'user' | 'operator' | null;

export type ServiceType = string;

export interface User {
  id: number;
  name: string;
  mobile: string;
  email: string;
  role: string;
}

export interface Token {
  id: number;
  token_number: string;
  numeric_id: number;
  service: string;
  user_id: number | null;
  user_name: string;
  user_mobile: string;
  status: 'waiting' | 'serving' | 'completed' | 'cancelled';
  counter: string | null;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  alarm_before?: number | null;
}

export interface SystemState {
  sessionActive: boolean;
  tokenSeq: number;
  currentToken: string | null;
  currentService: string | null;
  currentCounter: string;
  lastCompletedToken: string | null;
  lastNotification: {
    targetToken: number;
    targetTokenNumber: string;
    time: number;
  } | null;
  lastAlarm?: {
    calledTokenNumber: string;
    calledNumericId: number;
    plusTwoTokenNumber: string;
    plusTwoNumericId: number;
    time: number;
  } | null;
}

export interface QueueState {
  systemState: SystemState;
  waitingTokens: Token[];
  currentServing: Token | null;
  completedTokens: Token[];
  totalGenerated: number;
}

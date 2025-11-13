// src/types.ts
export interface Asset {
    assetId: string;
    balance: number;
    name?: string;
    iconURL?: string;
    metadata?: string;
    incoming?: boolean;
    incomingAmount?: number;
    new?: boolean;
  }
  
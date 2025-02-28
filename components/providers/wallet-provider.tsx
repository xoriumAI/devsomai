"use client";

import { FC, ReactNode } from 'react';
import { Connection } from '@solana/web3.js';

interface Props {
  children: ReactNode;
}

const connection = new Connection('https://solana-api.instantnodes.io/token-RRGPc9gLXCcxjGKwzEwf4RQ9ejdocJum', {
  wsEndpoint: 'wss://solana-api.instantnodes.io/token-RRGPc9gLXCcxjGKwzEwf4RQ9ejdocJum',
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

export const WalletContextProvider: FC<Props> = ({ children }) => {
  return <>{children}</>;
};
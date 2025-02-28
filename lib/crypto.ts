import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { encrypt } from './encryption';

export async function generateKeyPair() {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toString();
  const privateKey = bs58.encode(keypair.secretKey);
  return { publicKey, privateKey };
}

export async function encryptPrivateKey(privateKey: string): Promise<string> {
  return encrypt(privateKey);
} 
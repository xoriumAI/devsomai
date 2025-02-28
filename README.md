# Solana Wallet Manager

A secure and efficient Solana wallet management system with token creation capabilities.

## Features

- Create and manage multiple Solana wallets
- Import existing wallets using private keys
- Add CEX wallet addresses for tracking
- Create and launch Solana tokens with metadata
- Upload images to IPFS via Pinata
- Create metadata for tokens
- Dashboard with wallet overview
- Send SOL between wallets
- Group wallets by purpose

## Tech Stack

- Next.js 13 with App Router
- TypeScript
- Tailwind CSS
- Prisma with SQLite
- Solana Web3.js
- Metaplex Token Metadata
- Pinata SDK for IPFS storage

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/xoriumAI/wallet.git
cd wallet
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL="file:./dev.db"
PINATA_API_KEY="your_pinata_api_key"
PINATA_API_SECRET="your_pinata_api_secret"
PINATA_JWT="your_pinata_jwt"
```

4. Run database migrations
```bash
npx prisma migrate dev
```

5. Start the development server
```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## License

MIT 
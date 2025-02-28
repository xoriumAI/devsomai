"use client";

import { SplTokenCreator } from "@/components/spl-token-creator";
import { PageHeader } from "@/components/page-header";
import { DevnetNotice } from "@/components/devnet-notice";

export default function SplTokenPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="SPL Token Creator"
        subheading="Create your own SPL token on Solana devnet"
      />
      <DevnetNotice />
      <SplTokenCreator />
    </div>
  );
} 
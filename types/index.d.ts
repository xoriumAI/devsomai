import { ButtonHTMLAttributes, InputHTMLAttributes, SVGProps } from "react";

declare module "@/components/ui/button" {
  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    asChild?: boolean;
  }
}

declare module "@/components/ui/input" {
  export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    placeholder?: string;
    value?: string;
    type?: string;
  }
}

declare module "lucide-react" {
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
    className?: string;
    "aria-hidden"?: string;
  }
}

declare module "@/store/wallet-store" {
  export interface WalletStore {
    addWallet: (privateKey: string, publicKey: string, name?: string) => Promise<void>;
    userId: string | null;
  }
}

declare module "@/lib/wallet" {
  export interface WalletKeys {
    privateKey: string;
    publicKey: string;
  }
  
  export function generateWallet(): Promise<WalletKeys>;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
} 
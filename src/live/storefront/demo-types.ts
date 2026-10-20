import type { ReactNode } from "react";
import type { Product, Settings, Store } from "../api";
import type { CheckoutItem } from "./Cart";

export type DemoOrder = {
  number: string;
  createdAt: string;
  shipping: number;
  method: string;
  items: { name: string; variant: string; quantity: number; price: number }[];
};
export type StorefrontDemo = {
  base: string;
  store: Store;
  settings: Settings;
  products: Product[];
  complete: (items: CheckoutItem[], method: string) => void;
  completion: ReactNode;
  account: (close: () => void) => ReactNode;
  chat: (request: { product: Product; key: number } | null) => ReactNode;
};

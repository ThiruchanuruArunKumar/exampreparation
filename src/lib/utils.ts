import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripNullBytes(obj: any): any {
  if (typeof obj === "string") return obj.replace(/\0/g, "");
  if (Array.isArray(obj)) return obj.map(stripNullBytes);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, stripNullBytes(v)])
    );
  }
  return obj;
}

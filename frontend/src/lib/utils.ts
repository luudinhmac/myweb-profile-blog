import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Kết hợp các Class Name của Tailwind một cách thông minh,
 * giúp xử lý các class bị ghi đè hoặc xung đột một cách tự động.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

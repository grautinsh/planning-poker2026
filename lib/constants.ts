// lib/constants.ts
// Fibonacci planning poker deck — single source of truth for server validation and client UI
export const FIBONACCI_DECK = ['1', '2', '3', '5', '8', '13', '21', '34', '55', '∞', '?'] as const
export type FibonacciValue = (typeof FIBONACCI_DECK)[number]

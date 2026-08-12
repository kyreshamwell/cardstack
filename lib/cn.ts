// lib/cn.ts — class-name merge helper.
//
// This lives apart from lib/utils.ts on purpose: components.json points
// shadcn's "utils" alias here, so the CLI can't overwrite our own helpers
// (formatCurrency, calcUtilization, and the rest) when it installs a component.

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

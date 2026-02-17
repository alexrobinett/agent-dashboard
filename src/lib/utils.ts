import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPriorityColor(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#EF4444' // red
    case 'normal':
    case 'medium':
      return '#F59E0B' // amber
    case 'low':
      return '#3B82F6' // blue
    default:
      return '#6B7280' // gray
  }
}

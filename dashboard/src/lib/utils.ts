import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function truncateHash(hash: string, length: number = 8): string {
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

export function getGradeFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-emerald-500";
    case "B": return "text-green-500";
    case "C": return "text-yellow-500";
    case "D": return "text-orange-500";
    case "F": return "text-red-500";
    default: return "text-gray-500";
  }
}

export function getDecisionColor(decision: string): string {
  switch (decision) {
    case "ALLOW": return "badge-allow";
    case "WARN": return "badge-warn";
    case "REQUIRE_EXTRA_VERIFICATION": return "badge-require";
    case "BLOCK": return "badge-block";
    default: return "";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "VERIFIED": return "text-emerald-500";
    case "PROCESSING": return "text-blue-500";
    case "QUEUED": return "text-yellow-500";
    case "FAILED": return "text-red-500";
    default: return "text-gray-500";
  }
}

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

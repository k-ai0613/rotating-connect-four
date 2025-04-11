import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * tailwind classesをマージするためのユーティリティ関数
 * clsxを使用して複数のクラス名を条件付きで結合し、
 * tailwind-mergeを使用して競合するTailwindクラスを解決します
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * テキストをクリップボードにコピーするユーティリティ関数
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // フォールバック方法
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    return successful;
  } catch (error) {
    console.error('クリップボードへのコピーに失敗しました:', error);
    return false;
  }
} 
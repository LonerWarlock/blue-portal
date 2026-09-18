'use client';

import Link from 'next/link';

interface DataCollectionNoticeProps {
  /** Brief description of what data is being collected */
  dataCollected: string;
  /** Why the data is being collected */
  purpose: string;
  /** Optional extra class names */
  className?: string;
}

/**
 * DPDP Act compliant data collection notice.
 * Must be shown at every point where personal data is collected.
 */
export default function DataCollectionNotice({ dataCollected, purpose, className = '' }: DataCollectionNoticeProps) {
  return (
    <div className={`rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 p-3 text-xs text-blue-800 dark:text-blue-300 ${className}`}>
      <p className="font-semibold mb-1 flex items-center gap-1.5">
        <i className="fa-solid fa-shield-halved text-[10px]"></i>
        Data Collection Notice
      </p>
      <p className="leading-relaxed text-blue-700 dark:text-blue-400">
        <strong>What we collect:</strong> {dataCollected}.{' '}
        <strong>Purpose:</strong> {purpose}.{' '}
        Your data is processed in accordance with the Digital Personal Data Protection Act, 2023.{' '}
        <Link href="/privacy" className="underline hover:text-blue-900 dark:hover:text-blue-200">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}

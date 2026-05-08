'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function ExtensionInstallModal({
  isOpen,
  browser,
  onClose,
}: {
  isOpen: boolean;
  browser: 'chrome' | 'firefox' | null;
  onClose: () => void;
}) {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen || !browser) return null;

  const isBrowser = browser === 'chrome';

  const steps = isBrowser
    ? [
        {
          number: 1,
          title: 'Extract the ZIP file',
          description: 'Locate the downloaded diotest-extension-chrome.zip file and extract it to a folder.',
        },
        {
          number: 2,
          title: 'Open Chrome Extensions',
          description: 'In Chrome, go to chrome://extensions or click Menu → More tools → Extensions',
          code: 'chrome://extensions',
        },
        {
          number: 3,
          title: 'Enable Developer Mode',
          description: 'Toggle the "Developer mode" switch in the top right corner.',
        },
        {
          number: 4,
          title: 'Load unpacked',
          description: 'Click the "Load unpacked" button that appears after enabling Developer Mode.',
        },
        {
          number: 5,
          title: 'Select the extension folder',
          description: 'Navigate to and select the extracted diotest-extension folder (the one containing manifest.json).',
        },
        {
          number: 6,
          title: 'Done!',
          description: 'The extension is now installed. Pin it to your toolbar for easy access.',
        },
      ]
    : [
        {
          number: 1,
          title: 'Extract the ZIP file',
          description: 'Locate the downloaded diotest-extension-firefox.zip file and extract it to a folder.',
        },
        {
          number: 2,
          title: 'Open Firefox about:debugging',
          description: 'In Firefox, go to about:debugging#/runtime/this-firefox',
          code: 'about:debugging#/runtime/this-firefox',
        },
        {
          number: 3,
          title: 'Load Temporary Add-on',
          description: 'Click the "Load Temporary Add-on..." button.',
        },
        {
          number: 4,
          title: 'Select manifest.json',
          description: 'Navigate to the extracted folder and select the manifest.json file.',
        },
        {
          number: 5,
          title: 'Done!',
          description: 'The extension is now installed. It will be active until you restart Firefox.',
        },
      ];

  const copyToClipboard = (text: string, stepNumber: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepNumber);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[12px] border border-white/6 bg-[#1a1b20] p-8 shadow-[0_50px_150px_rgba(0,0,0,0.5)]">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">
            Install DioTest Recorder for {browser === 'chrome' ? 'Chrome' : 'Firefox'}
          </h2>
          <p className="mt-2 text-[#8b8e96]">
            Follow these steps to install the extension on your browser.
          </p>
        </div>

        <div className="space-y-6">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#2f6d55] bg-[#0f231b] text-sm font-bold text-[#53dca4]">
                {step.number}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-[#8b8e96]">{step.description}</p>
                {step.code && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(step.code, step.number)}
                    className={cn(
                      'mt-2 rounded-[6px] border px-3 py-2 font-mono text-xs transition',
                      copiedStep === step.number
                        ? 'border-[#2f6d55] bg-[#0f231b] text-[#53dca4]'
                        : 'border-white/10 bg-white/5 text-[#9ca0a8] hover:bg-white/10',
                    )}
                  >
                    {copiedStep === step.number ? '✓ Copied!' : step.code}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-white/6 pt-6">
          <div className="text-xs text-[#7f8289]">
            {browser === 'chrome'
              ? '💡 Tip: Pin the extension to your toolbar by clicking the puzzle icon in Chrome.'
              : '💡 Tip: The extension will be active until you restart Firefox.'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] bg-[#53dca4] px-6 py-2 text-sm font-semibold text-[#063523] transition hover:bg-[#66e6b1]"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

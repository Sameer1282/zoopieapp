'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const TERMS_STORAGE_KEY = 'zoopie_terms_accepted_v1';

export interface TermsAgreementModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline?: () => void;
}

export function TermsAgreementModal({ isOpen, onAccept, onDecline }: TermsAgreementModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  // Sync state if modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!isChecked) return;
    try {
      localStorage.setItem(TERMS_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Ignore localStorage write failures in sandboxed/incognito contexts
    }
    onAccept();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (onDecline) onDecline();
      }}
      title="Welcome to Zoopie: Safety & Guidelines"
      description="Zoopie is an adult-only social platform for spontaneous conversations. Please review our safety commitments and agree before joining."
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
          <span className="text-xs text-neutral-400">You must be 18+ to enter.</span>
          <div className="flex gap-2">
            {onDecline && (
              <Button
                variant="ghost"
                size="md"
                onClick={onDecline}
                className="text-neutral-400 hover:text-white"
              >
                Go Back
              </Button>
            )}
            <Button
              variant="brand"
              size="md"
              disabled={!isChecked}
              onClick={handleConfirm}
              className="font-medium"
            >
              I Agree & Enter Chat
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-sm text-neutral-300">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-200">
            <strong>Mandatory Age Requirement:</strong> Zoopie is strictly restricted to individuals
            aged 18 and older. Minors are strictly prohibited from using this platform.
          </div>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Community Rules & Expectations
          </h4>
          <ul className="space-y-2 text-xs leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Respect fellow participants:</strong> Harassment, bullying, threats, hate
                speech, sexual solicitation, non-consensual sexual content, and illegal materials
                are strictly banned.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Your privacy is protected:</strong> Real-time audio and video are
                peer-to-peer and transient. We never record, intercept, or store your live
                conversations.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Empowered user controls:</strong> You have full control. Use <em>Next</em>{' '}
                to find someone new, <em>Stop</em> to exit immediately, or <em>Report & Block</em>{' '}
                to flag inappropriate behavior.
              </span>
            </li>
          </ul>
        </div>

        <div className="pt-2 pb-1 border-t border-neutral-800 text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-400 hover:underline"
          >
            Terms of Service <ExternalLink className="w-3 h-3" />
          </Link>
          <Link
            href="/safety"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-400 hover:underline"
          >
            Safety Guidelines <ExternalLink className="w-3 h-3" />
          </Link>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-brand-400 hover:underline"
          >
            Privacy Policy <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="pt-2 border-t border-neutral-800">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={e => setIsChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
            />
            <span className="text-xs text-neutral-300 group-hover:text-white select-none">
              I certify that I am at least 18 years of age and agree to the Zoopie Terms of Service,
              Community Guidelines, and Privacy Policy.
            </span>
          </label>
        </div>
      </div>
    </Dialog>
  );
}

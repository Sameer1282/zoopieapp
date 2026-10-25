'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ReportCategory } from '@zoopie/shared';
import { config } from '@/lib/config';

export interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reporterSessionId: string;
  reportedSessionId?: string;
  conversationId?: string;
  onReportSuccess?: () => void;
  onBlockPeer?: () => void;
}

const REPORT_CATEGORIES: { value: ReportCategory; label: string; desc: string }[] = [
  {
    value: 'HARASSMENT',
    label: 'Harassment or Bullying',
    desc: 'Persistent insults, offensive language, or targeted abuse.',
  },
  {
    value: 'INAPPROPRIATE_CONTENT',
    label: 'Inappropriate or Sexual Content',
    desc: 'Unsolicited explicit acts, nudity, or sexually suggestive material.',
  },
  {
    value: 'THREATS_OR_VIOLENCE',
    label: 'Threats, Violence, or Harm',
    desc: 'Threats of violence, self-harm, coercion, or danger.',
  },
  {
    value: 'HATE_SPEECH',
    label: 'Hate Speech or Discrimination',
    desc: 'Attacks on identity, race, religion, gender, or protected groups.',
  },
  {
    value: 'SPAM_OR_BOT',
    label: 'Spam, Bot, or Scam',
    desc: 'Commercial spam, phishing links, bots, or automated scripts.',
  },
  {
    value: 'IMPERSONATION',
    label: 'Impersonation or False Identity',
    desc: 'Pretending to be someone else or deceptive identity.',
  },
  {
    value: 'OTHER',
    label: 'Other Guideline Violation',
    desc: 'Other violations of Zoopie Community Guidelines.',
  },
];

export function ReportDialog({
  isOpen,
  onClose,
  reporterSessionId,
  reportedSessionId,
  conversationId,
  onReportSuccess,
  onBlockPeer,
}: ReportDialogProps) {
  const [category, setCategory] = useState<ReportCategory>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const resetForm = () => {
    setCategory('HARASSMENT');
    setDetails('');
    setAlsoBlock(true);
    setFeedback(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const apiUrl = config.apiUrl;

    try {
      // 1. Submit Abuse Report
      const reportRes = await fetch(`${apiUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterSessionId,
          reportedSessionId,
          conversationId: conversationId || undefined,
          category,
          details: details.trim() || undefined,
        }),
      });

      if (!reportRes.ok) {
        if (reportRes.status === 409) {
          setFeedback({
            type: 'success',
            message:
              'You have already reported this participant. Our moderation system is processing it.',
          });
          if (alsoBlock && onBlockPeer) {
            onBlockPeer();
          }
          return;
        }

        const errData = await reportRes.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Report failed with status ${reportRes.status}`);
      }

      // 2. Submit Block if requested
      if (alsoBlock) {
        try {
          const targetFingerprint =
            reportedSessionId ||
            (conversationId
              ? `fp_match_${conversationId.replace(/[^a-zA-Z0-9]/g, '').padEnd(16, '0')}`
              : `fp_anon_${Date.now()}_00000000`);
          await fetch(`${apiUrl}/api/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blockerSessionId: reporterSessionId,
              blockedFingerprint: targetFingerprint,
              reason: category,
            }),
          });
        } catch {
          // Block submission fallback
        }
      }

      setFeedback({
        type: 'success',
        message: 'Thank you. Your report has been submitted to trust and safety.',
      });

      if (alsoBlock && onBlockPeer) {
        onBlockPeer();
      }

      if (onReportSuccess) {
        onReportSuccess();
      }

      // Auto close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to submit report. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Report Participant"
      description="Report severe guideline violations. We take participant safety seriously."
      size="md"
    >
      {feedback?.type === 'success' ? (
        <div className="py-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-white">Report Submitted</h4>
          <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
            {feedback.message}
          </p>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-1 text-sm text-neutral-300">
          {feedback?.type === 'error' && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-2.5 items-start text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Category selection */}
          <div className="space-y-1.5">
            <label htmlFor="report-reason-select" className="text-xs font-medium text-neutral-300">
              Reason for report <span className="text-red-400">*</span>
            </label>
            <select
              id="report-reason-select"
              value={category}
              onChange={e => setCategory(e.target.value as ReportCategory)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 transition-colors"
            >
              {REPORT_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-500">
              {REPORT_CATEGORIES.find(c => c.value === category)?.desc}
            </p>
          </div>

          {/* Details input */}
          <div className="space-y-1.5">
            <label
              htmlFor="report-details-textarea"
              className="text-xs font-medium text-neutral-300"
            >
              Additional Details <span className="text-neutral-500">(Optional)</span>
            </label>
            <textarea
              id="report-details-textarea"
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Provide any context that will help our moderation team understand the incident..."
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-brand-500 resize-none transition-colors"
            />
            <div className="text-right text-[10px] text-neutral-500">{details.length}/1000</div>
          </div>

          {/* Block option */}
          <div className="pt-2 border-t border-neutral-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoBlock}
                onChange={e => setAlsoBlock(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
              />
              <span className="text-xs text-neutral-300">
                <strong>Also block this participant:</strong> Prevent ever being paired with this
                participant again in future matchmaking.
              </span>
            </label>
          </div>

          {/* Honest Moderation Disclosure */}
          <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 flex gap-2.5 items-start text-[11px] text-neutral-400 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong>Disclosure:</strong> Reporting creates an auditable record for our trust &
              safety team. We do not promise immediate live human intervention. If you feel
              uncomfortable, please leave the conversation immediately.
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isSubmitting}
              className="flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

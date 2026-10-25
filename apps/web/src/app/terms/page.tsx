import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Scale, AlertCircle, FileCheck, ShieldAlert, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service (Draft)',
  description: 'Draft terms of service and acceptable use agreement for the Zoopie platform.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Homepage</span>
      </Link>

      <div className="space-y-3">
        <Badge variant="outline">Legal Agreement</Badge>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
          Terms of Service
        </h1>
        <p className="text-surface-400 text-sm sm:text-base leading-relaxed">
          The rules and conditions governing access and use of the Zoopie service.
        </p>
      </div>

      {/* Mandatory Legal Review Banner */}
      <Alert variant="warning" title="Draft Agreement — Subject to Formal Legal Counsel Review">
        This document represents an initial legal framework draft prepared for Phase 2
        implementation. It has not yet received formal sign-off from accredited legal counsel and is
        provided for architecture staging purposes only.
      </Alert>

      <div className="space-y-6">
        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 border border-brand-500/30">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                1. Acceptance & Age Eligibility
              </h2>
              <span className="text-xs text-surface-400">Binding condition</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            By connecting to Zoopie or initiating any session, you affirm that you are at least
            eighteen (18) years of age and possess the legal capacity to enter into these terms. If
            you are under 18 or do not agree to these terms, you must discontinue using the platform
            immediately.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-500/15 text-coral-400 border border-coral-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                2. Prohibited Conduct & Termination
              </h2>
              <span className="text-xs text-surface-400">Immediate disconnection</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            You agree not to transmit illegal materials, conduct non-consensual sexual acts on
            camera, propagate malware, deploy automated harvesting bots, or harass others. Violation
            of these rules triggers immediate device bans and, where appropriate, referral to law
            enforcement agencies.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                3. Disclaimer of Warranties & As-Is Provision
              </h2>
              <span className="text-xs text-surface-400">Operational reality</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            Zoopie is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
            of any kind, whether express or implied. Because conversations occur in real time with
            random third parties, we cannot guarantee partner behavior or uninterrupted service
            availability.
          </p>
        </Card>

        <Card className="border-surface-800 bg-surface-900/80 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-800 text-surface-200 border border-surface-700">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                4. Limitation of Liability
              </h2>
              <span className="text-xs text-surface-400">Damages threshold</span>
            </div>
          </div>
          <p className="text-sm text-surface-300 leading-relaxed">
            To the maximum extent permitted by applicable law, Zoopie and its operators shall not be
            liable for any indirect, incidental, punitive, or consequential damages resulting from
            user conduct or technical downtime.
          </p>
        </Card>
      </div>
    </div>
  );
}

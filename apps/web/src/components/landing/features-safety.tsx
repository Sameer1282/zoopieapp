import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock, UserX, EyeOff, Flame, Zap, ArrowRight, Sparkles } from 'lucide-react';

export function FeaturesSafety() {
  const features = [
    {
      title: 'Peer-to-Peer Privacy',
      desc: 'Video and audio travel directly between participants over WebRTC. Zoopie never records, proxies, or stores your media streams.',
      icon: Lock,
      badge: 'Privacy by Design',
    },
    {
      title: 'Zero Account Friction',
      desc: 'No registration, no passwords, and no email tracking. You are identified only by an ephemeral session key that vanishes upon disconnect.',
      icon: UserX,
      badge: 'Frictionless',
    },
    {
      title: 'Instant One-Click Skip',
      desc: 'You maintain absolute control over who you speak with. Skip incompatible partners with a single tap or keyboard shortcut.',
      icon: Zap,
      badge: 'User Control',
    },
    {
      title: 'Proactive Reporting & Banlist',
      desc: 'Built-in client reporting flags abusive users immediately. Persistent bad actors are isolated to protect the integrity of the community.',
      icon: ShieldCheck,
      badge: 'Community Defense',
    },
    {
      title: 'Zero Data Harvesting',
      desc: 'We do not sell user behavioral data or build advertising dossiers. Conversations are ephemeral and strictly temporary.',
      icon: EyeOff,
      badge: 'Integrity',
    },
    {
      title: 'Shared Interests Discovery',
      desc: 'Optional interest tagging lets you discover peers fascinated by the same passions, from music theory to game mechanics.',
      icon: Sparkles,
      badge: 'Relevance',
    },
  ];

  return (
    <section id="features" className="space-y-12 scroll-mt-20">
      {/* Features Grid */}
      <div className="space-y-6">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="teal" size="sm">
            Architecture Pillars
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            Built for Privacy, Speed, and Respect
          </h2>
          <p className="text-sm sm:text-base text-surface-400">
            Zoopie rethinks spontaneous social discovery with modern cryptographic standards and
            user-first principles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={i}
                className="border-surface-800 bg-surface-900/60 p-6 space-y-3 hover:border-surface-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" size="sm">
                    {f.badge}
                  </Badge>
                </div>
                <h3 className="font-bold text-base text-white">{f.title}</h3>
                <p className="text-xs text-surface-400 leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Safety Highlight Banner */}
      <div className="rounded-2xl border border-surface-700/80 bg-gradient-to-r from-surface-900 via-surface-850 to-surface-900 p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-coral-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-coral-400">
                Community Guidelines & Age Requirement
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              Respect is Non-Negotiable
            </h3>
            <p className="text-xs sm:text-sm text-surface-300 leading-relaxed">
              Zoopie is for mature individuals (18+) who value human conversation. Harassment,
              non-consensual behavior, hate speech, and illicit content result in immediate
              expulsion.
            </p>
          </div>
          <Link href="/safety">
            <Button variant="secondary" size="lg" className="gap-2 shrink-0">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>Read Safety Guide</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

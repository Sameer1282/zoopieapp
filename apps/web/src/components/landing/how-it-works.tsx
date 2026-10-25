import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sliders, Users, Radio, FastForward } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Pick Mode & Interests',
      desc: 'Select Camera or Text chat. Optionally add tags like Gaming, Music, or Coding to pair with like-minded people.',
      icon: Sliders,
      badge: 'Step 1',
    },
    {
      step: '02',
      title: 'Real-Time Pairing',
      desc: 'Our signaling engine pairs you with an available conversationalist matching your chosen preferences in seconds.',
      icon: Users,
      badge: 'Step 2',
    },
    {
      step: '03',
      title: 'Direct Peer Media',
      desc: 'Your media stream flows directly between browsers via peer-to-peer WebRTC with end-to-end media encryption.',
      icon: Radio,
      badge: 'Step 3',
    },
    {
      step: '04',
      title: 'Next Whenever You Want',
      desc: 'Ready for someone new? Press Next or tap Escape to instantly disconnect and discover your next interaction.',
      icon: FastForward,
      badge: 'Step 4',
    },
  ];

  return (
    <section id="how-it-works" className="space-y-8 scroll-mt-20">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <Badge variant="brand" size="sm">
          Simple & Frictionless
        </Badge>
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          How Zoopie Works
        </h2>
        <p className="text-sm sm:text-base text-surface-400">
          Four straightforward steps from opening the site to having an authentic, spontaneous
          conversation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(s => {
          const Icon = s.icon;
          return (
            <Card
              key={s.step}
              className="relative border-surface-800 bg-surface-900/60 p-6 space-y-4 hover:border-surface-700 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-surface-700 font-mono">{s.step}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-base text-white">{s.title}</h3>
                <p className="text-xs text-surface-400 leading-relaxed">{s.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

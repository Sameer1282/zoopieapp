import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TextChatInterface } from '../../src/components/chat/text-chat-interface';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    })),
  };
});

window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Phase 5: Matchmaking UI States', () => {
  it('renders idle state with Start Matchmaking button when not searching', () => {
    render(<TextChatInterface isDevFixture={false} autoStartSearch={false} />);

    expect(screen.getByText(/ready to match/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /start matchmaking/i })).toBeDefined();
    expect(screen.getByText(/general pool/i)).toBeDefined();
  });

  it('renders searching state with honest indicator and cancel action when autoStartSearch is enabled', () => {
    render(
      <TextChatInterface
        isDevFixture={false}
        autoStartSearch={true}
        interests={['coding', 'design']}
      />
    );

    expect(screen.getByText(/searching for partner/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /cancel search/i })[0]).toBeDefined();
    expect(screen.getByText('#coding')).toBeDefined();
    expect(screen.getByText('#design')).toBeDefined();
  });
});

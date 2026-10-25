import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Phase 4: TextChatInterface Component', () => {
  it('renders the chat interface with room title and waiting state', () => {
    render(<TextChatInterface initialMatchId="test-unit-room-1" isDevFixture={true} />);

    expect(screen.getByText(/waiting for peer/i)).toBeDefined();
    expect(screen.getByText(/room: test-unit-room-1/i)).toBeDefined();
    expect(screen.getByText(/dev fixture match/i)).toBeDefined();
    expect(screen.getByRole('log', { name: /conversation messages/i })).toBeDefined();
  });

  it('updates input value and reflects character counter', () => {
    render(<TextChatInterface initialMatchId="test-unit-room-2" />);

    const input = screen.getByLabelText(/type a message/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Hello Zoopie!' } });

    expect(input.value).toBe('Hello Zoopie!');
    expect(screen.getByText('13 / 1000')).toBeDefined();
  });

  it('disables send button when input is empty', () => {
    render(<TextChatInterface initialMatchId="test-unit-room-3" />);

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders topics when provided via props', () => {
    render(<TextChatInterface initialMatchId="test-unit-room-4" interests={['Gaming', 'Music']} />);

    expect(screen.getByText('#Gaming')).toBeDefined();
    expect(screen.getByText('#Music')).toBeDefined();
  });
});

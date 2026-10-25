import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Button } from '../../src/components/ui/button';
import { Badge } from '../../src/components/ui/badge';
import { Input } from '../../src/components/ui/input';
import { TagInput } from '../../src/components/ui/tag-input';
import { Dialog } from '../../src/components/ui/dialog';
import { Alert } from '../../src/components/ui/alert';
import { ZoopieIcon, ZoopieWordmark } from '../../src/components/brand/logo';

describe('Design System: Button', () => {
  it('renders with brand variant by default and handles clicks', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeDefined();
    expect(btn.className).toContain('from-brand-600');
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders loading spinner and sets aria-busy when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('renders teal variant with appropriate classes', () => {
    render(<Button variant="teal">Teal Action</Button>);
    const btn = screen.getByRole('button', { name: /teal action/i });
    expect(btn.className).toContain('from-teal-600');
  });
});

describe('Design System: Badge', () => {
  it('renders different badge variants correctly', () => {
    const { rerender } = render(<Badge variant="brand">Brand Badge</Badge>);
    expect(screen.getByText('Brand Badge').className).toContain('text-brand-300');

    rerender(<Badge variant="teal">Teal Badge</Badge>);
    expect(screen.getByText('Teal Badge').className).toContain('text-teal-300');

    rerender(<Badge variant="warning">Warning Badge</Badge>);
    expect(screen.getByText('Warning Badge').className).toContain('text-amber-400');
  });
});

describe('Design System: Input', () => {
  it('renders label, input, and helper text', () => {
    render(
      <Input label="Username" placeholder="Enter username" helperText="Choose a friendly name" />
    );
    expect(screen.getByLabelText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter username')).toBeDefined();
    expect(screen.getByText('Choose a friendly name')).toBeDefined();
  });

  it('renders error message with alert role and invalid aria state', () => {
    render(<Input label="Email" errorMessage="Invalid address format" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Invalid address format');
  });
});

describe('Design System: TagInput', () => {
  it('renders tags and triggers onChange when removing a tag', () => {
    const handleChange = vi.fn();
    render(<TagInput tags={['Gaming', 'Music']} onChange={handleChange} />);

    expect(screen.getByText('#Gaming')).toBeDefined();
    expect(screen.getByText('#Music')).toBeDefined();

    const removeBtn = screen.getByLabelText('Remove interest Gaming');
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(['Music']);
  });

  it('adds tag when typing and pressing Enter', () => {
    const handleChange = vi.fn();
    render(<TagInput tags={['Tech']} onChange={handleChange} />);

    const input = screen.getByLabelText('Add interest tag');
    fireEvent.change(input, { target: { value: 'Coding' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(['Tech', 'Coding']);
  });

  it('toggles suggestion when clicking on popular topic', () => {
    const handleChange = vi.fn();
    render(<TagInput tags={[]} onChange={handleChange} suggestions={['Gaming', 'Design']} />);

    const suggestionBtn = screen.getByRole('button', { name: /gaming/i });
    fireEvent.click(suggestionBtn);

    expect(handleChange).toHaveBeenCalledWith(['Gaming']);
  });
});

describe('Design System: Dialog Modal', () => {
  it('renders dialog when isOpen is true and handles close', () => {
    const handleClose = vi.fn();
    render(
      <Dialog
        isOpen={true}
        onClose={handleClose}
        title="Session Notice"
        description="Important information"
      >
        <p>Modal body content</p>
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Session Notice')).toBeDefined();
    expect(screen.getByText('Modal body content')).toBeDefined();

    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    render(
      <Dialog isOpen={false} onClose={() => {}} title="Hidden Dialog">
        <p>Hidden body</p>
      </Dialog>
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Design System: Alert', () => {
  it('renders status message and handles dismiss callback', () => {
    const handleDismiss = vi.fn();
    render(
      <Alert variant="warning" title="Notice" onDismiss={handleDismiss}>
        Operation is pending
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Notice')).toBeDefined();
    expect(screen.getByText('Operation is pending')).toBeDefined();

    const dismissBtn = screen.getByLabelText('Dismiss alert');
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Brand: Zoopie Logo & Wordmark', () => {
  it('renders ZoopieIcon and ZoopieWordmark with badge', () => {
    render(<ZoopieWordmark showBadge badgeText="Phase 2" />);
    expect(screen.getByText('Zoop')).toBeDefined();
    expect(screen.getByText('ie')).toBeDefined();
    expect(screen.getByText('Phase 2')).toBeDefined();
  });

  it('renders ZoopieIcon with custom size', () => {
    const { container } = render(<ZoopieIcon size={48} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');
  });
});

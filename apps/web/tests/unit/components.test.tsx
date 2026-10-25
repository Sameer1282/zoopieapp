import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '../../src/components/ui/button';
import { Badge } from '../../src/components/ui/badge';
import { StatusIndicator } from '../../src/components/ui/status-indicator';

describe('UI Components', () => {
  it('renders Button with correct label and variants', () => {
    render(<Button variant="primary">Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.className).toContain('bg-primary-600');
  });

  it('renders disabled Button when disabled prop is passed', () => {
    render(<Button disabled>Disabled Action</Button>);
    const button = screen.getByRole('button', { name: /disabled action/i });
    expect(button.getAttribute('disabled')).not.toBeNull();
  });

  it('renders Badge with text and variant class', () => {
    render(<Badge variant="success">Active</Badge>);
    const badge = screen.getByText('Active');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-emerald-400');
  });

  it('renders StatusIndicator with status label', () => {
    render(<StatusIndicator status="online" label="Gateway Connected" />);
    const label = screen.getByText('Gateway Connected');
    expect(label).toBeDefined();
  });
});

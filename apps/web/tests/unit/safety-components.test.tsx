import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  TermsAgreementModal,
  TERMS_STORAGE_KEY,
} from '../../src/components/safety/terms-agreement-modal';
import { ReportDialog } from '../../src/components/safety/report-dialog';

describe('Phase 7 Frontend Safety Components', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('TermsAgreementModal', () => {
    it('renders 18+ age requirement warning and safety commitments', () => {
      render(<TermsAgreementModal isOpen={true} onAccept={vi.fn()} onDecline={vi.fn()} />);

      expect(screen.getByText(/Mandatory Age Requirement:/i)).toBeDefined();
      expect(
        screen.getByText(/Zoopie is strictly restricted to individuals aged 18 and older/i)
      ).toBeDefined();
      expect(screen.getByText(/Respect fellow participants:/i)).toBeDefined();
      expect(screen.getByText(/Your privacy is protected:/i)).toBeDefined();
    });

    it('keeps acceptance button disabled until 18+ agreement checkbox is checked', () => {
      const handleAccept = vi.fn();
      render(<TermsAgreementModal isOpen={true} onAccept={handleAccept} onDecline={vi.fn()} />);

      const acceptButton = screen.getByRole('button', { name: /I Agree & Enter Chat/i });
      expect(acceptButton.getAttribute('disabled')).not.toBeNull();

      // Checkbox is initially unchecked
      const checkbox = screen.getByRole('checkbox');
      expect((checkbox as HTMLInputElement).checked).toBe(false);

      // Check the box
      fireEvent.click(checkbox);
      expect((checkbox as HTMLInputElement).checked).toBe(true);

      // Accept button should now be enabled
      expect(acceptButton.getAttribute('disabled')).toBeNull();

      // Clicking accept should trigger onAccept and save to localStorage
      fireEvent.click(acceptButton);
      expect(handleAccept).toHaveBeenCalledOnce();
      expect(localStorage.getItem(TERMS_STORAGE_KEY)).not.toBeNull();
    });

    it('calls onDecline when Go Back button is clicked', () => {
      const handleDecline = vi.fn();
      render(<TermsAgreementModal isOpen={true} onAccept={vi.fn()} onDecline={handleDecline} />);

      const declineButton = screen.getByRole('button', { name: /Go Back/i });
      fireEvent.click(declineButton);
      expect(handleDecline).toHaveBeenCalledOnce();
    });
  });

  describe('ReportDialog', () => {
    it('renders report category selector and honest disclosure notice', () => {
      render(
        <ReportDialog
          isOpen={true}
          onClose={vi.fn()}
          reporterSessionId="sess-1"
          reportedSessionId="sess-2"
        />
      );

      expect(screen.getByText(/Report Participant/i)).toBeDefined();
      expect(screen.getByLabelText(/Reason for report/i)).toBeDefined();

      // Verify honest disclosure notice is visible
      expect(screen.getByText(/Disclosure:/i)).toBeDefined();
      expect(
        screen.getByText(/We do not promise immediate live human intervention/i)
      ).toBeDefined();

      // Verify "Also block" checkbox is present and checked by default
      const blockCheckbox = screen.getByRole('checkbox');
      expect((blockCheckbox as HTMLInputElement).checked).toBe(true);
    });

    it('allows typing additional details up to 1000 characters', () => {
      render(
        <ReportDialog
          isOpen={true}
          onClose={vi.fn()}
          reporterSessionId="sess-1"
          reportedSessionId="sess-2"
        />
      );

      const textarea = screen.getByPlaceholderText(/Provide any context that will help/i);
      fireEvent.change(textarea, {
        target: { value: 'User was engaging in inappropriate behavior.' },
      });
      expect((textarea as HTMLTextAreaElement).value).toBe(
        'User was engaging in inappropriate behavior.'
      );
      expect(screen.getByText('44/1000')).toBeDefined();
    });
  });
});

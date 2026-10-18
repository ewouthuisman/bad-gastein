import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const subscribePush = vi.fn();
vi.mock('../../src/features/push/subscribe', () => ({
  subscribePush: () => subscribePush(),
  isStandalone: () => false,
  pushSupported: () => true,
  platform: () => 'ios',
}));

import { InstallGuide, NotificationsCard } from '../../src/features/push/InstallGuide';

describe('InstallGuide', () => {
  it('shows the Safari home-screen steps on iPhone', () => {
    render(<InstallGuide platformOverride="ios" />);
    expect(screen.getByText(/Zet op beginscherm/)).toBeInTheDocument();
  });

  it('shows the install menu step on Android', () => {
    render(<InstallGuide platformOverride="android" />);
    expect(screen.getByText(/App installeren/)).toBeInTheDocument();
  });
});

describe('NotificationsCard', () => {
  it('explains installing first when push is unsupported', async () => {
    subscribePush.mockResolvedValue({ ok: false, reason: 'unsupported' });
    render(<NotificationsCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Meldingen aanzetten' }));
    expect(await screen.findByText(/Installeer de app eerst/)).toBeInTheDocument();
  });

  it('confirms when notifications are on', async () => {
    subscribePush.mockResolvedValue({ ok: true });
    render(<NotificationsCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Meldingen aanzetten' }));
    expect(await screen.findByText('Meldingen staan aan ✅')).toBeInTheDocument();
  });

  it('explains how to undo a refusal', async () => {
    subscribePush.mockResolvedValue({ ok: false, reason: 'denied' });
    render(<NotificationsCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Meldingen aanzetten' }));
    expect(await screen.findByText(/instellingen/)).toBeInTheDocument();
  });
});

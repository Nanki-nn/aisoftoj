// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminTokenUsage } from './AdminTokenUsage';
import * as aiApi from '../../lib/aiApi';

vi.mock('../../lib/aiApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/aiApi')>();
  return {
    ...actual,
    listAdminAIQuotaUsage: vi.fn(),
  };
});

describe('AdminTokenUsage', () => {
  beforeEach(() => {
    vi.mocked(aiApi.listAdminAIQuotaUsage).mockReset();
    vi.mocked(aiApi.listAdminAIQuotaUsage).mockResolvedValue({
      records: [
        {
          user_id: 7,
          login_name: 'reader',
          nick_name: '软考学员',
          email: 'reader@example.com',
          usage_date: '2026-08-27',
          limit: 30_000,
          consumed: 12_000,
          reserved: 3_000,
          remaining: 15_000,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      usage_date: '2026-08-27',
    });
  });

  it('renders daily usage and searches by user keyword', async () => {
    render(<AdminTokenUsage />);

    expect(await screen.findByText('reader')).toBeTruthy();
    expect(screen.getAllByText('12,000').length).toBeGreaterThan(0);
    expect(screen.getByText('50%')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('搜索用户'), { target: { value: 'reader' } });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => {
      expect(aiApi.listAdminAIQuotaUsage).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'reader', page: 1, pageSize: 10 }),
      );
    });
  });
});

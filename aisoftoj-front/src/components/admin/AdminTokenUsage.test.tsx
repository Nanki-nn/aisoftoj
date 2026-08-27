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
    updateAdminAIUserQuota: vi.fn(),
    restoreAdminAIUserQuota: vi.fn(),
  };
});

describe('AdminTokenUsage', () => {
  beforeEach(() => {
    vi.mocked(aiApi.listAdminAIQuotaUsage).mockReset();
    vi.mocked(aiApi.updateAdminAIUserQuota).mockReset();
    vi.mocked(aiApi.restoreAdminAIUserQuota).mockReset();
    vi.mocked(aiApi.updateAdminAIUserQuota).mockResolvedValue({
      user_id: 7,
      limit: 45_000,
      consumed: 12_000,
      reserved: 3_000,
      remaining: 30_000,
      reset_at: '2026-08-28T00:00:00+08:00',
      limit_source: 'user',
    });
    vi.mocked(aiApi.restoreAdminAIUserQuota).mockResolvedValue({
      user_id: 7,
      limit: 30_000,
      consumed: 12_000,
      reserved: 3_000,
      remaining: 15_000,
      reset_at: '2026-08-28T00:00:00+08:00',
      limit_source: 'global',
    });
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
          limit_source: 'global',
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

  it('sets a dedicated user quota from the usage table', async () => {
    render(<AdminTokenUsage />);
    await screen.findByText('reader');

    fireEvent.click(screen.getByRole('button', { name: '调整 reader 的额度' }));
    const input = screen.getByLabelText('专属每日额度');
    fireEvent.change(input, { target: { value: '45000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(aiApi.updateAdminAIUserQuota).toHaveBeenCalledWith(7, 45_000);
    });
  });

  it('restores a dedicated quota to the global limit', async () => {
    vi.mocked(aiApi.listAdminAIQuotaUsage).mockResolvedValueOnce({
      records: [{
        user_id: 7,
        login_name: 'reader',
        nick_name: null,
        email: null,
        usage_date: '2026-08-27',
        limit: 45_000,
        consumed: 12_000,
        reserved: 0,
        remaining: 33_000,
        limit_source: 'user',
      }],
      total: 1,
      page: 1,
      page_size: 10,
      usage_date: '2026-08-27',
    });
    render(<AdminTokenUsage />);
    await screen.findByText('专属额度');

    fireEvent.click(screen.getByRole('button', { name: '调整 reader 的额度' }));
    fireEvent.click(screen.getByRole('button', { name: '恢复全局' }));

    await waitFor(() => {
      expect(aiApi.restoreAdminAIUserQuota).toHaveBeenCalledWith(7);
    });
  });
});

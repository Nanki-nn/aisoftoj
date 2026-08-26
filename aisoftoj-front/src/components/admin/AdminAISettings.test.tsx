// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAISettings } from './AdminAISettings';
import * as aiApi from '../../lib/aiApi';

vi.mock('../../lib/aiApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/aiApi')>();
  return {
    ...actual,
    getAIQuotaConfig: vi.fn(),
    updateAIQuotaConfig: vi.fn(),
  };
});

describe('AdminAISettings', () => {
  beforeEach(() => {
    vi.mocked(aiApi.getAIQuotaConfig).mockReset();
    vi.mocked(aiApi.updateAIQuotaConfig).mockReset();
    vi.mocked(aiApi.getAIQuotaConfig).mockResolvedValue({
      daily_token_limit: 30_000,
      updated_by_user_id: null,
      updated_at: null,
    });
  });

  it('updates the global limit and reloads the authoritative value', async () => {
    vi.mocked(aiApi.updateAIQuotaConfig).mockResolvedValue({
      daily_token_limit: 45_000,
      updated_by_user_id: 1,
      updated_at: '2026-08-27T00:00:00+08:00',
    });
    vi.mocked(aiApi.getAIQuotaConfig)
      .mockResolvedValueOnce({
        daily_token_limit: 30_000,
        updated_by_user_id: null,
        updated_at: null,
      })
      .mockResolvedValueOnce({
        daily_token_limit: 45_000,
        updated_by_user_id: 1,
        updated_at: '2026-08-27T00:00:00+08:00',
      });

    render(<AdminAISettings />);
    const input = await screen.findByLabelText('每名用户每日额度');
    fireEvent.change(input, { target: { value: '45000' } });
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => expect(aiApi.updateAIQuotaConfig).toHaveBeenCalledWith(45_000));
    expect(await screen.findByText('配置已保存并立即生效')).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('45000');
  });

  it('rejects values outside the configured range', async () => {
    render(<AdminAISettings />);
    const input = await screen.findByLabelText('每名用户每日额度');
    fireEvent.change(input, { target: { value: '999' } });
    expect(screen.getByText('请输入 1,000–10,000,000 范围内的整数')).toBeTruthy();
    expect((screen.getByRole('button', { name: '保存配置' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

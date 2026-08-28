// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAISettings } from './AdminAISettings';
import * as aiApi from '../../lib/aiApi';
import * as api from '../../lib/api';

vi.mock('../../lib/aiApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/aiApi')>();
  return {
    ...actual,
    getAIQuotaConfig: vi.fn(),
    updateAIQuotaConfig: vi.fn(),
    getAIAccessConfig: vi.fn(),
    updateAIAccessConfig: vi.fn(),
    listAdminAIRolloutUsers: vi.fn(),
    getAdminAIRolloutStatuses: vi.fn(),
    enableAdminAIRolloutUser: vi.fn(),
    disableAdminAIRolloutUser: vi.fn(),
  };
});

vi.mock('../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, listAdminUsers: vi.fn() };
});

describe('AdminAISettings', () => {
  beforeEach(() => {
    vi.mocked(aiApi.getAIQuotaConfig).mockReset();
    vi.mocked(aiApi.updateAIQuotaConfig).mockReset();
    vi.mocked(aiApi.getAIAccessConfig).mockReset();
    vi.mocked(aiApi.updateAIAccessConfig).mockReset();
    vi.mocked(aiApi.listAdminAIRolloutUsers).mockReset();
    vi.mocked(aiApi.getAdminAIRolloutStatuses).mockReset();
    vi.mocked(aiApi.enableAdminAIRolloutUser).mockReset();
    vi.mocked(aiApi.disableAdminAIRolloutUser).mockReset();
    vi.mocked(api.listAdminUsers).mockReset();
    vi.mocked(aiApi.getAIQuotaConfig).mockResolvedValue({
      daily_token_limit: 30_000,
      updated_by_user_id: null,
      updated_at: null,
    });
    vi.mocked(aiApi.getAIAccessConfig).mockResolvedValue({
      globally_enabled: true,
      rollout_user_count: 0,
      updated_by_user_id: null,
      updated_at: null,
    });
    vi.mocked(aiApi.listAdminAIRolloutUsers).mockResolvedValue({
      records: [], total: 0, page: 1, page_size: 100,
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

  it('confirms and disables AI globally', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(aiApi.updateAIAccessConfig).mockResolvedValue({
      globally_enabled: false,
      rollout_user_count: 0,
      updated_by_user_id: 1,
      updated_at: '2026-08-28T00:00:00+08:00',
    });

    render(<AdminAISettings />);
    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => expect(aiApi.updateAIAccessConfig).toHaveBeenCalledWith(false));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('总开关已关闭，名单仍可编辑，但暂不生效。')).toBeTruthy();
  });

  it('adds a searched user to the rollout list', async () => {
    vi.mocked(api.listAdminUsers).mockResolvedValue({
      records: [{
        id: 7,
        loginName: 'tester',
        nickName: '测试用户',
        email: 'tester@example.com',
        phone: '',
        avatar: '',
        role: 'USER',
        isEnabled: true,
        createTime: '2026-08-28T00:00:00+08:00',
        updateTime: '2026-08-28T00:00:00+08:00',
        lastLoginTime: null,
        sessionCount: 0,
        wrongQuestionCount: 0,
      }],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    vi.mocked(aiApi.getAdminAIRolloutStatuses).mockResolvedValue({
      globally_enabled: true,
      statuses: { '7': false },
    });
    vi.mocked(aiApi.enableAdminAIRolloutUser).mockResolvedValue({ user_id: 7, enabled: true });

    render(<AdminAISettings />);
    await screen.findByLabelText('每名用户每日额度');
    fireEvent.change(screen.getByPlaceholderText('搜索用户名 / 邮箱 / 用户 ID'), {
      target: { value: 'tester' },
    });
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    expect(await screen.findByText('测试用户')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '加入内测' }));
    await waitFor(() => expect(aiApi.enableAdminAIRolloutUser).toHaveBeenCalledWith(7));
  });
});

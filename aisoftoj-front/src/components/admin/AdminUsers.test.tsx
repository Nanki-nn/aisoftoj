// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsers } from './AdminUsers';
import * as api from '../../lib/api';
import * as aiApi from '../../lib/aiApi';

vi.mock('../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, listAdminUsers: vi.fn(), updateAdminUser: vi.fn(), deleteAdminUser: vi.fn() };
});

vi.mock('../../lib/aiApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/aiApi')>();
  return {
    ...actual,
    getAdminAIRolloutStatuses: vi.fn(),
    enableAdminAIRolloutUser: vi.fn(),
    disableAdminAIRolloutUser: vi.fn(),
  };
});

const users: api.AdminUserDTO[] = [
  {
    id: 1, loginName: 'admin', nickName: '管理员', email: 'admin@example.com', phone: '',
    avatar: '', role: 'ADMIN', isEnabled: true, createTime: '2026-08-28T00:00:00+08:00',
    updateTime: '2026-08-28T00:00:00+08:00', lastLoginTime: null, sessionCount: 0,
    wrongQuestionCount: 0,
  },
  {
    id: 7, loginName: 'tester', nickName: '测试用户', email: 'tester@example.com', phone: '',
    avatar: '', role: 'USER', isEnabled: true, createTime: '2026-08-28T00:00:00+08:00',
    updateTime: '2026-08-28T00:00:00+08:00', lastLoginTime: null, sessionCount: 1,
    wrongQuestionCount: 2,
  },
];

describe('AdminUsers AI rollout controls', () => {
  beforeEach(() => {
    vi.mocked(api.listAdminUsers).mockReset().mockResolvedValue({
      records: users, total: users.length, page: 1, pageSize: 10,
    });
    vi.mocked(aiApi.getAdminAIRolloutStatuses).mockReset().mockResolvedValue({
      globally_enabled: true,
      statuses: { '1': false, '7': false },
    });
    vi.mocked(aiApi.enableAdminAIRolloutUser).mockReset().mockResolvedValue({
      user_id: 7, enabled: true,
    });
    vi.mocked(aiApi.disableAdminAIRolloutUser).mockReset();
  });

  it('shows default admin access and can enable a regular user', async () => {
    render(<AdminUsers />);

    expect(await screen.findByText('管理员默认开放')).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'tester AI 内测' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    await waitFor(() => expect(aiApi.enableAdminAIRolloutUser).toHaveBeenCalledWith(7));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('explains that the rollout list is inactive while the global switch is off', async () => {
    vi.mocked(aiApi.getAdminAIRolloutStatuses).mockResolvedValue({
      globally_enabled: false,
      statuses: { '1': false, '7': true },
    });

    render(<AdminUsers />);
    expect(await screen.findByText('AI 功能总开关当前关闭；内测名单仍可编辑，但暂不生效。')).toBeTruthy();
  });
});

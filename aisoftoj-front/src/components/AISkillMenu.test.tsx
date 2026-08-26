// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AISkill } from '../lib/aiApi';
import { AISkillMenu, filterAISkills, slashSkillQuery } from './AISkillMenu';

const skills: AISkill[] = [
  {
    name: 'essay-writing-coach',
    description: '辅导软考论文审题、提纲和润色',
    category: 'public',
    enabled: true,
    license: 'internal',
  },
  {
    name: 'question-explanation',
    description: '讲解软考题目和选项依据',
    category: 'public',
    enabled: true,
    license: null,
  },
  {
    name: 'disabled-skill',
    description: '不可用',
    category: 'public',
    enabled: false,
    license: null,
  },
];

describe('AI Skill filtering', () => {
  it('only recognizes a slash token at the beginning of the input', () => {
    expect(slashSkillQuery('/')).toBe('');
    expect(slashSkillQuery('/ESSAY')).toBe('essay');
    expect(slashSkillQuery('请用 /essay')).toBeNull();
    expect(slashSkillQuery('/essay 写提纲')).toBeNull();
  });

  it('filters enabled skills by name or description', () => {
    expect(filterAISkills(skills, '/').map(skill => skill.name)).toEqual([
      'essay-writing-coach',
      'question-explanation',
    ]);
    expect(filterAISkills(skills, '/essay')).toEqual([skills[0]]);
    expect(filterAISkills(skills, '/题目')).toEqual([skills[1]]);
  });
});

describe('AISkillMenu', () => {
  it('renders accessible options and supports pointer selection', () => {
    const onSelect = vi.fn();
    render(<AISkillMenu skills={skills.slice(0, 2)} highlightedIndex={1} onSelect={onSelect} />);

    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(options[0]);
    expect(onSelect).toHaveBeenCalledWith(skills[0]);
  });

  it('shows an explicit empty result', () => {
    render(<AISkillMenu skills={[]} highlightedIndex={-1} onSelect={vi.fn()} />);
    expect(screen.getByText('未找到可用 Skill')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });
});

import { Sparkles } from 'lucide-react';
import { AISkill } from '../lib/aiApi';

export const AI_SKILL_LISTBOX_ID = 'ai-skill-menu';

export function skillOptionId(name: string): string {
  return `ai-skill-option-${name}`;
}

export function slashSkillQuery(input: string): string | null {
  if (!input.startsWith('/') || /\s/.test(input)) return null;
  return input.slice(1).toLocaleLowerCase();
}

export function filterAISkills(skills: AISkill[], input: string): AISkill[] {
  const query = slashSkillQuery(input);
  if (query === null) return [];
  return skills.filter(skill => skill.enabled && (
    !query
    || skill.name.toLocaleLowerCase().includes(query)
    || skill.description.toLocaleLowerCase().includes(query)
  ));
}

type AISkillMenuProps = {
  skills: AISkill[];
  highlightedIndex: number;
  onSelect: (skill: AISkill) => void;
};

export function AISkillMenu({ skills, highlightedIndex, onSelect }: AISkillMenuProps) {
  return (
    <div
      id={AI_SKILL_LISTBOX_ID}
      role="listbox"
      aria-label="可用 AI Skill"
      className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
    >
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1 text-[11px] font-medium tracking-wide text-slate-400">
        <Sparkles className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
        选择工作模式
      </div>
      {skills.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-slate-500">未找到可用 Skill</p>
      ) : skills.map((skill, index) => {
        const highlighted = index === highlightedIndex;
        return (
          <button
            key={skill.name}
            id={skillOptionId(skill.name)}
            type="button"
            role="option"
            aria-selected={highlighted}
            onPointerDown={event => event.preventDefault()}
            onClick={() => onSelect(skill)}
            className={`block w-full rounded-lg px-3 py-2.5 text-left outline-none transition-colors ${
              highlighted
                ? 'bg-blue-50 text-blue-950'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${highlighted ? 'text-blue-700' : 'text-slate-800'}`}>
                /{skill.name}
              </span>
              <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                highlighted ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                Skill
              </span>
            </span>
            <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
              {skill.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { UsersRound } from 'lucide-react';
import qqCommunityQr from '../assets/qq-community-qr.png';
import { Button } from './ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';

const OPEN_DELAY_MS = 180;
const CLOSE_DELAY_MS = 120;

export function CommunityQrHoverCard() {
  return (
    <div className="hidden lg:block">
      <HoverCard openDelay={OPEN_DELAY_MS} closeDelay={CLOSE_DELAY_MS}>
        <HoverCardTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            aria-label="加入 QQ 交流群"
          >
            <UsersRound className="h-5 w-5" aria-hidden="true" />
          </Button>
        </HoverCardTrigger>

        <HoverCardContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-60 rounded-2xl border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-900/10"
        >
          <div className="mb-3">
            <p className="font-semibold text-slate-900">加入 QQ 交流群</p>
            <p className="mt-1 text-sm text-slate-500">扫码交流备考经验</p>
          </div>

          <div className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
            <img
              src={qqCommunityQr}
              alt="QQ 交流群二维码"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

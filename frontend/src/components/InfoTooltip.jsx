import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function InfoTooltip({
  content,
  side = "top",
  ariaLabel,
  className = "",
  iconClassName = "",
  contentClassName = "",
}) {
  if (!content) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:border-slate-400 hover:text-slate-800 ${className}`.trim()}
            aria-label={ariaLabel || String(content)}
          >
            <Info className={`h-3.5 w-3.5 ${iconClassName}`.trim()} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className={contentClassName}>
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

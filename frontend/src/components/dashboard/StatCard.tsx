import { useMemo } from "react";
import { HelpTooltip } from "../ui/HelpTooltip";
import "./dashboard-components.css";

const DEFAULT_ICONS: Record<string, string> = {
  free: "checkmark",
  occupied: "truck",
  inactive: "blocked",
  tickets: "ticket",
  default: "grid",
};

export type StatCardProps = {
  label: string;
  value: number;
  icon?: string;
  type?: "free" | "occupied" | "inactive" | "tickets";
  helpText?: string;
  helpAriaLabel?: string;
};

export function StatCard({
  label,
  value,
  icon: iconProp,
  type,
  helpText,
  helpAriaLabel,
}: StatCardProps) {
  // const icon = useMemo(() => {
  //   if (iconProp) return iconProp
  //   if (type) return DEFAULT_ICONS[type]
  //   return DEFAULT_ICONS.default
  // }, [iconProp, type])
  const icon = iconProp || (type ? DEFAULT_ICONS[type] : DEFAULT_ICONS.default);
  return (
    <div className="dashboard-card group relative p-5">
      {helpText ? (
        <div className="absolute top-[10px] right-[10px] z-10 h-4 w-4">
          <HelpTooltip asIcon text={helpText} ariaLabel={helpAriaLabel} />
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition"
          aria-hidden="true"
        >
          <span className={`icon-${icon} text-2xl`} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

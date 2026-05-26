import { useMemo, useState } from "react";
import {
  BadgeCheck,
  LoaderCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCurrentUserProfile, getCurrentUserRoles } from "@/lib/roles";
import { toAuthApiUrl } from "@/lib/api-config";

const toDisplay = (value, fallback = "Not available") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const formatDisplayLabel = (value, fallback = "Not available") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function formatRoleLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AccountProfilePopover({
  children,
  fallbackName = "Procurement User",
  fallbackInitials = "PU",
  onAction = null,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading] = useState(false);
  const profile = getCurrentUserProfile() || {};
  const roles = useMemo(() => getCurrentUserRoles(), []);

  const displayName = toDisplay(profile.fullname, fallbackName);
  const rolePreview = Array.isArray(roles) ? roles.slice(0, 3) : [];

  const handleSignOut = async () => {
    try {
      await fetch(toAuthApiUrl("/signout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore signout network failures; local cleanup still runs.
    } finally {
      localStorage.removeItem("fullname");
      localStorage.removeItem("roles");
      localStorage.removeItem("me");
      setOpen(false);
      if (typeof onAction === "function") onAction();
      navigate("/login", { replace: true });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={14}
        className="w-[22rem] overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-0 shadow-[0_36px_80px_-36px_rgba(15,23,42,0.5)] backdrop-blur-xl"
      >
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_35%)]" />
          <div className="relative space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-slate-950 text-lg font-semibold text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.7)]">
                {fallbackInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Account Hub
                </div>
                <h3 className="mt-3 truncate text-lg font-semibold text-slate-900">
                  {displayName}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {toDisplay(profile.designation)}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm text-slate-600">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading account details...
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/85 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Employee Code
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {toDisplay(profile.empcode)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/85 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Location Scope
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatDisplayLabel(profile.location_scope)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                    Access Snapshot
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rolePreview.length ? (
                      rolePreview.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          {formatRoleLabel(role)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        Roles will appear here after the account loads.
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2.5 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>{formatDisplayLabel(profile.division)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>{formatDisplayLabel(profile.location_scope)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-slate-400" />
                      <span>
                        {rolePreview.length
                          ? `${rolePreview.length} visible role${rolePreview.length === 1 ? "" : "s"}`
                          : "No roles assigned"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-2.5">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                className="h-11 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

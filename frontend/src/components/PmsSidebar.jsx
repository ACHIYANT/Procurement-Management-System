import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  Banknote,
  ChevronsUpDown,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileKey2,
  FileSpreadsheet,
  Gavel,
  Home,
  History,
  LogOut,
  Menu,
  Network,
  PackageCheck,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from "lucide-react";

import AccountProfilePopover from "@/components/AccountProfilePopover";
import { Button } from "@/components/ui/button";
import {
  canAccessModule,
  formatRoleLabel,
  getCurrentUserRoles,
  isIndentInitiatorScopedUser,
  PMS_ROLES,
} from "@/lib/roles";

const navigationGroups = [
  {
    title: "Workspace",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: Home,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.USER, PMS_ROLES.VIEWER, PMS_ROLES.ASSOCIATE, PMS_ROLES.INDENT_INITIATOR, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "My Work",
        path: "/my-work",
        icon: CalendarCheck2,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN, PMS_ROLES.USER, PMS_ROLES.VIEWER, PMS_ROLES.ASSOCIATE, PMS_ROLES.INDENT_INITIATOR, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER],
      },
    ],
  },
  {
    title: "Procurement",
    items: [
      {
        label: "Indents",
        path: "/indents",
        icon: ClipboardList,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.INDENT_INITIATOR, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Procurement Cases",
        path: "/procurement-cases",
        icon: BriefcaseBusiness,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Tenders",
        path: "/tenders",
        icon: Gavel,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Committees",
        path: "/committees",
        icon: FileCheck2,
        roles: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Purchase Orders",
        path: "/purchase-orders",
        icon: PackageCheck,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
      },
    ],
  },
  {
    title: "Finance Tracking",
    items: [
      {
        label: "EMD Management",
        path: "/emd",
        icon: FileKey2,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
      },
      {
        label: "PBG Management",
        path: "/pbg",
        icon: Banknote,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER],
      },
      {
        label: "Department Funds",
        path: "/department-funds",
        icon: ReceiptIndianRupee,
        roles: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Reconciliation",
        path: "/reconciliation",
        icon: FileSpreadsheet,
        roles: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER, PMS_ROLES.VIEWER],
      },
      {
        label: "Reports",
        path: "/reports",
        icon: FileSpreadsheet,
        roles: [PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.FINANCE_OFFICER, PMS_ROLES.APPROVER, PMS_ROLES.VIEWER],
      },
      {
        label: "Approval Requests",
        path: "/approval-requests",
        icon: ClipboardList,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN, PMS_ROLES.APPROVER],
      },
      {
        label: "Approval Setup",
        path: "/approvals",
        icon: ShieldCheck,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
      },
    ],
  },
  {
    title: "Masters",
    items: [
      {
        label: "Firms",
        path: "/firms",
        icon: Building2,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER],
      },
      {
        label: "Empanelments",
        path: "/empanelments",
        icon: ShieldCheck,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Item Categories",
        path: "/item-categories",
        icon: Tags,
        roles: [PMS_ROLES.ASSOCIATE, PMS_ROLES.PROCUREMENT_OFFICER, PMS_ROLES.APPROVER],
      },
      {
        label: "Specification Templates",
        path: "/specification-templates",
        icon: Sparkles,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
      },
      {
        label: "Organizations",
        path: "/government-organizations",
        icon: Network,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
      },
      {
        label: "Login Audits",
        path: "/login-audits",
        icon: History,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
      },
      {
        label: "Administration",
        path: "/administration",
        icon: Settings,
        roles: [PMS_ROLES.ADMIN, PMS_ROLES.SUPER_ADMIN],
      },
    ],
  },
];

const pathToSection = (pathname) => {
  const group = navigationGroups.find((entry) =>
    entry.items.some((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)),
  );
  return group?.title || "Workspace";
};

const getInitials = (name) => {
  const words = String(name || "")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (!words.length) return "PM";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

const indentInitiatorAllowedPaths = new Set(["/dashboard", "/my-work", "/indents"]);
const SIDEBAR_COLLAPSED_STORAGE_KEY = "pms_sidebar_collapsed";

function SidebarLink({ item, onNavigate, collapsed = false }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group flex items-center rounded-2xl text-sm transition ${
          collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2.5"
        } ${
          isActive
            ? "bg-[#0071e3] text-white shadow-[0_14px_30px_-18px_rgba(0,113,227,0.75)]"
            : "text-black/70 hover:bg-white hover:text-[#1d1d1f]"
        }`
      }
    >
      {({ isActive }) => (
        collapsed ? (
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              isActive ? "bg-white/18" : "bg-[#f5f5f7] ring-1 ring-black/6"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">{item.label}</span>
          </span>
        ) : (
          <>
            <span className="flex min-w-0 items-center gap-3">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                isActive ? "bg-white/18" : "bg-[#f5f5f7] ring-1 ring-black/6"
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate font-medium">{item.label}</span>
          </span>
          {item.badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isActive ? "bg-white/18 text-white" : "bg-[#f5f5f7] text-black/52"
              }`}
            >
              {item.badge}
            </span>
          ) : null}
          </>
        )
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate, collapsed = false, onToggle }) {
  const location = useLocation();
  const [roles] = useState(() => getCurrentUserRoles());
  const [expanded, setExpanded] = useState(() => pathToSection(location.pathname));
  const userName = localStorage.getItem("fullname") || "Procurement User";

  useEffect(() => {
    queueMicrotask(() => setExpanded(pathToSection(location.pathname)));
  }, [location.pathname]);

  const visibleGroups = useMemo(
    () => {
      const scopedToIndents = isIndentInitiatorScopedUser(roles);
      return navigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (scopedToIndents && !indentInitiatorAllowedPaths.has(item.path)) {
              return false;
            }
            return canAccessModule(roles, item.roles);
          }),
        }))
        .filter((group) => group.items.length);
    },
    [roles],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={collapsed ? "p-2.5" : "p-4"}>
        <div className={`flex ${collapsed ? "mb-2 justify-center" : "mb-3 justify-end"}`}>
          <button
            type="button"
            onClick={onToggle}
            className="grid h-9 w-9 place-items-center rounded-xl border border-black/8 bg-white text-black/62 shadow-sm transition hover:bg-[#fbfbfd] hover:text-[#1d1d1f]"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <AccountProfilePopover
          fallbackName={userName}
          fallbackInitials={getInitials(userName)}
          onAction={onNavigate}
        >
          <button
            type="button"
            className={`w-full rounded-[1.4rem] bg-white ring-1 ring-black/8 transition hover:bg-[#fbfbfd] ${
              collapsed ? "grid place-items-center p-2" : "p-3 text-left"
            }`}
            title={collapsed ? userName : undefined}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[1.1rem] bg-[#0071e3] text-sm font-bold text-white">
                {getInitials(userName)}
              </div>
              {!collapsed ? (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1d1d1f]">{userName}</p>
                    <p className="truncate text-xs text-black/46">
                      {roles.length ? roles.map(formatRoleLabel).join(", ") : "Role loading"}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-black/34" />
                </>
              ) : null}
            </div>
          </button>
        </AccountProfilePopover>
      </div>

      <div className={`sidebar-scroll-hidden min-h-0 flex-1 ${collapsed ? "overflow-y-auto px-1.5 pb-2" : "overflow-y-auto px-3 pb-4"}`}>
        <div
          className={`rounded-[1.75rem] border border-black/8 bg-white text-[#1d1d1f] ${
            collapsed ? "grid place-items-center p-2" : "p-4"
          } ${collapsed ? "mb-2" : "mb-5"}`}
          title={collapsed ? "Procurement Control" : undefined}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="rounded-[1.15rem] bg-[#f5f5f7] p-3 ring-1 ring-black/6">
              <BriefcaseBusiness className="h-6 w-6" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.3em] text-black/38">PMS</p>
                <p className="truncate text-sm font-semibold">Procurement Control</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className={collapsed ? "space-y-2" : "space-y-3"}>
          {visibleGroups.map((group) => {
            const isOpen = expanded === group.title;

            return collapsed ? (
              <section
                key={group.title}
                className="rounded-[1.35rem] bg-white p-1 ring-1 ring-black/8"
                title={group.title}
              >
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <SidebarLink key={item.path} item={item} onNavigate={onNavigate} collapsed />
                  ))}
                </div>
              </section>
            ) : (
              <section
                key={group.title}
                className="rounded-[1.55rem] bg-white p-2 ring-1 ring-black/8"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? "" : group.title)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.24em] text-black/42 hover:bg-[#f5f5f7]"
                >
                  <span className="min-w-0 truncate">{group.title}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <Motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1 pt-1">
                        {group.items.map((item) => (
                          <SidebarLink key={item.path} item={item} onNavigate={onNavigate} />
                        ))}
                      </div>
                    </Motion.div>
                  ) : null}
                </AnimatePresence>
              </section>
            );
          })}

          {!visibleGroups.length ? (
            <div className={`rounded-2xl border border-black/8 bg-white text-sm text-black/58 ${collapsed ? "p-2 text-center" : "p-4"}`}>
              {collapsed ? "NA" : "No sidebar options are available for your role."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PmsSidebar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(desktopCollapsed));
  }, [desktopCollapsed]);

  const handleLogout = () => {
    localStorage.removeItem("fullname");
    localStorage.removeItem("roles");
    localStorage.removeItem("me");
    navigate("/login", { replace: true });
  };

  return (
    <>
      <aside
        className={`hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-black/8 bg-[#f5f5f7] md:flex ${
          desktopCollapsed ? "w-[5.5rem]" : "w-[18rem]"
        }`}
      >
        <div className="min-h-0 flex-1">
          <SidebarContent
            collapsed={desktopCollapsed}
            onToggle={() => setDesktopCollapsed((current) => !current)}
          />
        </div>
        <div className="border-t border-black/8 p-3">
          <Button
            type="button"
            variant="ghost"
            className={`w-full rounded-2xl text-black/70 hover:bg-white hover:text-[#1d1d1f] ${
              desktopCollapsed ? "justify-center px-0" : "justify-start gap-3"
            }`}
            onClick={handleLogout}
            title={desktopCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {desktopCollapsed ? <span className="sr-only">Logout</span> : "Logout"}
          </Button>
        </div>
      </aside>

      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          className="fixed left-4 top-4 z-40 h-10 w-10 rounded-xl border-black/8 bg-white p-0 text-[#1d1d1f] shadow-lg"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <AnimatePresence>
          {mobileOpen ? (
            <Motion.div
              className="fixed inset-0 z-50 bg-black/18 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Motion.aside
                className="flex h-full w-[86vw] max-w-[22rem] flex-col overflow-hidden bg-[#f5f5f7] shadow-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
              >
                <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1f]">
                    <ShieldCheck className="h-5 w-5 text-[#2997ff]" />
                    PMS Menu
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-9 p-0 text-[#1d1d1f] hover:bg-white hover:text-[#1d1d1f]"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <SidebarContent onNavigate={() => setMobileOpen(false)} />
                </div>
                <div className="border-t border-black/8 p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-2xl text-black/70 hover:bg-white hover:text-[#1d1d1f]"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </Motion.aside>
            </Motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}

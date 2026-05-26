import { Link, useLocation } from "react-router-dom";
import { Construction, MoveLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

const titlesByPath = {
  "/indents": "Indent Management",
  "/tenders": "Tender Management",
  "/firms": "Firm Master",
  "/purchase-orders": "Purchase Orders",
  "/committees": "Committee Meetings",
  "/reports": "Procurement Reports",
  "/administration": "Administration",
};

export default function ComingSoon() {
  const location = useLocation();
  const title = titlesByPath[location.pathname] || "Module";

  return (
    <div className="min-h-full bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <Card className="border-0 shadow-xl">
          <CardContent className="space-y-5 p-8">
            <div className="inline-flex rounded-2xl bg-blue-100 p-4 text-blue-700">
              <Construction className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-slate-500">
                PMS Roadmap
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                This option is already placed in the sidebar so the access
                structure remains stable. We will attach the full workflow here
                when we build this module.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <MoveLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
